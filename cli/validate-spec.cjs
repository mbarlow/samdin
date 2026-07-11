#!/usr/bin/env node
/**
 * validate-spec.js - Validates samdin spec files
 *
 * Supports:
 * - Parts-based specs
 * - Top-level CSG specs
 * - Embedded CSG parts
 * - Nested children arrays
 * - Spec-local modules
 * - Scene/render settings
 */

const fs = require('fs');
const path = require('path');

const PRIMITIVE_PARAMS = {
  box: { min: 3, max: 3 },
  cylinder: { min: 4, max: 5 },
  sphere: { min: 1, max: 2 },
  cone: { min: 2, max: 3 },
  torus: { min: 2, max: 4 },
  capsule: { min: 2, max: 4 },
  roundedBox: { min: 3, max: 5 },
  plane: { min: 2, max: 4 },
  group: { min: 0, max: 0 },
  prefab: { min: 0, max: 0, requiresSrc: true },
  module: { min: 0, max: 0, requiresSrc: true },
  csg: { min: 0, max: 0, validate: validateEmbeddedCSG },
  loft: { min: 0, max: 0, validate: validateLoft },
  polyMesh: { min: 0, max: 0, validate: validatePolyMesh },

  tetrahedron: { min: 0, max: 2 },
  octahedron: { min: 0, max: 2 },
  dodecahedron: { min: 0, max: 2 },
  icosahedron: { min: 0, max: 2 },
  prism: { min: 0, max: 3 },
  pyramid: { min: 0, max: 3 },
  wedge: { min: 0, max: 3 },
  tube: { min: 0, max: 5 },
  ring: { min: 0, max: 4 },
  stairs: { min: 0, max: 4 },
  arch: { min: 0, max: 5 },

  lathe: { min: 1, max: 4, skipNumericParams: true },
  extrudePath: { min: 3, max: 5, skipNumericParams: true },
  cable: { min: 1, max: 5, skipNumericParams: true },
  catenary: { min: 2, max: 6, skipNumericParams: true },
  helix: { min: 0, max: 4 },
  rock: { min: 0, max: 3 },
  canopy: { min: 0, max: 3 },
  pointLight: { min: 0, max: 5, booleanParams: [3] },
  spotLight: { min: 0, max: 5, booleanParams: [4] },
  areaLight: { min: 0, max: 4, booleanParams: [3] },

  ibeam: { min: 0, max: 5 },
  lbeam: { min: 0, max: 4 },
  tbeam: { min: 0, max: 5 },
  channel: { min: 0, max: 4 },
  hbeam: { min: 0, max: 5 },
  angle: { min: 0, max: 4 },
  hollowBox: { min: 0, max: 4, validate: validateHollowBox },
  hollowCylinder: { min: 0, max: 4, validate: validateHollowCylinder },
  pipeFlange: { min: 0, max: 5 },
  elbow: { min: 0, max: 4 },
  bracket: { min: 0, max: 5, validate: validateBracket },
  gear: { min: 0, max: 5 },
  cross: { min: 0, max: 3 },
  frame: { min: 0, max: 4 },
  windowFrame: { min: 0, max: 5 },
  dome: { min: 0, max: 4, validate: validateDome },
  hexNut: { min: 0, max: 3 },
  countersunk: { min: 0, max: 5 },
  keyhole: { min: 0, max: 5 },
  halfTorus: { min: 0, max: 3 },
  sphereSlab: { min: 0, max: 3 },
  notchedCylinder: { min: 0, max: 5 },
  steppedPyramid: { min: 0, max: 4 },
  boxSphereIntersect: { min: 0, max: 2 },
  cylinderIntersect: { min: 0, max: 3 },
  swissCheese: { min: 0, max: 5 }
};

const CSG_SHAPE_TYPES = new Set(['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule']);

// Types whose param[1] (and beyond) is not a dimension (subdivision detail,
// seed, lobe count) — a 0 there is valid and should not warn.
const DETAIL_AT_1 = new Set(['sphere', 'icosahedron', 'octahedron', 'tetrahedron', 'dodecahedron', 'rock', 'canopy']);

function validateHollowBox(params) {
  const [width, height, depth, thickness = 0.1] = params;
  const issues = [];
  if (width !== undefined && thickness !== undefined && width <= thickness * 2) {
    issues.push(`width (${width}) should be > thickness*2 (${thickness * 2})`);
  }
  if (depth !== undefined && thickness !== undefined && depth <= thickness * 2) {
    issues.push(`depth (${depth}) should be > thickness*2 (${thickness * 2})`);
  }
  return issues;
}

function validateHollowCylinder(params) {
  const [outerRadius, innerRadius] = params;
  const issues = [];
  if (outerRadius !== undefined && innerRadius !== undefined && innerRadius >= outerRadius) {
    issues.push(`innerRadius (${innerRadius}) should be < outerRadius (${outerRadius})`);
  }
  return issues;
}

function validateBracket(params) {
  const [width, height, depth, thickness = 0.08] = params;
  const issues = [];
  if (height !== undefined && thickness !== undefined && height <= thickness) {
    issues.push(`height (${height}) should be > thickness (${thickness})`);
  }
  return issues;
}

function validateDome(params) {
  const [radius, widthSegments, heightSegments, phiLength, thickness] = params;
  const issues = [];
  if (radius !== undefined && thickness !== undefined && thickness >= radius) {
    issues.push(`thickness (${thickness}) should be < radius (${radius})`);
  }
  return issues;
}

function flattenParts(parts, inheritedParent = null) {
  const flattened = [];

  for (const part of parts || []) {
    const clone = JSON.parse(JSON.stringify(part));
    const children = Array.isArray(clone.children) ? clone.children : [];
    delete clone.children;

    if (inheritedParent && !clone.parent) {
      clone.parent = inheritedParent;
    }

    flattened.push(clone);
    flattened.push(...flattenParts(children, clone.name));
  }

  return flattened;
}

function normalizeModules(modules) {
  if (!modules) return [];

  if (Array.isArray(modules)) {
    return modules.map((moduleDef) => ({
      ...moduleDef,
      parts: flattenParts(moduleDef.parts || [])
    }));
  }

  return Object.entries(modules).map(([name, moduleDef]) => ({
    name,
    ...moduleDef,
    parts: flattenParts(moduleDef.parts || [])
  }));
}

function validateTransform(part, prefix, issues) {
  if (part.position && (!Array.isArray(part.position) || part.position.length !== 3)) {
    issues.push(`${prefix} Invalid position: should be [x, y, z]`);
  }

  if (part.rotation && (!Array.isArray(part.rotation) || part.rotation.length !== 3)) {
    issues.push(`${prefix} Invalid rotation: should be [x, y, z]`);
  }

  if (part.scale) {
    const scaleOk = typeof part.scale === 'number' ||
      (Array.isArray(part.scale) && part.scale.length === 3);
    if (!scaleOk) {
      issues.push(`${prefix} Invalid scale: should be number or [x, y, z]`);
    }
  }
}

function validateParams(part, typeInfo, prefix, issues, warnings) {
  if (!part.params) return;

  if (!Array.isArray(part.params)) {
    issues.push(`${prefix} Invalid params: should be an array`);
    return;
  }

  if (part.params.length < typeInfo.min) {
    warnings.push(`${prefix} Too few params: got ${part.params.length}, expected at least ${typeInfo.min}`);
  }
  if (part.params.length > typeInfo.max && typeInfo.max > 0) {
    warnings.push(`${prefix} Too many params: got ${part.params.length}, expected at most ${typeInfo.max}`);
  }

  const booleanParamIndices = new Set(typeInfo.booleanParams || []);

  if (!typeInfo.skipNumericParams) {
    for (let i = 0; i < part.params.length; i++) {
      const value = part.params[i];

      if (booleanParamIndices.has(i)) {
        const isBoolLike = typeof value === 'boolean' || (typeof value === 'number' && !Number.isNaN(value));
        if (!isBoolLike) {
          issues.push(`${prefix} Invalid param[${i}]: ${value} (should be boolean or number)`);
        }
        continue;
      }

      if (typeof value !== 'number' || Number.isNaN(value)) {
        issues.push(`${prefix} Invalid param[${i}]: ${value} (should be number)`);
      }
      if (typeof value === 'number' && value < 0) {
        warnings.push(`${prefix} Negative param[${i}]: ${part.params[i]}`);
      }
      // param[1+] on platonic solids / sphere is `detail` (subdivision), not a
      // dimension — 0 is valid and common. Only flag genuine zero dimensions.
      const nonDimParam = i >= 1 && DETAIL_AT_1.has(part.type);
      if (value === 0 && i < 3 && !nonDimParam && !partIgnores(part, 'zero-dimension')) {
        warnings.push(`${prefix} Zero dimension param[${i}] may cause issues`);
      }
    }
  }

  if (typeInfo.validate) {
    const typeIssues = typeInfo.validate(part.params, part.name);
    issues.push(...typeIssues.map((issue) => `${prefix} ${issue}`));
  }
}

function validatePoses(spec, issues, warnings) {
  if (spec.poses !== undefined) {
    if (typeof spec.poses !== 'object' || Array.isArray(spec.poses)) {
      issues.push('poses must be an object of { poseName: { jointName: [rx, ry, rz] } }');
    } else {
      for (const [poseName, jointMap] of Object.entries(spec.poses)) {
        if (typeof jointMap !== 'object' || Array.isArray(jointMap)) {
          issues.push(`poses.${poseName} must map joint names to [rx, ry, rz]`);
          continue;
        }
        for (const [joint, rot] of Object.entries(jointMap)) {
          if (!Array.isArray(rot) || rot.length !== 3 || rot.some((v) => typeof v !== 'number')) {
            issues.push(`poses.${poseName}.${joint} must be [rx, ry, rz] degrees`);
          }
        }
      }
    }
  }
  if (spec.pose !== undefined) {
    if (typeof spec.pose !== 'string') {
      issues.push('pose must be a pose name string');
    } else if (spec.poses && !spec.poses[spec.pose]) {
      warnings.push(`pose "${spec.pose}" is not defined in poses`);
    }
  }
}

function validateClips(spec, issues, warnings) {
  if (spec.clips === undefined) return;
  if (!spec.clips || typeof spec.clips !== 'object' || Array.isArray(spec.clips)) {
    issues.push('clips must be an object of named animation clips');
    return;
  }

  const placementNames = new Set(flattenParts(spec.parts || []).map((part) => part.name));
  for (const [clipName, clip] of Object.entries(spec.clips)) {
    const prefix = `clips.${clipName}`;
    if (!clip || typeof clip !== 'object' || Array.isArray(clip)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (clip.duration !== undefined && (typeof clip.duration !== 'number' || clip.duration <= 0)) {
      issues.push(`${prefix}.duration must be a positive number`);
    }
    if (clip.instances !== undefined) {
      if (!Array.isArray(clip.instances) || clip.instances.length === 0 ||
          clip.instances.some((name) => typeof name !== 'string' || !name)) {
        issues.push(`${prefix}.instances must be a non-empty array of placement names`);
      } else {
        for (const name of clip.instances) {
          if (!placementNames.has(name)) warnings.push(`${prefix} instance "${name}" is not a top-level part`);
        }
      }
    }
    if (!clip.tracks || typeof clip.tracks !== 'object' || Array.isArray(clip.tracks) ||
        Object.keys(clip.tracks).length === 0) {
      issues.push(`${prefix}.tracks must be a non-empty object`);
      continue;
    }

    for (const [joint, channels] of Object.entries(clip.tracks)) {
      const trackPrefix = `${prefix}.tracks.${joint}`;
      if (!channels || typeof channels !== 'object' || Array.isArray(channels)) {
        issues.push(`${trackPrefix} must contain rotation and/or position keyframes`);
        continue;
      }
      const channelNames = ['rotation', 'position'].filter((name) => channels[name] !== undefined);
      if (channelNames.length === 0) {
        issues.push(`${trackPrefix} must contain rotation and/or position keyframes`);
      }
      for (const channelName of channelNames) {
        const keyframes = channels[channelName];
        if (!Array.isArray(keyframes) || keyframes.length < 2) {
          issues.push(`${trackPrefix}.${channelName} must contain at least two [time, [x, y, z]] keyframes`);
          continue;
        }
        let previousTime = -Infinity;
        for (let index = 0; index < keyframes.length; index++) {
          const keyframe = keyframes[index];
          const valid = Array.isArray(keyframe) && keyframe.length === 2 &&
            typeof keyframe[0] === 'number' && keyframe[0] >= 0 &&
            Array.isArray(keyframe[1]) && keyframe[1].length === 3 &&
            keyframe[1].every((value) => typeof value === 'number');
          if (!valid) {
            issues.push(`${trackPrefix}.${channelName}[${index}] must be [non-negative time, [x, y, z]]`);
            continue;
          }
          if (keyframe[0] <= previousTime) {
            issues.push(`${trackPrefix}.${channelName} times must be strictly increasing`);
          }
          if (clip.duration !== undefined && keyframe[0] > clip.duration) {
            issues.push(`${trackPrefix}.${channelName}[${index}] exceeds clip duration ${clip.duration}`);
          }
          previousTime = keyframe[0];
        }
      }
    }
  }
}

function validateSceneSettings(scene, issues, warnings) {
  if (!scene || typeof scene !== 'object') {
    issues.push('scene must be an object');
    return;
  }

  if (scene.background && typeof scene.background !== 'object') {
    issues.push('scene.background must be an object');
  }

  if (scene.fog && typeof scene.fog !== 'object') {
    issues.push('scene.fog must be an object');
  }

  if (scene.lighting && typeof scene.lighting !== 'object') {
    issues.push('scene.lighting must be an object');
  }

  if (scene.postfx && typeof scene.postfx !== 'object') {
    issues.push('scene.postfx must be an object');
  }

  if (scene.exposure !== undefined && typeof scene.exposure !== 'number') {
    issues.push('scene.exposure must be a number');
  }

  if (scene.toneMapping !== undefined && typeof scene.toneMapping !== 'string') {
    issues.push('scene.toneMapping must be a string');
  }

  if (scene.terrain !== undefined) {
    validateTerrainSettings(scene.terrain, issues, warnings);
  }
}

const TERRAIN_METHODS = new Set(['heightfield', 'marching-cubes', 'cloth-drape']);
const TERRAIN_DISPLAY_MODES = new Set(['primitives', 'terrain', 'both']);

function validateTerrainSettings(terrain, issues, warnings) {
  if (typeof terrain !== 'object' || terrain === null) {
    issues.push('scene.terrain must be an object');
    return;
  }

  if (terrain.enabled !== undefined && typeof terrain.enabled !== 'boolean') {
    issues.push('scene.terrain.enabled must be a boolean');
  }

  if (terrain.flipNormals !== undefined && typeof terrain.flipNormals !== 'boolean') {
    issues.push('scene.terrain.flipNormals must be a boolean');
  }

  if (terrain.method !== undefined && !TERRAIN_METHODS.has(terrain.method)) {
    issues.push(`scene.terrain.method must be one of: ${[...TERRAIN_METHODS].join(', ')}`);
  }

  if (terrain.display !== undefined && !TERRAIN_DISPLAY_MODES.has(terrain.display)) {
    issues.push(`scene.terrain.display must be one of: ${[...TERRAIN_DISPLAY_MODES].join(', ')}`);
  }

  if (terrain.bounds !== undefined) {
    const okAuto = terrain.bounds === 'auto';
    const okArray = Array.isArray(terrain.bounds) && terrain.bounds.length === 4
      && terrain.bounds.every((n) => typeof n === 'number');
    if (!okAuto && !okArray) {
      issues.push('scene.terrain.bounds must be "auto" or [minX, minZ, maxX, maxZ]');
    }
  }

  if (terrain.resolution !== undefined) {
    if (typeof terrain.resolution !== 'number' || terrain.resolution < 4 || terrain.resolution > 1024) {
      issues.push('scene.terrain.resolution must be a number in [4, 1024]');
    }
  }

  if (terrain.smoothing !== undefined) {
    if (typeof terrain.smoothing !== 'number' || terrain.smoothing < 0 || terrain.smoothing > 1) {
      issues.push('scene.terrain.smoothing must be a number in [0, 1]');
    }
  }

  if (terrain.material !== undefined && typeof terrain.material !== 'object') {
    issues.push('scene.terrain.material must be an object');
  }

  if (terrain.variableResolution !== undefined && typeof terrain.variableResolution !== 'object') {
    issues.push('scene.terrain.variableResolution must be an object');
  }

  if (terrain.methodOptions !== undefined && typeof terrain.methodOptions !== 'object') {
    issues.push('scene.terrain.methodOptions must be an object');
  }

  if (terrain.water !== undefined) {
    const water = terrain.water;
    if (typeof water !== 'object' || water === null) {
      issues.push('scene.terrain.water must be an object');
      return;
    }
    if (typeof water.level !== 'number') {
      issues.push('scene.terrain.water.level is required and must be a number');
    }
    if (water.color !== undefined && typeof water.color !== 'string') {
      issues.push('scene.terrain.water.color must be a color string');
    }
    if (water.opacity !== undefined &&
        (typeof water.opacity !== 'number' || water.opacity < 0 || water.opacity > 1)) {
      issues.push('scene.terrain.water.opacity must be a number in [0, 1]');
    }
    if (water.roughness !== undefined && typeof water.roughness !== 'number') {
      issues.push('scene.terrain.water.roughness must be a number');
    }
    if (water.resolution !== undefined &&
        (typeof water.resolution !== 'number' || water.resolution < 8 || water.resolution > 512)) {
      issues.push('scene.terrain.water.resolution must be a number in [8, 512]');
    }
    if (water.shoreline !== undefined) {
      if (typeof water.shoreline !== 'object' || water.shoreline === null) {
        issues.push('scene.terrain.water.shoreline must be an object');
      } else {
        if (water.shoreline.width !== undefined &&
            (typeof water.shoreline.width !== 'number' || water.shoreline.width < 0)) {
          issues.push('scene.terrain.water.shoreline.width must be a non-negative number');
        }
        if (water.shoreline.color !== undefined && typeof water.shoreline.color !== 'string') {
          issues.push('scene.terrain.water.shoreline.color must be a color string');
        }
      }
    }
  }
}

function validateDeform(deform, prefix, issues) {
  if (!deform || typeof deform !== 'object' || Array.isArray(deform)) {
    issues.push(`${prefix} deform should be an object`);
    return;
  }
  const axes = new Set(['x', 'y', 'z']);
  const known = new Set(['taper', 'twist', 'bend']);
  for (const key of Object.keys(deform)) {
    if (!known.has(key)) issues.push(`${prefix} deform.${key} is not a deformer (taper/twist/bend)`);
  }
  const checkAxis = (op, axis) => {
    if (axis !== undefined && !axes.has(axis)) issues.push(`${prefix} deform.${op}.axis must be x, y, or z`);
  };
  if (deform.taper !== undefined && typeof deform.taper !== 'number') {
    if (typeof deform.taper !== 'object' || typeof deform.taper.amount !== 'number') {
      issues.push(`${prefix} deform.taper needs a number or { amount }`);
    } else checkAxis('taper', deform.taper.axis);
  }
  if (deform.twist !== undefined && typeof deform.twist !== 'number') {
    if (typeof deform.twist !== 'object' || typeof deform.twist.angle !== 'number') {
      issues.push(`${prefix} deform.twist needs a number or { angle }`);
    } else checkAxis('twist', deform.twist.axis);
  }
  if (deform.bend !== undefined && typeof deform.bend !== 'number') {
    if (typeof deform.bend !== 'object' || typeof deform.bend.angle !== 'number') {
      issues.push(`${prefix} deform.bend needs a number or { angle, axis }`);
    } else checkAxis('bend', deform.bend.axis);
  }
}

function validateLoft(part) {
  const errors = [];
  const loft = part.loft;
  if (!loft || typeof loft !== 'object') {
    errors.push('loft part requires a loft object');
    return errors;
  }
  const stations = loft.stations;
  if (!Array.isArray(stations) || stations.length < 2) {
    errors.push('loft requires stations array with at least 2 stations');
    return errors;
  }
  const count = Array.isArray(stations[0].points) ? stations[0].points.length : 0;
  if (count < 3) {
    errors.push('loft stations need at least 3 profile points');
  }
  stations.forEach((s, i) => {
    if (!Array.isArray(s.at) || s.at.length !== 3) {
      errors.push(`loft station ${i} needs at: [x, y, z]`);
    }
    if (!Array.isArray(s.points) || s.points.length !== count) {
      errors.push(`loft station ${i} point count differs (all stations need ${count})`);
    } else if (s.points.some((pt) => !Array.isArray(pt) || pt.length !== 2)) {
      errors.push(`loft station ${i} points must be [px, py] pairs`);
    }
  });
  for (const key of ['startPoint', 'endPoint']) {
    if (loft[key] !== undefined && (!Array.isArray(loft[key]) || loft[key].length !== 3)) {
      errors.push(`loft ${key} must be [x, y, z]`);
    }
  }
  return errors;
}

function validatePolyMesh(part) {
  const errors = [];
  const def = part.polyMesh;
  if (!def || typeof def !== 'object' || Array.isArray(def)) {
    return ['polyMesh part requires a polyMesh object'];
  }

  const isVec = (value, size) =>
    Array.isArray(value) && value.length === size && value.every((item) => typeof item === 'number');
  const base = def.base || { type: 'cube' };
  const baseType = base.type || 'cube';
  if (!['cube', 'mesh'].includes(baseType)) {
    errors.push('polyMesh base.type must be "cube" or "mesh"');
  }
  if (baseType === 'cube') {
    if (base.size !== undefined && !isVec(base.size, 3)) {
      errors.push('polyMesh cube base.size must be [width, height, depth]');
    }
    if (isVec(base.size, 3) && base.size.some((value) => value <= 0)) {
      errors.push('polyMesh cube base.size values must be positive');
    }
    if (base.center !== undefined && !isVec(base.center, 3)) {
      errors.push('polyMesh cube base.center must be [x, y, z]');
    }
  }
  if (baseType === 'mesh') {
    if (!Array.isArray(base.vertices) || base.vertices.length < 4 ||
        base.vertices.some((vertex) => !isVec(vertex, 3))) {
      errors.push('polyMesh mesh base.vertices needs at least four [x, y, z] vertices');
    }
    if (!Array.isArray(base.faces) || base.faces.length < 4) {
      errors.push('polyMesh mesh base.faces needs at least four polygon faces');
    } else {
      const vertexCount = Array.isArray(base.vertices) ? base.vertices.length : 0;
      base.faces.forEach((face, index) => {
        const vertices = Array.isArray(face) ? face : face?.vertices;
        if (!Array.isArray(vertices) || vertices.length < 3 ||
            vertices.some((value) => !Number.isInteger(value) || value < 0 || value >= vertexCount)) {
          errors.push(`polyMesh mesh face ${index} needs at least three valid vertex indices`);
        }
      });
    }
  }

  const operations = def.operations || [];
  if (!Array.isArray(operations)) {
    errors.push('polyMesh operations must be an array');
  } else {
    let hasSelection = false;
    const knownTags = new Set(baseType === 'cube'
      ? ['front', 'back', 'left', 'right', 'top', 'bottom']
      : (base.faces || []).flatMap((face) => {
          if (Array.isArray(face)) return [];
          return [...(face?.tags || []), ...(face?.tag ? [face.tag] : [])];
        }));
    const selectionOn = (operation) =>
      operation.selection !== undefined || operation.criteria !== undefined;
    operations.forEach((operation, index) => {
      const prefix = `polyMesh operation ${index}`;
      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (!['select', 'extrude', 'inset', 'translate', 'scale', 'rotate'].includes(operation.op)) {
        errors.push(`${prefix} has unsupported op "${operation.op}"`);
        return;
      }
      const selector = operation.op === 'select'
        ? (operation.selection ?? operation.tag ?? operation.criteria?.tag)
        : (operation.selection ?? operation.criteria?.tag);
      const selectedTags = selector === undefined ? [] : (Array.isArray(selector) ? selector : [selector]);
      selectedTags.forEach((tag) => {
        if (typeof tag === 'string' && !knownTags.has(tag)) {
          errors.push(`${prefix} selects unknown face tag "${tag}"`);
        }
      });
      if (operation.op === 'select') hasSelection = true;
      else if (selectionOn(operation)) hasSelection = true;
      else if (!hasSelection) errors.push(`${prefix} has no active face selection`);

      if (operation.op === 'extrude') {
        if (operation.individual === false) errors.push(`${prefix} region extrusion is not supported yet`);
        if (operation.distance !== undefined && typeof operation.distance !== 'number') {
          errors.push(`${prefix} distance must be a number`);
        }
        if (operation.amount !== undefined && typeof operation.amount !== 'number') {
          errors.push(`${prefix} amount must be a number`);
        }
        if (operation.offset !== undefined && !isVec(operation.offset, 3)) {
          errors.push(`${prefix} offset must be [x, y, z]`);
        }
        if (operation.pivot !== undefined && !isVec(operation.pivot, 3)) {
          errors.push(`${prefix} pivot must be [x, y, z]`);
        }
      }
      if (operation.op === 'inset') {
        const factor = operation.factor ?? operation.scale;
        if (factor !== undefined && typeof factor !== 'number' && !isVec(factor, 3)) {
          errors.push(`${prefix} inset factor must be a number or [x, y, z]`);
        }
        if (operation.amount !== undefined &&
            (typeof operation.amount !== 'number' || operation.amount < 0 || operation.amount >= 1)) {
          errors.push(`${prefix} inset amount must be a number from 0 up to 1`);
        }
      }
      if ((operation.op === 'extrude' || operation.op === 'inset') && operation.tag) {
        knownTags.add(operation.tag);
        knownTags.add(operation.sideTag || operation.borderTag || `${operation.tag}.${operation.op === 'extrude' ? 'side' : 'border'}`);
      }
      if (operation.op === 'translate' && !isVec(operation.offset, 3)) {
        errors.push(`${prefix} translate requires offset: [x, y, z]`);
      }
      if (operation.op === 'rotate') {
        if (typeof operation.angle !== 'number') errors.push(`${prefix} rotate requires a numeric angle`);
        if (operation.axis !== undefined &&
            !['x', 'y', 'z'].includes(operation.axis) && !isVec(operation.axis, 3)) {
          errors.push(`${prefix} rotate axis must be x, y, z, or [x, y, z]`);
        }
      }
      if (operation.op === 'scale') {
        const factor = operation.factor ?? operation.scale;
        if (typeof factor !== 'number' && !isVec(factor, 3)) {
          errors.push(`${prefix} scale requires factor as a number or [x, y, z]`);
        }
      }
    });
  }

  const modifiers = def.modifiers || [];
  if (!Array.isArray(modifiers)) {
    errors.push('polyMesh modifiers must be an array');
  } else {
    modifiers.forEach((modifier, index) => {
      if (modifier?.type !== 'mirror') {
        errors.push(`polyMesh modifier ${index} has unsupported type "${modifier?.type}"`);
      } else if (modifier.axis !== undefined && !['x', 'y', 'z'].includes(modifier.axis)) {
        errors.push(`polyMesh modifier ${index} mirror axis must be x, y, or z`);
      }
    });
  }
  return errors;
}

function validateEmbeddedCSG(part) {
  const errors = [];
  if (!part.shapes || typeof part.shapes !== 'object') {
    errors.push('embedded csg part requires a shapes object');
  }
  if (!Array.isArray(part.operations)) {
    errors.push('embedded csg part requires an operations array');
  }
  if (!part.output && !Array.isArray(part.outputs)) {
    errors.push('embedded csg part requires output or outputs');
  }
  return errors;
}

function validateCSGSpec(spec, issues, warnings) {
  if (!spec.shapes || typeof spec.shapes !== 'object') {
    issues.push('Missing or invalid field: shapes (should be object)');
  }

  if (!Array.isArray(spec.operations)) {
    issues.push('Missing or invalid field: operations (should be array)');
  }

  if (!spec.output && !Array.isArray(spec.outputs)) {
    issues.push('Missing output or outputs definition');
  }

  const shapeNames = new Set(Object.keys(spec.shapes || {}));
  for (const [shapeName, shapeDef] of Object.entries(spec.shapes || {})) {
    if (!shapeDef.type) {
      issues.push(`[shape:${shapeName}] Missing type`);
      continue;
    }
    if (!CSG_SHAPE_TYPES.has(shapeDef.type)) {
      warnings.push(`[shape:${shapeName}] Unknown/unsupported CSG shape type: ${shapeDef.type}`);
    }
  }

  for (const op of spec.operations || []) {
    if (!op.op || !op.a || !op.b || !op.result) {
      issues.push('Each CSG operation requires op, a, b, and result');
      continue;
    }
    if (!shapeNames.has(op.a)) {
      warnings.push(`[csg:${op.result}] Input a not found among initial shapes: ${op.a}`);
    }
    if (!shapeNames.has(op.b) && !spec.operations.some((candidate) => candidate.result === op.b)) {
      warnings.push(`[csg:${op.result}] Input b not found among initial shapes/results: ${op.b}`);
    }
  }

  if (spec.scene) {
    validateSceneSettings(spec.scene, issues, warnings);
  }
}

const PREFABS_DIR = path.join(__dirname, '..', 'prefabs');

function validatePartCollection(parts, issues, warnings, scopeLabel = 'spec', refs = null) {
  const flatParts = flattenParts(parts);
  const partNames = new Set();
  const duplicates = new Set();

  for (const part of flatParts) {
    if (!part?.name) continue;
    if (partNames.has(part.name)) duplicates.add(part.name);
    partNames.add(part.name);
  }

  if (duplicates.size > 0) {
    issues.push(`${scopeLabel}: duplicate part names: ${[...duplicates].join(', ')}`);
  }

  for (const part of flatParts) {
    const prefix = `[${part.name || 'unnamed'}]`;

    if (!part.name) {
      issues.push(`${prefix} Missing part name`);
      continue;
    }

    if (!part.type) {
      issues.push(`${prefix} Missing type`);
      continue;
    }

    const typeInfo = PRIMITIVE_PARAMS[part.type];
    if (!typeInfo) {
      warnings.push(`${prefix} Unknown primitive type: ${part.type}`);
    }

    if (part.parent && !partNames.has(part.parent)) {
      issues.push(`${prefix} Parent not found: ${part.parent}`);
    }

    if ((part.type === 'prefab' || part.type === 'module') && !(part.src || part.module || part.ref)) {
      issues.push(`${prefix} ${part.type} requires src/module/ref`);
    }

    // A dangling reference passes schema checks but 404s in the viewer —
    // resolve against disk (prefabs) and the spec's modules, same as the builder.
    if (part.type === 'prefab' && part.src) {
      if (!fs.existsSync(path.join(PREFABS_DIR, `${part.src}.json`))) {
        issues.push(`${prefix} prefab src not found: prefabs/${part.src}.json`);
      }
    }
    if (part.type === 'module' && refs?.moduleNames) {
      const moduleName = part.src || part.module || part.ref;
      if (moduleName && !refs.moduleNames.has(moduleName)) {
        issues.push(`${prefix} module ref not found in spec modules: ${moduleName}`);
      }
    }

    if (part.material && typeof part.material !== 'object') {
      issues.push(`${prefix} Invalid material: should be object`);
    }

    if (part.scene) {
      warnings.push(`${prefix} Found nested scene field; scene settings should be top-level on the spec`);
    }

    validateTransform(part, prefix, issues);

    if (typeInfo) {
      validateParams(part, typeInfo, prefix, issues, warnings);
      // Paramless structural types (csg, loft, polyMesh) validate the part itself —
      // validateParams early-returns when there's no params array.
      if (typeInfo.validate && !part.params) {
        issues.push(...typeInfo.validate(part).map((issue) => `${prefix} ${issue}`));
      }
    }

    if (part.modifiers && typeof part.modifiers !== 'object') {
      issues.push(`${prefix} modifiers should be an object`);
    }

    if (part.deform !== undefined) {
      validateDeform(part.deform, prefix, issues);
    }

    const wearMode = part.material?.breakup?.edgeWear?.mode;
    if (wearMode !== undefined && !['bbox', 'curvature'].includes(wearMode)) {
      issues.push(`${prefix} edgeWear.mode must be "bbox" or "curvature"`);
    }
    const detail = part.material?.detail;
    if (detail !== undefined) {
      if (typeof detail !== 'object' || Array.isArray(detail)) {
        issues.push(`${prefix} material.detail must be an object`);
      } else {
        for (const key of ['scale', 'amount']) {
          if (detail[key] !== undefined && typeof detail[key] !== 'number') {
            issues.push(`${prefix} material.detail.${key} must be a number`);
          }
        }
      }
    }

    if (part.snapToGround !== undefined && typeof part.snapToGround !== 'boolean') {
      issues.push(`${prefix} snapToGround must be a boolean`);
    }
    if (part.groundOffset !== undefined && typeof part.groundOffset !== 'number') {
      issues.push(`${prefix} groundOffset must be a number`);
    }
    const arrayMod = part.array || part.modifiers?.array;
    if (arrayMod?.jitter !== undefined) {
      const j = arrayMod.jitter;
      if (typeof j !== 'object' || Array.isArray(j)) {
        issues.push(`${prefix} array.jitter must be an object`);
      } else {
        for (const key of ['offset', 'rotation']) {
          if (j[key] !== undefined && (!Array.isArray(j[key]) || j[key].length !== 3)) {
            issues.push(`${prefix} array.jitter.${key} must be [x, y, z]`);
          }
        }
        for (const key of ['scale', 'tone']) {
          if (j[key] !== undefined && typeof j[key] !== 'number') {
            issues.push(`${prefix} array.jitter.${key} must be a number`);
          }
        }
      }
    }
    if (arrayMod?.path !== undefined) {
      if (!Array.isArray(arrayMod.path) || arrayMod.path.length < 2 ||
          arrayMod.path.some((pt) => !Array.isArray(pt) || pt.length !== 3)) {
        issues.push(`${prefix} array.path must be an array of at least 2 [x, y, z] waypoints`);
      }
    }
  }

  return flatParts;
}

// ─── Strict lint tier (opt-in via --strict) ──────────────────────────────
// Encodes the samdin skill's quality rules as warnings. These never fail the
// build; they surface convention gaps the structural validator can't see.

const STRICT = {
  cameraPresets: new Set(['front', 'back', 'left', 'right', 'top', 'threeQuarter', 'lowAngle', 'highAngle']),
  lightingPresets: new Set(['studio', 'sunset', 'night', 'overcast', 'dramatic', 'neon', 'cyberpunk', 'warm', 'cool', 'rim', 'backlit', 'goldenHour', 'noir', 'underwater', 'horror', 'industrialRuin', 'showcase']),
  environments: new Set(['none', 'studio', 'outdoor', 'sunset', 'night']),
  toneMappings: new Set(['none', 'linear', 'reinhard', 'cineon', 'acesfilmic', 'neutral']),
  metalKeywords: /chrome|steel|brass|gold|copper|aluminum|iron|silver|bronze|gunmetal|metal/i,
  structuralTypes: new Set(['box', 'roundedBox', 'cylinder']),
  scenePartThreshold: 12,
  emissiveBudget: 6,
  groundEps: 0.05
};

function partIgnores(part, rule) {
  const list = part && part.lintIgnore;
  return Array.isArray(list) && (list.includes(rule) || list.includes('all'));
}

function specIgnores(spec, rule) {
  const list = spec && spec.lintIgnore;
  return Array.isArray(list) && (list.includes(rule) || list.includes('all'));
}

function isEmissive(material) {
  if (!material) return false;
  const e = material.emissive;
  const hasColor = e && e !== '#000000' && e !== '#000' && e !== 0x000000;
  return !!hasColor && (material.emissiveIntensity ?? 1) > 0;
}

function isMetal(material) {
  if (!material) return false;
  if (typeof material.metalness === 'number' && material.metalness >= 0.5) return true;
  return typeof material.preset === 'string' && STRICT.metalKeywords.test(material.preset);
}

// Half-extent along Y for the common grounded primitives, from params.
function halfHeightY(part) {
  const p = part.params || [];
  switch (part.type) {
    case 'box':
    case 'roundedBox': return (p[1] || 0) / 2;
    case 'cylinder':
    case 'cone': return (p[2] || 0) / 2;
    case 'sphere': return p[0] || 0;
    default: return 0;
  }
}

function worldY(part, byName) {
  let y = 0;
  let cur = part;
  const seen = new Set();
  while (cur) {
    if (seen.has(cur.name)) break; // cycle guard
    seen.add(cur.name);
    const pos = Array.isArray(cur.position) ? cur.position[1] || 0 : 0;
    y += pos;
    cur = cur.parent ? byName.get(cur.parent) : null;
  }
  return y;
}

function runStrictLints(spec, flatParts, findings) {
  const add = (rule, msg) => { if (!specIgnores(spec, rule)) findings.push(`[strict:${rule}] ${msg}`); };
  const scene = spec.scene || null;
  const geomParts = flatParts.filter((p) => p.type && p.type !== 'group' && !/Light$/.test(p.type));

  // Scene block presence on a presentation-scale asset.
  if (!scene && geomParts.length >= STRICT.scenePartThreshold) {
    add('scene-block', `${geomParts.length} parts and no scene block — presentation assets should ship a scene`);
  }

  // Preset / enum typos (silent fallbacks at runtime otherwise).
  if (scene) {
    const cam = scene.camera && scene.camera.preset;
    if (cam && !STRICT.cameraPresets.has(cam)) add('camera-preset', `unknown camera.preset "${cam}"`);
    const lp = scene.lighting && scene.lighting.preset;
    if (lp && !STRICT.lightingPresets.has(lp)) add('lighting-preset', `unknown lighting.preset "${lp}"`);
    const env = scene.lighting && scene.lighting.environment;
    if (env && !STRICT.environments.has(env)) add('lighting-environment', `unknown lighting.environment "${env}"`);
    const tm = scene.toneMapping;
    if (tm && !STRICT.toneMappings.has(String(tm).toLowerCase())) add('tonemapping', `unknown toneMapping "${tm}"`);
  }

  // Metals/glass need image-based lighting to read.
  const env = scene && scene.lighting && scene.lighting.environment;
  const hasEnv = env && env !== 'none';
  if (!hasEnv) {
    const metal = geomParts.find((p) => isMetal(p.material) && !partIgnores(p, 'metal-no-env'));
    if (metal) add('metal-no-env', `metallic material on "${metal.name}" but no scene.lighting.environment — chrome/steel/glass won't read`);
  }

  // Emissive budget — 1–3 controlled accents, not wallpaper.
  const emissive = geomParts.filter((p) => isEmissive(p.material));
  if (emissive.length > STRICT.emissiveBudget) {
    add('emissive-budget', `${emissive.length} emissive materials (skill: 1–3 accents) — e.g. ${emissive.slice(0, 4).map((p) => p.name).join(', ')}…`);
  }

  // Material breakup on primary non-emissive surfaces at standard/high.
  const quality = scene && scene.quality;
  if (quality === 'standard' || quality === 'high') {
    for (const p of geomParts) {
      if (!STRICT.structuralTypes.has(p.type)) continue;
      // Polished metal/glass trim is intentionally smooth — breakup is for
      // painted/matte primary surfaces, not chrome or brass.
      if (isEmissive(p.material) || isMetal(p.material) || partIgnores(p, 'breakup')) continue;
      const dims = (p.params || []).slice(0, 3).filter((n) => typeof n === 'number');
      const big = dims.some((n) => n >= 0.3);
      // Exclude paper-thin sheets (seams, decal overlays, trim lips): they read
      // as lines/planes, not primary painted volume that wants breakup.
      const thin = dims.length >= 3 && Math.min(...dims) < 0.015;
      const hasMat = p.material && (p.material.preset || p.material.color);
      if (big && !thin && hasMat && !(p.material && p.material.breakup)) {
        add('breakup', `"${p.name}" is a large ${p.type} at quality:${quality} with no material.breakup`);
        break; // one representative finding, not a wall
      }
    }
  }

  // Clone-read: N identical name_1..name_N siblings (no per-copy variation).
  const groups = new Map();
  for (const p of geomParts) {
    const m = /^(.*?)[_-]?\d+$/.exec(p.name || '');
    if (!m || !m[1]) continue;
    const key = m[1];
    const sig = JSON.stringify([p.material || null, p.scale || null, p.rotation || null, p.type]);
    if (!groups.has(key)) groups.set(key, new Map());
    const sigs = groups.get(key);
    sigs.set(sig, (sigs.get(sig) || 0) + 1);
  }
  for (const [key, sigs] of groups) {
    for (const [, count] of sigs) {
      if (count >= 3 && !specIgnores(spec, 'clone-read')) {
        add('clone-read', `${count} "${key}N" siblings share identical material/scale/rotation — vary them or use an array modifier`);
        break;
      }
    }
  }

  // Ground contact heuristic: does anything sit near the floor?
  const byName = new Map(flatParts.map((p) => [p.name, p]));
  const grounded = geomParts.filter((p) => !partIgnores(p, 'ground-contact') && halfHeightY(p) > 0);
  if (grounded.length) {
    const minBottom = Math.min(...grounded.map((p) => worldY(p, byName) - halfHeightY(p)));
    if (minBottom > STRICT.groundEps) {
      add('ground-contact', `lowest geometry sits ${minBottom.toFixed(3)} above y=0 — asset may float (heuristic; ignores rotation)`);
    }
  }
}

function validateSpec(specPath, strict = false) {
  const issues = [];
  const warnings = [];

  let spec;
  try {
    const content = fs.readFileSync(specPath, 'utf8');
    spec = JSON.parse(content);
  } catch (err) {
    return { valid: false, issues: [`Failed to parse JSON: ${err.message}`], warnings: [] };
  }

  if (!spec.name) {
    issues.push('Missing required field: name');
  }

  if (spec.scene) {
    validateSceneSettings(spec.scene, issues, warnings);
  }

  validatePoses(spec, issues, warnings);
  validateClips(spec, issues, warnings);

  const strictFindings = [];

  if (spec.type === 'csg') {
    validateCSGSpec(spec, issues, warnings);
    if (strict) runStrictLints(spec, flattenParts(spec.parts || []), strictFindings);
    return { valid: issues.length === 0, issues, warnings, strict: strictFindings };
  }

  if (!spec.parts || !Array.isArray(spec.parts)) {
    issues.push('Missing or invalid field: parts (should be array)');
    return { valid: false, issues, warnings, strict: strictFindings };
  }

  const modules = normalizeModules(spec.modules);
  const refs = { moduleNames: new Set(modules.map((m) => m.name).filter(Boolean)) };

  validatePartCollection(spec.parts, issues, warnings, 'spec', refs);

  for (const moduleDef of modules) {
    if (!moduleDef.name) {
      issues.push('Module missing name');
      continue;
    }
    if (!Array.isArray(moduleDef.parts)) {
      issues.push(`[module:${moduleDef.name}] parts must be an array`);
      continue;
    }
    validatePartCollection(moduleDef.parts, issues, warnings, `module:${moduleDef.name}`, refs);
  }

  if (strict) runStrictLints(spec, flattenParts(spec.parts), strictFindings);

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    strict: strictFindings
  };
}

function expandArgs(args) {
  const files = [];
  for (const arg of args) {
    if (path.basename(arg) === 'index.json') continue; // the viewer manifest, not a spec
    if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
      files.push(arg);
    }
  }
  return files;
}

function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const args = argv.filter((a) => a !== '--strict');

  if (args.length === 0) {
    console.log('Usage: node validate-spec.js [--strict] <spec-file.json> [more-files...]');
    console.log('       node validate-spec.js specs/*.json');
    console.log('  --strict  also run the quality-rule lint tier (warnings only)');
    process.exit(1);
  }

  const files = expandArgs(args);
  if (files.length === 0) {
    console.error('No input files found');
    process.exit(1);
  }

  let totalIssues = 0;
  let totalWarnings = 0;
  let totalStrict = 0;

  for (const file of files) {
    console.log(`\n📄 ${path.basename(file)}`);
    console.log('─'.repeat(40));

    const result = validateSpec(file, strict);

    if (result.issues.length > 0) {
      console.log('❌ Issues:');
      result.issues.forEach((issue) => console.log(`   ${issue}`));
      totalIssues += result.issues.length;
    }

    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach((warning) => console.log(`   ${warning}`));
      totalWarnings += result.warnings.length;
    }

    if (strict && result.strict && result.strict.length > 0) {
      console.log('🔎 Strict:');
      result.strict.forEach((s) => console.log(`   ${s}`));
      totalStrict += result.strict.length;
    }

    if (result.valid && result.warnings.length === 0 && (!strict || !result.strict || result.strict.length === 0)) {
      console.log('✅ Valid');
    } else if (result.valid) {
      console.log('✅ Valid (with warnings)');
    }
  }

  console.log('\n' + '═'.repeat(40));
  console.log(`Total: ${totalIssues} issues, ${totalWarnings} warnings${strict ? `, ${totalStrict} strict` : ''}`);

  // Strict findings never fail the build — they are advisory warnings.
  process.exit(totalIssues > 0 ? 1 : 0);
}

main();
