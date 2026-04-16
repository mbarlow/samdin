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
 *   animations: { ... }  // optional animation definitions
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
    this.qualityTier = 'draft'; // default: legacy behavior
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
    return buildCSG(spec);
  }

  /**
   * Build a parts-based model
   */
  async buildParts(spec) {
    const assembler = new ModelAssembler();

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

    applyTerrainCompositor(model, spec);

    return model;
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

        const moduleParts = this.instantiateComposite(part, moduleDef, part.parent);
        const resolvedParts = await this.resolveParts(moduleParts, spec, depth + 1);
        expanded.push(...resolvedParts);
        continue;
      }

      if (part.type === 'prefab') {
        await this.loadPrefab(part.src);
        const prefab = this.prefabs.get(part.src);
        const prefabParts = this.instantiateComposite(part, prefab, part.parent);
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
  expandArray(part) {
    const { array, modifiers, ...basePart } = part;
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
          results.push(newPart);
        }
      }
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

    if (
      def.material?.breakup ||
      def.material?.decals ||
      def.material?.emissiveStrips
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

      const edgeX = 1 - Math.abs((px - (bbox.min.x + size.x * 0.5)) / Math.max(size.x * 0.5, 0.0001));
      const edgeY = 1 - Math.abs((py - (bbox.min.y + size.y * 0.5)) / Math.max(size.y * 0.5, 0.0001));
      const edgeZ = 1 - Math.abs((pz - (bbox.min.z + size.z * 0.5)) / Math.max(size.z * 0.5, 0.0001));
      const edgeMask = THREE.MathUtils.clamp(
        Math.pow(Math.max(nx * edgeY * edgeZ, ny * edgeX * edgeZ, nz * edgeX * edgeY), wearContrast) * wearAmount * 8,
        0,
        1
      );

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
