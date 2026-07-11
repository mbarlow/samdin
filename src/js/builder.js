/**
 * builder.js - JSON spec to Three.js model converter
 * Takes a declarative spec and builds a hierarchical model
 * Supports:
 * - parts-based (primitives)
 * - CSG (boolean operations)
 * - CSG primitives (complex shapes as primitives)
 */
import * as THREE from 'three';
import { Primitives, Materials, ModelAssembler } from './primitives.js';
import { buildCSG } from './CSGBuilder.js';
import { CSGPrimitives, CSG_PRIMITIVE_TYPES } from './CSGPrimitives.js';
import { applyTerrainCompositor } from './terrain-compositor.js';
import { buildLoftGeometry } from './loft.js';
import { buildPolyMeshGeometry } from './polymesh.js';
import { applyDeform } from './deform.js';
import { flipNormalsOnObject } from './terrain/sampler.js';

/**
 * Model spec format:
 * {
 *   name: "drone",
 *   parts: [
 *     {
 *       name: "body",
 *       type: "box",          // primitive type
 *       params: [1, 0.3, 1],  // constructor args
 *       options: { pivot: "center" },
 *       material: { color: "#333333", metalness: 0.5 },
 *       position: [0, 0, 0],
 *       rotation: [0, 0, 0],  // degrees
 *       scale: 1,
 *       parent: null         // or parent part name
 *     },
 *     ...
 *   ],
 *   clips: { ... }       // optional joint animation clips
 * }
 */

// Default region rules for auto-populating
const REGION_RULES = {
  street: {
    allowedPrefabs: ['tuk-tuk', 'motorbike'],
    density: 0.3,
    yOffset: 0
  },
  sidewalk: {
    allowedPrefabs: ['street-vendor', 'street-lamp'],
    density: 0.4,
    yOffset: 0.15
  },
  parking: {
    allowedPrefabs: ['tuk-tuk', 'motorbike'],
    density: 0.5,
    yOffset: 0
  },
  plaza: {
    allowedPrefabs: ['street-vendor', 'street-lamp'],
    density: 0.2,
    yOffset: 0
  }
};

// Quality tier segment multipliers
const QUALITY_TIERS = {
  draft:    { segMul: 1.0, sphereDetail: 0, label: 'Draft' },
  standard: { segMul: 2.0, sphereDetail: 1, label: 'Standard' },
  high:     { segMul: 3.0, sphereDetail: 2, label: 'High' }
};

class ModelBuilder {
  constructor() {
    this.specs = new Map();
    this.prefabs = new Map();
    this.prefabsBasePath = './prefabs/';
    this.regionRules = { ...REGION_RULES };
    this.qualityTier = 'standard'; // matches the UI default and the docs' breakup promises
  }

  setQualityTier(tier) {
    if (QUALITY_TIERS[tier]) {
      this.qualityTier = tier;
    }
  }

  getQualityTier() {
    return this.qualityTier;
  }

  getQualityTierNames() {
    return Object.entries(QUALITY_TIERS).map(([k, v]) => ({ value: k, label: v.label }));
  }

  /**
   * Register custom region rules
   */
  registerRegionRule(regionType, rule) {
    this.regionRules[regionType] = rule;
  }

  /**
   * Set the base path for prefab files
   */
  setPrefabsPath(path) {
    this.prefabsBasePath = path.endsWith('/') ? path : path + '/';
  }

  /**
   * Register a prefab for use in scenes
   */
  registerPrefab(prefab) {
    this.prefabs.set(prefab.name, prefab);
  }

  /**
   * Load a prefab from URL
   */
  async loadPrefab(name) {
    if (this.prefabs.has(name)) {
      return this.prefabs.get(name);
    }
    try {
      const response = await fetch(`${this.prefabsBasePath}${name}.json`);
      const prefab = await response.json();
      this.registerPrefab(prefab);
      return prefab;
    } catch (err) {
      console.error(`Failed to load prefab: ${name}`, err);
      return null;
    }
  }

  /**
   * Instantiate a prefab with position/rotation/scale overrides
   */
  instantiatePrefab(prefabDef, parentName = null) {
    const prefab = this.prefabs.get(prefabDef.src);
    if (!prefab) {
      console.error(`Prefab not found: ${prefabDef.src}`);
      return [];
    }

    const instanceId = prefabDef.name || `${prefabDef.src}_${Date.now()}`;
    const parts = [];

    for (const part of prefab.parts) {
      const newPart = JSON.parse(JSON.stringify(part)); // Deep clone

      // Rename part to avoid collisions
      const originalName = newPart.name;
      newPart.name = `${instanceId}_${originalName}`;

      // Update parent reference
      if (newPart.parent) {
        newPart.parent = `${instanceId}_${newPart.parent}`;
      } else if (originalName === prefab.root) {
        // Root part - apply transforms and set parent
        newPart.parent = parentName || prefabDef.parent;
        if (prefabDef.position) newPart.position = prefabDef.position;
        if (prefabDef.rotation) newPart.rotation = prefabDef.rotation;
        if (prefabDef.scale) newPart.scale = prefabDef.scale;
      }

      // Apply color override if specified
      if (prefabDef.color && newPart.material) {
        newPart.material.color = prefabDef.color;
      }

      parts.push(newPart);
    }

    return parts;
  }
  
  /**
   * Register a spec for later building
   */
  registerSpec(spec) {
    this.specs.set(spec.name, spec);
  }

  /**
   * Returns whether a spec is buildable by the runtime.
   */
  canBuildSpec(spec) {
    if (!spec || !spec.name) return false;
    if (spec.type === 'csg') {
      return !!spec.shapes && !!(spec.output || spec.outputs);
    }
    return Array.isArray(spec.parts);
  }

  /**
   * Normalize nested/aliased spec structures into the flat runtime format.
   */
  normalizeSpec(spec) {
    const normalized = JSON.parse(JSON.stringify(spec));

    if (Array.isArray(normalized.parts)) {
      normalized.parts = this.flattenParts(normalized.parts);
    }

    if (normalized.modules) {
      if (Array.isArray(normalized.modules)) {
        normalized.modules = normalized.modules.map((moduleDef) => ({
          ...moduleDef,
          parts: this.flattenParts(moduleDef.parts || [])
        }));
      } else {
        for (const [name, moduleDef] of Object.entries(normalized.modules)) {
          normalized.modules[name] = {
            name,
            ...moduleDef,
            parts: this.flattenParts(moduleDef.parts || [])
          };
        }
      }
    }

    return normalized;
  }

  /**
   * Flatten nested `children` arrays into the viewer's flat parts format.
   */
  flattenParts(parts, inheritedParent = null) {
    const flattened = [];

    for (const part of parts || []) {
      const clone = JSON.parse(JSON.stringify(part));
      const children = Array.isArray(clone.children) ? clone.children : [];
      delete clone.children;

      if (inheritedParent && !clone.parent) {
        clone.parent = inheritedParent;
      }

      flattened.push(clone);

      if (children.length > 0) {
        flattened.push(...this.flattenParts(children, clone.name));
      }
    }

    return flattened;
  }

  /**
   * Resolve top-level module definitions into a lookup map.
   */
  getModuleMap(spec) {
    const modules = new Map();

    if (!spec?.modules) {
      return modules;
    }

    if (Array.isArray(spec.modules)) {
      for (const moduleDef of spec.modules) {
        if (!moduleDef?.name) continue;
        modules.set(moduleDef.name, moduleDef);
      }
      return modules;
    }

    for (const [name, moduleDef] of Object.entries(spec.modules)) {
      modules.set(name, {
        name,
        ...moduleDef
      });
    }

    return modules;
  }
  
  /**
   * Build a model from a spec object
   */
  async build(spec) {
    // Honor the spec's own quality tier BEFORE generating geometry. It used to
    // be applied post-build (via applySpecSettings on setModel), so a cold
    // first build fell back to the current tier and scene.quality only took
    // effect on the next rebuild — making output depend on session warmth.
    if (spec?.scene?.quality) {
      this.setQualityTier(spec.scene.quality);
    }

    const normalized = this.normalizeSpec(spec);

    // Check spec type
    if (normalized.type === 'csg') {
      return this.buildCSG(normalized);
    }

    // Standard parts-based build
    return await this.buildParts(normalized);
  }

  /**
   * Build a CSG model using boolean operations
   */
  buildCSG(spec) {
    console.log('[Builder] Building CSG model:', spec.name);
    const tier = QUALITY_TIERS[this.qualityTier] || QUALITY_TIERS.draft;
    return buildCSG(spec, { segMul: tier.segMul });
  }

  /**
   * Build a parts-based model
   */
  async buildParts(spec) {
    const assembler = new ModelAssembler();
    this.pendingPoses = [];

    if (!Array.isArray(spec.parts)) {
      console.error('[Builder] Parts-based spec is missing a parts array:', spec.name);
      return null;
    }

    const expandedParts = await this.resolveParts(spec.parts, spec);

    // Sort parts by dependency (parents before children)
    const sortedParts = this.sortByDependency(expandedParts);

    for (const partDef of sortedParts) {
      const mesh = this.createPart(partDef);
      if (mesh) {
        assembler.addPart(
          partDef.name,
          mesh,
          partDef.parent || null,
          {
            position: partDef.position,
            rotation: partDef.rotation,
            scale: partDef.scale
          }
        );
      }
    }

    const model = assembler.getModel();
    model.name = spec.name;
    model.userData.spec = spec;
    model.userData.parts = assembler.getAnimatableParts();

    this.applyPoses(model, spec);
    model.userData.animations = this.buildAnimationClips(model, spec);
    applyTerrainCompositor(model, spec);
    this.applyGroundSnap(model);

    return model;
  }

  /**
   * Compile readable spec keyframes into Three.js clips. Track targets are
   * joint names, optionally expanded across named top-level placements.
   */
  buildAnimationClips(model, spec) {
    if (!spec.clips || typeof spec.clips !== 'object') return [];

    const clips = [];
    const euler = new THREE.Euler();
    const quaternion = new THREE.Quaternion();

    for (const [clipName, clipDef] of Object.entries(spec.clips)) {
      const tracks = [];
      const prefixes = clipDef.instances?.length ? clipDef.instances : [''];

      for (const prefix of prefixes) {
        for (const [joint, channels] of Object.entries(clipDef.tracks || {})) {
          const nodeName = prefix ? `${prefix}_${joint}` : joint;
          if (!model.getObjectByName(nodeName)) {
            console.warn(`[clip:${clipName}] joint not found: ${nodeName}`);
            continue;
          }

          if (Array.isArray(channels.rotation)) {
            const times = [];
            const values = [];
            for (const [time, degrees] of channels.rotation) {
              times.push(time);
              euler.set(
                THREE.MathUtils.degToRad(degrees[0]),
                THREE.MathUtils.degToRad(degrees[1]),
                THREE.MathUtils.degToRad(degrees[2]),
                'XYZ'
              );
              quaternion.setFromEuler(euler);
              values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
            }
            tracks.push(new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values));
          }

          if (Array.isArray(channels.position)) {
            const times = [];
            const values = [];
            for (const [time, position] of channels.position) {
              times.push(time);
              values.push(position[0], position[1], position[2]);
            }
            tracks.push(new THREE.VectorKeyframeTrack(`${nodeName}.position`, times, values));
          }
        }
      }

      if (tracks.length) {
        clips.push(new THREE.AnimationClip(clipName, clipDef.duration ?? -1, tracks));
      }
    }

    return clips;
  }

  /**
   * Named poses (#82): spec-level `poses: { name: { jointName: [rx,ry,rz] } }`
   * with degrees applied ADDITIVELY to the joint group's authored rotation.
   * Activate with spec-level `pose: "name"`, or per module/prefab placement
   * (`pose` on the placement; joint names are then resolved with the
   * placement's name prefix). Unknown joints warn, don't fail.
   */
  applyPoses(model, spec) {
    const poses = spec.poses || {};
    const jobs = [];
    if (spec.pose) {
      if (poses[spec.pose]) jobs.push({ prefix: '', def: poses[spec.pose] });
      else console.warn(`[pose] unknown spec pose: ${spec.pose}`);
    }
    for (const pending of this.pendingPoses || []) {
      if (poses[pending.pose]) jobs.push({ prefix: pending.prefix, def: poses[pending.pose] });
      else console.warn(`[pose] unknown pose "${pending.pose}" on placement ${pending.prefix}`);
    }
    if (!jobs.length) return;

    for (const job of jobs) {
      for (const [joint, rot] of Object.entries(job.def)) {
        const nodeName = job.prefix ? `${job.prefix}_${joint}` : joint;
        const node = model.getObjectByName(nodeName);
        if (!node) {
          console.warn(`[pose] joint not found: ${nodeName}`);
          continue;
        }
        node.rotation.x += THREE.MathUtils.degToRad(rot[0] || 0);
        node.rotation.y += THREE.MathUtils.degToRad(rot[1] || 0);
        node.rotation.z += THREE.MathUtils.degToRad(rot[2] || 0);
      }
    }
    model.updateMatrixWorld(true);
  }

  /**
   * Carry a module/prefab placement's snapToGround/groundOffset onto the
   * instantiated composite root, so placements ground-snap like plain parts.
   */
  propagatePlacementGrounding(placement, compositeDef, expandedParts) {
    if (placement.snapToGround === undefined || !compositeDef?.root) return;
    const rootName = `${placement.name}_${compositeDef.root}`;
    const rootPart = expandedParts.find((p) => p.name === rootName);
    if (rootPart) {
      rootPart.snapToGround = placement.snapToGround;
      if (placement.groundOffset !== undefined) rootPart.groundOffset = placement.groundOffset;
    }
  }

  /**
   * Snap flagged parts onto the ground (#79). Ground preference: the generated
   * __terrain__ mesh → category:"environment" meshes (raycast works even when
   * display:"terrain" hides them) → world y=0. Moves each flagged object so
   * its bounding-box bottom sits at the hit point plus groundOffset.
   */
  applyGroundSnap(model) {
    const snappers = [];
    model.traverse((o) => {
      if (o.userData?.snapToGround) snappers.push(o);
    });
    if (!snappers.length) return;

    model.updateMatrixWorld(true);

    const terrain = [];
    const env = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === '__terrain__') terrain.push(o);
      else if (o.userData?.category === 'environment') env.push(o);
    });

    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const bbox = new THREE.Box3();

    for (const object of snappers) {
      bbox.setFromObject(object);
      if (bbox.isEmpty()) continue;
      const cx = (bbox.min.x + bbox.max.x) / 2;
      const cz = (bbox.min.z + bbox.max.z) / 2;
      raycaster.set(new THREE.Vector3(cx, bbox.max.y + 100, cz), down);

      const inSelf = (obj) => {
        for (let p = obj; p; p = p.parent) if (p === object) return true;
        return false;
      };
      const hitsOf = (candidates) =>
        raycaster.intersectObjects(candidates, false).filter((h) => !inSelf(h.object));

      let groundY = 0;
      const hits = hitsOf(terrain);
      const envHits = hits.length ? [] : hitsOf(env);
      if (hits.length) groundY = hits[0].point.y;
      else if (envHits.length) groundY = envHits[0].point.y;

      const offset = object.userData.groundOffset || 0;
      const deltaWorld = groundY - bbox.min.y + offset;
      const parentScaleY = object.parent
        ? object.parent.getWorldScale(new THREE.Vector3()).y || 1
        : 1;
      object.position.y += deltaWorld / parentScaleY;
      object.updateMatrixWorld(true);
    }
  }

  /**
   * Expand prefab references into actual parts
   */
  async expandPrefabs(parts) {
    const expanded = [];
    for (const part of parts) {
      if (part.type === 'prefab') {
        // Load prefab if not already loaded
        await this.loadPrefab(part.src);
        const prefab = this.prefabs.get(part.src);
        const prefabParts = this.instantiateComposite(part, prefab, part.parent);
        expanded.push(...prefabParts);
      } else {
        expanded.push(part);
      }
    }
    return expanded;
  }

  /**
   * Resolve scene parts through regions, modifiers, modules, and prefabs.
   */
  async resolveParts(parts, spec, depth = 0) {
    if (depth > 24) {
      throw new Error('Exceeded composite expansion depth while resolving parts');
    }

    const regionExpanded = this.expandRegions(parts);
    const proceduralExpanded = this.expandProcedural(regionExpanded);
    return await this.expandCompositeRefs(proceduralExpanded, spec, depth);
  }

  /**
   * Expand spec-local modules and file-backed prefabs recursively.
   */
  async expandCompositeRefs(parts, spec, depth = 0) {
    const expanded = [];
    const modules = this.getModuleMap(spec);

    for (const part of parts) {
      if (part.type === 'module') {
        const moduleName = part.src || part.module || part.ref;
        const moduleDef = modules.get(moduleName);

        if (!moduleDef) {
          console.error(`Module not found: ${moduleName}`);
          continue;
        }

        if (part.pose) (this.pendingPoses ||= []).push({ prefix: part.name, pose: part.pose });
        const moduleParts = this.instantiateComposite(part, moduleDef, part.parent);
        this.propagatePlacementGrounding(part, moduleDef, moduleParts);
        const resolvedParts = await this.resolveParts(moduleParts, spec, depth + 1);
        expanded.push(...resolvedParts);
        continue;
      }

      if (part.type === 'prefab') {
        if (part.pose) (this.pendingPoses ||= []).push({ prefix: part.name, pose: part.pose });
        await this.loadPrefab(part.src);
        const prefab = this.prefabs.get(part.src);
        const prefabParts = this.instantiateComposite(part, prefab, part.parent);
        this.propagatePlacementGrounding(part, prefab, prefabParts);
        const resolvedParts = await this.resolveParts(prefabParts, spec, depth + 1);
        expanded.push(...resolvedParts);
        continue;
      }

      expanded.push(part);
    }

    return expanded;
  }

  /**
   * Instantiate a prefab or local module with namespaced child parts.
   */
  instantiateComposite(instanceDef, composite, parentName = null) {
    if (!composite?.parts || !Array.isArray(composite.parts)) {
      console.error('Composite is missing a parts array:', composite?.name);
      return [];
    }

    const instanceId = instanceDef.name || `${instanceDef.src || composite.name}_${Date.now()}`;
    const rootName = composite.root || composite.parts[0]?.name;
    const partOverrides = instanceDef.partOverrides || instanceDef.overrides || {};
    const materialOverride = instanceDef.materialOverride || null;
    const parts = [];

    for (const part of composite.parts) {
      const newPart = JSON.parse(JSON.stringify(part));
      const originalName = newPart.name;
      const override = partOverrides[originalName];

      newPart.name = `${instanceId}_${originalName}`;

      if (newPart.parent) {
        newPart.parent = `${instanceId}_${newPart.parent}`;
      } else if (originalName === rootName) {
        newPart.parent = parentName || instanceDef.parent;
        if (instanceDef.position) newPart.position = instanceDef.position;
        if (instanceDef.rotation) newPart.rotation = instanceDef.rotation;
        if (instanceDef.scale) newPart.scale = instanceDef.scale;
      }

      if (instanceDef.color) {
        newPart.material = {
          ...(newPart.material || {}),
          color: instanceDef.color
        };
      }

      if (materialOverride) {
        newPart.material = {
          ...(newPart.material || {}),
          ...materialOverride
        };
      }

      if (override) {
        if (override.material) {
          newPart.material = {
            ...(newPart.material || {}),
            ...override.material
          };
        }
        Object.assign(newPart, {
          ...override,
          material: newPart.material
        });
      }

      parts.push(newPart);
    }

    return parts;
  }

  /**
   * Expand procedural modifiers (array, mirror, scatter)
   */
  expandProcedural(parts) {
    const expanded = [];
    for (const part of parts) {
      const modifiers = part.modifiers || {};

      if (part.array || modifiers.array) {
        expanded.push(...this.expandArray({
          ...part,
          array: part.array || modifiers.array
        }));
      } else if (part.mirror || modifiers.mirror) {
        expanded.push(...this.expandMirror({
          ...part,
          mirror: part.mirror || modifiers.mirror
        }));
      } else if (part.scatter || modifiers.scatter) {
        expanded.push(...this.expandScatter({
          ...part,
          scatter: part.scatter || modifiers.scatter
        }));
      } else {
        expanded.push(part);
      }
    }
    return expanded;
  }

  /**
   * Array modifier - duplicate part in a line or grid
   * Usage: { ..., array: { count: 5, offset: [1, 0, 0] } }
   *    or: { ..., array: { count: [3, 2], offset: [1, 0, 2] } } for grid
   */
  /**
   * Per-instance jitter for array clones (#80): seeded rotation/scale/offset/
   * tone variation so grids and rows don't read as clones.
   *   jitter: { rotation: [x,y,z] ±deg, scale: ±fraction, offset: [x,y,z] ±m, tone: ±fraction }
   */
  applyArrayJitter(newPart, array, idx) {
    const jitter = array.jitter;
    if (!jitter) return;
    const seed = array.seed ?? 1;
    const rand = (k) => {
      const x = Math.sin(seed + idx * 17.23 + k * 3.77) * 10000;
      return (x - Math.floor(x)) * 2 - 1; // [-1, 1]
    };

    if (Array.isArray(jitter.offset)) {
      for (let a = 0; a < 3; a++) {
        newPart.position[a] += rand(a) * (jitter.offset[a] || 0);
      }
    }
    if (Array.isArray(jitter.rotation)) {
      newPart.rotation = newPart.rotation || [0, 0, 0];
      for (let a = 0; a < 3; a++) {
        newPart.rotation[a] = (newPart.rotation[a] || 0) + rand(3 + a) * (jitter.rotation[a] || 0);
      }
    }
    if (typeof jitter.scale === 'number' && jitter.scale > 0) {
      const f = 1 + rand(6) * jitter.scale;
      const base = newPart.scale;
      if (Array.isArray(base)) newPart.scale = base.map((v) => v * f);
      else newPart.scale = (base || 1) * f;
    }
    if (typeof jitter.tone === 'number' && jitter.tone > 0 && newPart.material?.color) {
      const hex = newPart.material.color.replace('#', '');
      if (hex.length === 6) {
        const f = 1 + rand(7) * jitter.tone;
        const shifted = [0, 2, 4]
          .map((i) => Math.round(Math.min(255, Math.max(0, parseInt(hex.slice(i, i + 2), 16) * f))))
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');
        newPart.material.color = `#${shifted}`;
      }
    }
  }

  expandArray(part) {
    const { array, modifiers, ...basePart } = part;
    if (Array.isArray(array.path) && array.path.length >= 2) {
      return this.expandArrayAlongPath(part);
    }
    const count = Array.isArray(array.count) ? array.count : [array.count, 1, 1];
    const offset = array.offset || [1, 0, 0];
    const results = [];

    for (let x = 0; x < count[0]; x++) {
      for (let y = 0; y < (count[1] || 1); y++) {
        for (let z = 0; z < (count[2] || 1); z++) {
          const idx = x + y * count[0] + z * count[0] * (count[1] || 1);
          const newPart = JSON.parse(JSON.stringify(basePart));
          newPart.name = `${basePart.name}_${idx}`;

          const basePos = basePart.position || [0, 0, 0];
          newPart.position = [
            basePos[0] + x * offset[0],
            basePos[1] + y * offset[1],
            basePos[2] + z * offset[2]
          ];
          this.applyArrayJitter(newPart, array, idx);
          if (array.snapToGround !== undefined) newPart.snapToGround = array.snapToGround;
          results.push(newPart);
        }
      }
    }
    return results;
  }

  /**
   * Array along a path (#79): sample `count` instances along a Catmull-Rom
   * curve through the waypoints (parent-space coords). `orient: true`
   * (default) yaws each instance to face along the local tangent.
   * Usage: { array: { path: [[x,y,z], ...], count: 8, orient: true } }
   */
  expandArrayAlongPath(part) {
    const { array, modifiers, ...basePart } = part;
    const pts = array.path.map((p) => new THREE.Vector3(p[0], p[1] ?? 0, p[2]));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const count = Math.max(2, Array.isArray(array.count) ? array.count[0] : (array.count || pts.length));
    const orient = array.orient !== false;
    const results = [];

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const pos = curve.getPoint(t);
      const newPart = JSON.parse(JSON.stringify(basePart));
      newPart.name = `${basePart.name}_${i}`;
      newPart.position = [pos.x, pos.y, pos.z];
      if (orient) {
        const tan = curve.getTangent(t);
        const yaw = Math.atan2(tan.x, tan.z) * (180 / Math.PI);
        newPart.rotation = newPart.rotation || [0, 0, 0];
        newPart.rotation[1] = (newPart.rotation[1] || 0) + yaw;
      }
      this.applyArrayJitter(newPart, array, i);
      if (array.snapToGround !== undefined) newPart.snapToGround = array.snapToGround;
      results.push(newPart);
    }
    return results;
  }

  /**
   * Mirror modifier - duplicate part across an axis
   * Usage: { ..., mirror: { axis: 'x' } } or { axis: 'xz' }
   */
  expandMirror(part) {
    const { mirror, modifiers, ...basePart } = part;
    const axes = mirror.axis || [
      mirror.x ? 'x' : '',
      mirror.y ? 'y' : '',
      mirror.z ? 'z' : ''
    ].join('') || 'x';
    const results = [basePart];

    const basePos = basePart.position || [0, 0, 0];
    const baseRot = basePart.rotation || [0, 0, 0];

    // Mirror on each specified axis
    const mirrorVariants = [];
    if (axes.includes('x')) mirrorVariants.push({ posIdx: 0, rotIdx: 1 });
    if (axes.includes('y')) mirrorVariants.push({ posIdx: 1, rotIdx: 0 });
    if (axes.includes('z')) mirrorVariants.push({ posIdx: 2, rotIdx: 1 });

    // Generate all combinations of mirrors
    const combos = Math.pow(2, mirrorVariants.length) - 1;
    for (let i = 1; i <= combos; i++) {
      const newPart = JSON.parse(JSON.stringify(basePart));
      newPart.name = `${basePart.name}_mirror_${i}`;
      newPart.position = [...basePos];
      newPart.rotation = [...baseRot];

      for (let j = 0; j < mirrorVariants.length; j++) {
        if (i & (1 << j)) {
          const { posIdx, rotIdx } = mirrorVariants[j];
          newPart.position[posIdx] = -newPart.position[posIdx];
          // Flip rotation for symmetry
          if (posIdx === 0) newPart.rotation[1] = -newPart.rotation[1];
          if (posIdx === 2) newPart.rotation[1] = 180 - newPart.rotation[1];
        }
      }
      results.push(newPart);
    }
    return results;
  }

  /**
   * Scatter modifier - randomly place copies within a region
   * Usage: { ..., scatter: { count: 10, bounds: [[-5, 5], [0, 0], [-5, 5]], seed: 123 } }
   */
  expandScatter(part) {
    const { scatter, modifiers, ...basePart } = part;
    const count = scatter.count || 5;
    const center = scatter.center || basePart.position || [0, 0, 0];
    const radius = scatter.radius;
    const bounds = scatter.bounds || (
      radius !== undefined
        ? [
            [center[0] - radius, center[0] + radius],
            [center[1], center[1] + (scatter.height || 0)],
            [center[2] - radius, center[2] + radius]
          ]
        : [[-5, 5], [0, 0], [-5, 5]]
    );
    const seed = scatter.seed || Date.now();
    const randomRotation = scatter.randomRotation !== false;
    const results = [];

    // Simple seeded random
    const seededRandom = (s) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < count; i++) {
      const newPart = JSON.parse(JSON.stringify(basePart));
      newPart.name = `${basePart.name}_scatter_${i}`;

      const s = seed + i * 3;
      newPart.position = [
        bounds[0][0] + seededRandom(s) * (bounds[0][1] - bounds[0][0]),
        bounds[1][0] + seededRandom(s + 1) * (bounds[1][1] - bounds[1][0]),
        bounds[2][0] + seededRandom(s + 2) * (bounds[2][1] - bounds[2][0])
      ];

      if (randomRotation) {
        newPart.rotation = newPart.rotation || [0, 0, 0];
        newPart.rotation[1] = seededRandom(s + 3) * 360;
      }

      // Optional scale variation
      if (scatter.scaleVariation) {
        const scaleVar = scatter.scaleVariation;
        const scaleFactor = 1 + (seededRandom(s + 4) - 0.5) * 2 * scaleVar;
        newPart.scale = (basePart.scale || 1) * scaleFactor;
      }

      if (scatter.snapToGround !== undefined) newPart.snapToGround = scatter.snapToGround;

      results.push(newPart);
    }
    return results;
  }

  /**
   * Expand semantic regions into prefab instances
   * Usage: { type: "region", regionType: "sidewalk", bounds: [[-5, 5], [0, 0], [-3, -2]], seed: 42 }
   */
  expandRegions(parts) {
    const expanded = [];
    for (const part of parts) {
      if (part.type === 'region') {
        expanded.push(...this.expandRegion(part));
      } else {
        expanded.push(part);
      }
    }
    return expanded;
  }

  /**
   * Expand a single region into prefab instances
   */
  expandRegion(regionDef) {
    const { regionType, bounds, seed = 42, density, prefabs: customPrefabs } = regionDef;
    const rule = this.regionRules[regionType];

    if (!rule && !customPrefabs) {
      console.warn(`Unknown region type: ${regionType}`);
      return [];
    }

    const allowedPrefabs = customPrefabs || rule.allowedPrefabs;
    const regionDensity = density ?? rule?.density ?? 0.3;
    const yOffset = rule?.yOffset ?? 0;

    // Calculate region size
    const sizeX = bounds[0][1] - bounds[0][0];
    const sizeZ = bounds[2][1] - bounds[2][0];
    const area = sizeX * sizeZ;

    // Number of items based on density (items per square unit)
    const count = Math.floor(area * regionDensity);

    const results = [];
    const seededRandom = (s) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < count; i++) {
      const s = seed + i * 5;

      // Pick a random prefab from allowed list
      const prefabIdx = Math.floor(seededRandom(s) * allowedPrefabs.length);
      const prefabName = allowedPrefabs[prefabIdx];

      const prefabPart = {
        name: `${regionDef.name || regionType}_${prefabName}_${i}`,
        type: 'prefab',
        src: prefabName,
        position: [
          bounds[0][0] + seededRandom(s + 1) * sizeX,
          bounds[1][0] + yOffset,
          bounds[2][0] + seededRandom(s + 2) * (bounds[2][1] - bounds[2][0])
        ],
        rotation: [0, seededRandom(s + 3) * 360, 0],
        parent: regionDef.parent
      };

      results.push(prefabPart);
    }

    return results;
  }

  /**
   * Build from a registered spec name
   */
  async buildByName(name) {
    const spec = this.specs.get(name);
    if (!spec) {
      console.error(`Spec '${name}' not found`);
      return null;
    }
    return await this.build(spec);
  }
  
  /**
   * Create a single part mesh from definition
   */
  createPart(def) {
    // Handle group type (container only, no geometry)
    if (def.type === 'group') {
      return this.finalizePart(new THREE.Group(), def);
    }

    // Resolve material
    let material;
    if (def.material) {
      const m = def.material;
      if (m.preset) {
        // Try the new preset system first
        const presetMat = Materials.getPreset(
          m.preset,
          m.color ? this.parseColor(m.color) : undefined,
          m.emissiveIntensity || m.intensity,
          m
        );
        if (presetMat) {
          material = presetMat;
        } else {
          // Fallback for unknown presets
          console.warn(`Unknown material preset: ${m.preset}`);
          material = Materials.create({
            color: this.parseColor(m.color || '#888888'),
            metalness: m.metalness ?? 0.3,
            roughness: m.roughness ?? 0.7,
            opacity: m.opacity,
            transparent: m.transparent,
            flatShading: m.flatShading
          });
        }
      } else {
        material = Materials.create({
          color: this.parseColor(m.color || '#888888'),
          metalness: m.metalness ?? 0.3,
          roughness: m.roughness ?? 0.7,
          emissive: this.parseColor(m.emissive || '#000000'),
          emissiveIntensity: m.emissiveIntensity ?? 1,
          flatShading: m.flatShading ?? true,
          opacity: m.opacity,
          transparent: m.transparent,
          transmission: m.transmission,
          ior: m.ior,
          clearcoat: m.clearcoat,
          clearcoatRoughness: m.clearcoatRoughness
        });
      }
    }

    const tier = QUALITY_TIERS[this.qualityTier] || QUALITY_TIERS.draft;
    const opts = {
      ...def.options,
      pivot: def.pivot ?? def.options?.pivot,
      material,
      debugName: def.name || null,
      primitiveType: def.type || null,
      qualitySegMul: tier.segMul,
      qualitySphereDetail: tier.sphereDetail
    };
    
    // Create primitive based on type
    const params = def.params || [];
    
    switch (def.type) {
      case 'box':
        return this.finalizePart(Primitives.box(...params, opts), def);

      case 'cylinder':
        return this.finalizePart(Primitives.cylinder(...params, opts), def);

      case 'sphere':
        return this.finalizePart(Primitives.sphere(...params, opts), def);

      case 'cone':
        return this.finalizePart(Primitives.cone(...params, opts), def);

      case 'torus':
        return this.finalizePart(Primitives.torus(...params, opts), def);

      case 'capsule':
        return this.finalizePart(Primitives.capsule(...params, opts), def);

      case 'octahedron':
        return this.finalizePart(Primitives.octahedron(...params, opts), def);

      case 'wedge':
        return this.finalizePart(Primitives.wedge(...params, opts), def);

      case 'pyramid':
        return this.finalizePart(Primitives.pyramid(...params, opts), def);

      case 'tetrahedron':
        return this.finalizePart(Primitives.tetrahedron(...params, opts), def);

      case 'tube':
        return this.finalizePart(Primitives.tube(...params, opts), def);

      case 'ring':
        return this.finalizePart(Primitives.ring(...params, opts), def);

      case 'plane':
        return this.finalizePart(Primitives.plane(...params, opts), def);

      case 'stairs':
        return this.finalizePart(Primitives.stairs(...params, opts), def);

      case 'arch':
        return this.finalizePart(Primitives.arch(...params, opts), def);

      case 'roundedBox':
        return this.finalizePart(Primitives.roundedBox(...params, opts), def);

      case 'prism':
        return this.finalizePart(Primitives.prism(...params, opts), def);

      case 'dodecahedron':
        return this.finalizePart(Primitives.dodecahedron(...params, opts), def);

      case 'icosahedron':
        return this.finalizePart(Primitives.icosahedron(...params, opts), def);

      // Advanced primitives - lathe, extrusion, cables, lights
      // These have optional positional params before opts, so we destructure explicitly
      case 'lathe': {
        const [points, segments = 12, phiStart = 0, phiLength = 360] = params;
        return this.finalizePart(Primitives.lathe(points, segments, phiStart, phiLength, opts), def);
      }

      case 'extrudePath': {
        const [shape, shapeParams, waypoints, segments = 64, closed = false] = params;
        return this.finalizePart(Primitives.extrudePath(shape, shapeParams, waypoints, segments, closed, opts), def);
      }

      case 'cable': {
        const [waypoints, radius = 0.02, segments = 32, radialSegments = 8, tension = 'normal'] = params;
        return this.finalizePart(Primitives.cable(waypoints, radius, segments, radialSegments, tension, opts), def);
      }

      case 'catenary': {
        const [start, end, sag = 0.2, radius = 0.02, segments = 32, radialSegments = 8] = params;
        return this.finalizePart(Primitives.catenary(start, end, sag, radius, segments, radialSegments, opts), def);
      }

      case 'helix': {
        const [radius = 0.3, tubeRadius = 0.04, coils = 5, height = 0.5] = params;
        return this.finalizePart(Primitives.helix(radius, tubeRadius, coils, height, opts), def);
      }

      case 'rock': {
        const [radius = 0.5, seed = 1, roughness = 0.35] = params;
        return this.finalizePart(Primitives.rock(radius, seed, roughness, opts), def);
      }

      case 'canopy': {
        const [radius = 0.6, lobes = 4, seed = 1] = params;
        return this.finalizePart(Primitives.canopy(radius, lobes, seed, opts), def);
      }

      case 'pointLight': {
        // Pass light color from material
        if (def.material) {
          opts.lightColor = this.parseColor(def.material.color || '#ffffff');
          opts.castShadow = def.castShadow;
        }
        const [intensity = 1, distance = 10, decay = 2, showBulb = true, bulbSize = 0.05] = params;
        return this.finalizePart(Primitives.pointLight(intensity, distance, decay, showBulb, bulbSize, opts), def);
      }

      case 'spotLight': {
        if (def.material) {
          opts.lightColor = this.parseColor(def.material.color || '#ffffff');
          opts.castShadow = def.castShadow;
        }
        const [intensity = 1, distance = 10, angle = 30, penumbra = 0.5, showCone = false] = params;
        return this.finalizePart(Primitives.spotLight(intensity, distance, angle, penumbra, showCone, opts), def);
      }

      case 'areaLight': {
        if (def.material) {
          opts.lightColor = this.parseColor(def.material.color || '#ffffff');
        }
        const [width = 1, height = 0.5, intensity = 1, showPanel = true] = params;
        return this.finalizePart(Primitives.areaLight(width, height, intensity, showPanel, opts), def);
      }

      case 'loft': {
        const geometry = buildLoftGeometry(def.loft || {});
        const mesh = new THREE.Mesh(
          geometry,
          opts.material || Materials.create({ color: 0x888888, flatShading: true })
        );
        return this.finalizePart(mesh, def);
      }

      case 'polyMesh': {
        const geometry = buildPolyMeshGeometry(def.polyMesh || {});
        const mesh = new THREE.Mesh(
          geometry,
          opts.material || Materials.create({ color: 0x888888, flatShading: true })
        );
        return this.finalizePart(mesh, def);
      }

      case 'csg': {
        const embeddedSpec = {
          name: def.name,
          type: 'csg',
          shapes: def.shapes || {},
          operations: def.operations || [],
          output: def.output,
          outputs: def.outputs,
          material: def.material
        };
        return this.finalizePart(this.buildCSG(embeddedSpec), def);
      }

      // CSG Primitives - complex shapes via boolean operations
      case 'ibeam':
        return this.finalizePart(CSGPrimitives.ibeam(...params, opts), def);

      case 'lbeam':
        return this.finalizePart(CSGPrimitives.lbeam(...params, opts), def);

      case 'tbeam':
        return this.finalizePart(CSGPrimitives.tbeam(...params, opts), def);

      case 'channel':
        return this.finalizePart(CSGPrimitives.channel(...params, opts), def);

      case 'hbeam':
        return this.finalizePart(CSGPrimitives.hbeam(...params, opts), def);

      case 'angle':
        return this.finalizePart(CSGPrimitives.angle(...params, opts), def);

      case 'hollowBox':
        return this.finalizePart(CSGPrimitives.hollowBox(...params, opts), def);

      case 'hollowCylinder':
        return this.finalizePart(CSGPrimitives.hollowCylinder(...params, opts), def);

      case 'pipeFlange':
        return this.finalizePart(CSGPrimitives.pipeFlange(...params, opts), def);

      case 'elbow':
        return this.finalizePart(CSGPrimitives.elbow(...params, opts), def);

      case 'bracket':
        return this.finalizePart(CSGPrimitives.bracket(...params, opts), def);

      case 'gear':
        return this.finalizePart(CSGPrimitives.gear(...params, opts), def);

      case 'cross':
        return this.finalizePart(CSGPrimitives.cross(...params, opts), def);

      case 'frame':
        return this.finalizePart(CSGPrimitives.frame(...params, opts), def);

      case 'windowFrame':
        return this.finalizePart(CSGPrimitives.windowFrame(...params, opts), def);

      case 'dome':
        return this.finalizePart(CSGPrimitives.dome(...params, opts), def);

      case 'hexNut':
        return this.finalizePart(CSGPrimitives.hexNut(...params, opts), def);

      case 'countersunk':
        return this.finalizePart(CSGPrimitives.countersunk(...params, opts), def);

      case 'keyhole':
        return this.finalizePart(CSGPrimitives.keyhole(...params, opts), def);

      case 'halfTorus':
        return this.finalizePart(CSGPrimitives.halfTorus(...params, opts), def);

      case 'sphereSlab':
        return this.finalizePart(CSGPrimitives.sphereSlab(...params, opts), def);

      case 'notchedCylinder':
        return this.finalizePart(CSGPrimitives.notchedCylinder(...params, opts), def);

      case 'steppedPyramid':
        return this.finalizePart(CSGPrimitives.steppedPyramid(...params, opts), def);

      case 'boxSphereIntersect':
        return this.finalizePart(CSGPrimitives.boxSphereIntersect(...params, opts), def);

      case 'cylinderIntersect':
        return this.finalizePart(CSGPrimitives.cylinderIntersect(...params, opts), def);

      case 'swissCheese':
        return this.finalizePart(CSGPrimitives.swissCheese(...params, opts), def);

      default:
        console.warn(`Unknown part type: ${def.type}`);
        return null;
    }
  }

  /**
   * Apply common flags and material detail layers to a part.
   */
  finalizePart(object, def) {
    if (!object) return null;

    // Deform before surface treatments so breakup vertex colors follow the
    // deformed shape (#78).
    if (def.deform) {
      applyDeform(object, def.deform);
    }

    if (def.snapToGround) {
      object.userData.snapToGround = true;
      object.userData.groundOffset = def.groundOffset ?? 0;
    }

    if (
      def.material?.breakup ||
      def.material?.decals ||
      def.material?.emissiveStrips ||
      def.material?.detail
    ) {
      this.applySurfaceTreatments(object, def.material);
    }

    object.traverse((child) => {
      if (child.isMesh) {
        if (def.castShadow !== undefined) child.castShadow = def.castShadow;
        if (def.receiveShadow !== undefined) child.receiveShadow = def.receiveShadow;
      }
    });

    if (def.visible !== undefined) {
      object.visible = def.visible;
    }

    if (def.category !== undefined) {
      object.userData = object.userData || {};
      object.userData.category = def.category;
    }

    if (def.flipNormals === true) {
      flipNormalsOnObject(object);
    }

    return object;
  }

  applySurfaceTreatments(object, materialDef = {}) {
    const meshes = [];
    object.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });

    for (const mesh of meshes) {
      if (materialDef.breakup) {
        this.applyMaterialBreakup(mesh, materialDef.breakup);
      }
      if (materialDef.detail) {
        this.installDetailShader(mesh, materialDef.detail);
      }
    }

    if (materialDef.decals) {
      this.addDecals(object, materialDef.decals);
    }

    if (materialDef.emissiveStrips) {
      this.addEmissiveStrips(object, materialDef.emissiveStrips);
    }
  }

  applyMaterialBreakup(mesh, breakupDef) {
    const sourceGeometry = mesh.geometry;
    if (!sourceGeometry?.attributes?.position) return;

    const geometry = sourceGeometry.clone();
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();

    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const roughnessShift = new Float32Array(positions.count);
    const baseColor = mesh.material?.color?.clone?.() || new THREE.Color(0x888888);

    const noiseScale = breakupDef.noise?.scale ?? 2.5;
    const noiseAmount = breakupDef.noise?.amount ?? 0;
    const noiseColor = new THREE.Color(breakupDef.noise?.color || '#9a9a9a');

    const grimeAmount = breakupDef.grime?.amount ?? 0;
    const grimeAxis = breakupDef.grime?.axis || 'y';
    const grimeBias = breakupDef.grime?.bias ?? 0;
    const grimeColor = new THREE.Color(breakupDef.grime?.color || '#181818');

    const wearAmount = breakupDef.edgeWear?.amount ?? 0;
    const wearColor = new THREE.Color(breakupDef.edgeWear?.color || '#d9d4cb');
    const wearContrast = breakupDef.edgeWear?.contrast ?? 3.5;
    const wearMode = breakupDef.edgeWear?.mode || 'bbox';

    // Curvature mode (#81): per-vertex crease measure — the max angle between
    // normals sharing a position. Reads real edges on lathes, lofts, and CSG
    // where the bbox mask can't.
    let creaseOf = null;
    if (wearAmount > 0 && wearMode === 'curvature') {
      const buckets = new Map();
      const keyOf = (i) =>
        `${positions.getX(i).toFixed(3)},${positions.getY(i).toFixed(3)},${positions.getZ(i).toFixed(3)}`;
      for (let i = 0; i < positions.count; i++) {
        const key = keyOf(i);
        let list = buckets.get(key);
        if (!list) buckets.set(key, (list = []));
        list.push(i);
      }
      creaseOf = new Float32Array(positions.count);
      const nA = new THREE.Vector3();
      const nB = new THREE.Vector3();
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        for (const i of list) {
          nA.set(normals.getX(i), normals.getY(i), normals.getZ(i));
          let maxAngle = 0;
          for (const j of list) {
            if (j === i) continue;
            nB.set(normals.getX(j), normals.getY(j), normals.getZ(j));
            const angle = nA.angleTo(nB);
            if (angle > maxAngle) maxAngle = angle;
          }
          creaseOf[i] = maxAngle;
        }
      }
    }

    const roughnessVariation = breakupDef.roughnessVariation ?? 0;

    const axisIndex = grimeAxis === 'x' ? 0 : grimeAxis === 'z' ? 2 : 1;
    const minAxis = [bbox.min.x, bbox.min.y, bbox.min.z][axisIndex];
    const sizeAxis = Math.max([size.x, size.y, size.z][axisIndex], 0.0001);

    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const pz = positions.getZ(i);
      const nx = Math.abs(normals.getX(i));
      const ny = Math.abs(normals.getY(i));
      const nz = Math.abs(normals.getZ(i));

      const noise = this.pseudoNoise(px * noiseScale, py * noiseScale, pz * noiseScale);
      const axisComponent = axisIndex === 0 ? px : axisIndex === 2 ? pz : py;
      const axisValue = (axisComponent - minAxis) / sizeAxis;
      const grimeMask = THREE.MathUtils.clamp((1 - axisValue + grimeBias) * grimeAmount + noise * grimeAmount * 0.5, 0, 1);

      let edgeMask;
      if (creaseOf) {
        // Normalize: 90° crease (a box edge) → 1. Contrast suppresses the
        // gentle facet-to-facet angles of lowpoly rounds.
        const norm = Math.min(creaseOf[i] / (Math.PI / 2), 1);
        edgeMask = THREE.MathUtils.clamp(
          Math.pow(norm, Math.max(1.5, wearContrast * 0.6)) * wearAmount * 6,
          0,
          1
        );
      } else {
        const edgeX = 1 - Math.abs((px - (bbox.min.x + size.x * 0.5)) / Math.max(size.x * 0.5, 0.0001));
        const edgeY = 1 - Math.abs((py - (bbox.min.y + size.y * 0.5)) / Math.max(size.y * 0.5, 0.0001));
        const edgeZ = 1 - Math.abs((pz - (bbox.min.z + size.z * 0.5)) / Math.max(size.z * 0.5, 0.0001));
        edgeMask = THREE.MathUtils.clamp(
          Math.pow(Math.max(nx * edgeY * edgeZ, ny * edgeX * edgeZ, nz * edgeX * edgeY), wearContrast) * wearAmount * 8,
          0,
          1
        );
      }

      const color = baseColor.clone();
      if (noiseAmount > 0) {
        color.lerp(noiseColor, THREE.MathUtils.clamp((noise - 0.5) * 2 * noiseAmount, 0, noiseAmount));
      }
      if (grimeAmount > 0) {
        color.lerp(grimeColor, grimeMask);
      }
      if (wearAmount > 0) {
        color.lerp(wearColor, edgeMask);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      roughnessShift[i] = (noise - 0.5) * roughnessVariation;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('roughnessShift', new THREE.BufferAttribute(roughnessShift, 1));

    mesh.geometry = geometry;
    mesh.material = mesh.material.clone();
    mesh.material.vertexColors = true;
    // Vertex colors already carry the base tint — leaving material.color at the
    // base value would multiply the two and square the albedo (#73).
    mesh.material.color.setHex(0xffffff);

    if (roughnessVariation > 0) {
      this.installRoughnessVariation(mesh.material, roughnessVariation);
    }
  }

  installRoughnessVariation(material, amount) {
    material.userData.roughnessVariation = amount;
    material.customProgramCacheKey = () => `roughness-variation-${amount}`;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        'attribute float roughnessShift;\nvarying float vRoughnessShift;\nvoid main() {\n  vRoughnessShift = roughnessShift;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        'varying float vRoughnessShift;\nvoid main() {'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + vRoughnessShift, 0.04, 1.0);'
      );
    };
    material.needsUpdate = true;
  }

  /**
   * Triplanar-style procedural detail (#81): world-space value noise modulating
   * roughness (± amount) and albedo (± amount/2). No UVs, no textures. Chains
   * with any existing onBeforeCompile (e.g. roughness variation).
   *   material.detail: { scale: 2.0, amount: 0.15 }
   */
  installDetailShader(mesh, detailDef) {
    const material = mesh.material;
    if (!material) return;
    const scale = detailDef.scale ?? 2.0;
    const amount = detailDef.amount ?? 0.12;
    const prevHook = material.onBeforeCompile;
    const prevKey = material.customProgramCacheKey?.bind(material);

    material.customProgramCacheKey = () =>
      `${prevKey ? prevKey() : ''}|detail-${scale}-${amount}`;
    material.onBeforeCompile = (shader) => {
      if (prevHook) prevHook(shader);
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'varying vec3 vDetailPos;\nvoid main() {'
        )
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n  vDetailPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `varying vec3 vDetailPos;
float samdinDetailHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float samdinDetailNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(samdinDetailHash(i), samdinDetailHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(samdinDetailHash(i + vec3(0.0, 1.0, 0.0)), samdinDetailHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(samdinDetailHash(i + vec3(0.0, 0.0, 1.0)), samdinDetailHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(samdinDetailHash(i + vec3(0.0, 1.0, 1.0)), samdinDetailHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
void main() {`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  {
    float dn = samdinDetailNoise(vDetailPos * ${scale.toFixed(4)});
    dn += 0.5 * samdinDetailNoise(vDetailPos * ${(scale * 2.7).toFixed(4)});
    dn /= 1.5;
    diffuseColor.rgb *= 1.0 + (dn - 0.5) * ${(amount).toFixed(4)};
  }`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
  {
    float dnr = samdinDetailNoise(vDetailPos * ${(scale * 1.7).toFixed(4)});
    roughnessFactor = clamp(roughnessFactor + (dnr - 0.5) * ${(amount * 2).toFixed(4)}, 0.04, 1.0);
  }`
        );
    };
    material.needsUpdate = true;
  }

  addDecals(object, decals) {
    for (const decal of decals) {
      const overlay = this.createFaceOverlay(object, decal, decal.material || decal);
      if (overlay) {
        object.add(overlay);
      }
    }
  }

  addEmissiveStrips(object, strips) {
    for (const strip of strips) {
      const count = strip.count || 1;
      for (let i = 0; i < count; i++) {
        const offsetAmount = count === 1 ? 0 : (i / (count - 1) - 0.5) * (strip.spacing || 0.6);
        const overlay = this.createFaceOverlay(
          object,
          {
            ...strip,
            size: strip.size || [strip.length || 0.6, strip.width || 0.08],
            offset: strip.axis === 'y'
              ? [strip.offset?.[0] || 0, (strip.offset?.[1] || 0) + offsetAmount]
              : [(strip.offset?.[0] || 0) + offsetAmount, strip.offset?.[1] || 0]
          },
          {
            preset: strip.preset || 'glow',
            color: strip.color || '#ff5533',
            emissiveIntensity: strip.intensity || 1.8,
            opacity: strip.opacity ?? 0.92,
            transparent: true,
            flatShading: false
          }
        );
        if (overlay) {
          object.add(overlay);
        }
      }
    }
  }

  createFaceOverlay(object, overlayDef, materialDef) {
    const bbox = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
    const center = bbox.getCenter(new THREE.Vector3());
    const face = overlayDef.face || 'front';
    const inset = overlayDef.inset ?? 0.01;
    const thickness = overlayDef.thickness ?? 0.01;
    const planeSize = overlayDef.size || [size.x * 0.5, size.y * 0.5];
    const offset = overlayDef.offset || [0, 0];

    const material = materialDef.preset
      ? Materials.getPreset(
          materialDef.preset,
          materialDef.color ? this.parseColor(materialDef.color) : undefined,
          materialDef.emissiveIntensity || materialDef.intensity,
          materialDef
        )
      : Materials.create({
          color: this.parseColor(materialDef.color || '#ffffff'),
          emissive: this.parseColor(materialDef.emissive || materialDef.color || '#000000'),
          emissiveIntensity: materialDef.emissiveIntensity ?? 1,
          metalness: materialDef.metalness ?? 0.1,
          roughness: materialDef.roughness ?? 0.6,
          transparent: materialDef.transparent ?? true,
          opacity: materialDef.opacity ?? 0.92,
          flatShading: materialDef.flatShading ?? false
        });

    let geometry;
    const mesh = new THREE.Mesh();
    mesh.material = material;
    mesh.renderOrder = 2;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    switch (face) {
      case 'back':
      case 'front':
        geometry = new THREE.BoxGeometry(planeSize[0], planeSize[1], thickness);
        mesh.position.set(
          center.x + (offset[0] || 0),
          center.y + (offset[1] || 0),
          face === 'front' ? bbox.max.z + inset : bbox.min.z - inset
        );
        break;
      case 'left':
      case 'right':
        geometry = new THREE.BoxGeometry(thickness, planeSize[1], planeSize[0]);
        mesh.position.set(
          face === 'right' ? bbox.max.x + inset : bbox.min.x - inset,
          center.y + (offset[1] || 0),
          center.z + (offset[0] || 0)
        );
        break;
      case 'top':
      case 'bottom':
        geometry = new THREE.BoxGeometry(planeSize[0], thickness, planeSize[1]);
        mesh.position.set(
          center.x + (offset[0] || 0),
          face === 'top' ? bbox.max.y + inset : bbox.min.y - inset,
          center.z + (offset[1] || 0)
        );
        break;
      default:
        return null;
    }

    mesh.geometry = geometry;
    return mesh;
  }

  pseudoNoise(x, y, z) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return s - Math.floor(s);
  }
  
  /**
   * Parse color from hex string or number
   */
  parseColor(color) {
    if (typeof color === 'string') {
      return new THREE.Color(color).getHex();
    }
    return color;
  }
  
  /**
   * Topological sort - ensure parents are created before children
   */
  sortByDependency(parts) {
    const sorted = [];
    const visited = new Set();
    const partMap = new Map(parts.map(p => [p.name, p]));
    
    const visit = (part) => {
      if (visited.has(part.name)) return;
      
      if (part.parent && partMap.has(part.parent)) {
        visit(partMap.get(part.parent));
      }
      
      visited.add(part.name);
      sorted.push(part);
    };
    
    for (const part of parts) {
      visit(part);
    }
    
    return sorted;
  }
  
  /**
   * Get list of registered spec names
   */
  getSpecNames() {
    return Array.from(this.specs.keys());
  }
}

// Example spec for testing
const EXAMPLE_SPECS = {
  testCube: {
    name: 'testCube',
    parts: [
      {
        name: 'cube',
        type: 'box',
        params: [1, 1, 1],
        material: { color: '#4a9eff', metalness: 0.5, roughness: 0.5 },
        position: [0, 0.5, 0]
      }
    ]
  },
  
  // Simple drone - starting point
  simpleDrone: {
    name: 'simpleDrone',
    parts: [
      // Main body
      {
        name: 'body',
        type: 'box',
        params: [0.8, 0.15, 0.8],
        options: { pivot: 'center' },
        material: { color: '#2a2a2a', metalness: 0.6, roughness: 0.4 },
        position: [0, 0.5, 0]
      },
      // Arms (4 corners)
      {
        name: 'arm_fr',
        type: 'box',
        params: [0.4, 0.06, 0.08],
        material: { color: '#1a1a1a', metalness: 0.5 },
        position: [0.5, 0, 0.3],
        rotation: [0, -35, 0],
        parent: 'body'
      },
      {
        name: 'arm_fl',
        type: 'box',
        params: [0.4, 0.06, 0.08],
        material: { color: '#1a1a1a', metalness: 0.5 },
        position: [-0.5, 0, 0.3],
        rotation: [0, 35, 0],
        parent: 'body'
      },
      {
        name: 'arm_br',
        type: 'box',
        params: [0.4, 0.06, 0.08],
        material: { color: '#1a1a1a', metalness: 0.5 },
        position: [0.5, 0, -0.3],
        rotation: [0, 35, 0],
        parent: 'body'
      },
      {
        name: 'arm_bl',
        type: 'box',
        params: [0.4, 0.06, 0.08],
        material: { color: '#1a1a1a', metalness: 0.5 },
        position: [-0.5, 0, -0.3],
        rotation: [0, -35, 0],
        parent: 'body'
      },
      // Central LED eye
      {
        name: 'eye',
        type: 'sphere',
        params: [0.08, 1],
        material: { preset: 'glow', color: '#ff3333', intensity: 2 },
        position: [0, 0, 0.35],
        parent: 'body'
      },
      // Status LEDs
      {
        name: 'led_front',
        type: 'box',
        params: [0.3, 0.02, 0.02],
        material: { preset: 'glow', color: '#991111', intensity: 1 },
        position: [0, 0.08, 0.38],
        parent: 'body'
      }
    ]
  },
};

export { ModelBuilder, EXAMPLE_SPECS };
