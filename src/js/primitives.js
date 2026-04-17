/**
 * primitives.js - Reliable building blocks for procedural models
 * Each primitive has proper origin point handling for rotation/hierarchy
 */
import * as THREE from 'three';

// Material factory - consistent material creation
const Materials = {
  cache: new Map(),
  
  create(options = {}) {
    const key = JSON.stringify(options);
    if (this.cache.has(key)) {
      return this.cache.get(key).clone();
    }

    // Use MeshPhysicalMaterial when advanced properties are needed
    const needsPhysical = (options.clearcoat ?? 0) > 0 ||
                          (options.transmission ?? 0) > 0 ||
                          options.ior !== undefined;

    const baseProps = {
      color: options.color || 0x888888,
      metalness: options.metalness ?? 0.3,
      roughness: options.roughness ?? 0.7,
      emissive: options.emissive || 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 1.0,
      flatShading: options.flatShading ?? false,
      side: options.side === 'double' || options.doubleSide
        ? THREE.DoubleSide
        : options.side === 'back'
          ? THREE.BackSide
          : THREE.FrontSide,
      transparent: options.transparent ?? ((options.opacity ?? 1) < 1),
      opacity: options.opacity ?? 1,
      envMapIntensity: options.envMapIntensity ?? 1,
      vertexColors: options.vertexColors ?? false
    };

    let mat;
    if (needsPhysical) {
      mat = new THREE.MeshPhysicalMaterial({
        ...baseProps,
        clearcoat: options.clearcoat ?? 0,
        clearcoatRoughness: options.clearcoatRoughness ?? 0,
        transmission: options.transmission ?? 0,
        ior: options.ior ?? 1.5
      });
    } else {
      mat = new THREE.MeshStandardMaterial(baseProps);
    }

    if (options.alphaTest !== undefined) {
      mat.alphaTest = options.alphaTest;
    }

    this.cache.set(key, mat);
    return mat;
  },
  
  // Quick presets
  metal: (color) => Materials.create({ color, metalness: 0.8, roughness: 0.2 }),
  matte: (color) => Materials.create({ color, metalness: 0.1, roughness: 0.9 }),
  glow: (color, intensity = 1) => Materials.create({
    color: 0x111111,
    emissive: color,
    emissiveIntensity: intensity
  }),

  // Extended presets
  chrome: () => Materials.create({ color: 0xcccccc, metalness: 1.0, roughness: 0.1 }),
  steel: () => Materials.create({ color: 0x888888, metalness: 0.7, roughness: 0.3 }),
  rubber: () => Materials.create({ color: 0x1a1a1a, metalness: 0.0, roughness: 0.9 }),
  glass: () => Materials.create({ color: 0x88aacc, metalness: 0.9, roughness: 0.1, flatShading: false }),
  'glass-tinted': () => Materials.create({ color: 0x335566, metalness: 0.8, roughness: 0.1, flatShading: false }),
  concrete: (color = 0xa0a090) => Materials.create({ color, metalness: 0.1, roughness: 0.95 }),
  asphalt: () => Materials.create({ color: 0x333333, metalness: 0.1, roughness: 0.9 }),
  brick: (color = 0x8b4513) => Materials.create({ color, metalness: 0.1, roughness: 0.85 }),
  wood: (color = 0x8b6914) => Materials.create({ color, metalness: 0.1, roughness: 0.8 }),
  leather: (color = 0x3d2817) => Materials.create({ color, metalness: 0.2, roughness: 0.7 }),
  plastic: (color = 0x444444) => Materials.create({ color, metalness: 0.3, roughness: 0.6 }),
  'painted-metal': (color = 0x666666) => Materials.create({ color, metalness: 0.5, roughness: 0.5 }),
  'rusted-metal': (color = 0x6b4423) => Materials.create({ color, metalness: 0.4, roughness: 0.8 }),
  neon: (color, intensity = 3) => Materials.create({ color: 0x111111, emissive: color, emissiveIntensity: intensity }),
  fabric: (color = 0x666688) => Materials.create({ color, metalness: 0.0, roughness: 0.95 }),
  ceramic: (color = 0xeeeeee) => Materials.create({ color, metalness: 0.3, roughness: 0.4, flatShading: false }),
  water: () => Materials.create({ color: 0x3388aa, metalness: 0.6, roughness: 0.2, flatShading: false }),
  tile: (color = 0xe8e4e0) => Materials.create({ color, metalness: 0.2, roughness: 0.6 }),
  'wall-paint': (color = 0xffffff) => Materials.create({ color, metalness: 0.0, roughness: 0.95 }),
  screen: (color = 0x4488ff, intensity = 1.5) => Materials.create({ color: 0x111122, emissive: color, emissiveIntensity: intensity }),
  rgb: (color = 0xff00ff, intensity = 2) => Materials.create({ color: 0x111111, emissive: color, emissiveIntensity: intensity }),
  cushion: (color = 0xddccbb) => Materials.create({ color, metalness: 0.0, roughness: 1.0 }),
  carpet: (color = 0x888888) => Materials.create({ color, metalness: 0.0, roughness: 1.0 }),
  // Lowpoly outdoor materials
  grass: (color = 0x4a7c3f) => Materials.create({ color, metalness: 0.0, roughness: 1.0 }),
  'dirt-path': (color = 0x9b8b6e) => Materials.create({ color, metalness: 0.05, roughness: 0.95 }),
  'fence-wood': (color = 0x8b6b4a) => Materials.create({ color, metalness: 0.0, roughness: 0.9 }),
  'cinder-block': (color = 0xb8b0a0) => Materials.create({ color, metalness: 0.1, roughness: 0.9 }),
  foliage: (color = 0x2d5a27) => Materials.create({ color, metalness: 0.0, roughness: 1.0 }),
  'wire-mesh': (color = 0x3a3a3a) => Materials.create({ color, metalness: 0.6, roughness: 0.4 }),
  sky: (color = 0x87ceeb) => Materials.create({ color, metalness: 0.0, roughness: 1.0, emissive: color, emissiveIntensity: 0.3 }),
  cloud: (color = 0xffffff) => Materials.create({ color, metalness: 0.0, roughness: 1.0, emissive: 0xffffff, emissiveIntensity: 0.2 }),

  /**
   * Get preset by name with optional color override
   */
  getPreset(name, color, intensity, overrides = {}) {
    const base = {
      'metal': { color: color || 0x888888, metalness: 0.8, roughness: 0.2 },
      'matte': { color: color || 0x888888, metalness: 0.1, roughness: 0.9 },
      'glow': { color: 0x111111, emissive: color || 0xff0000, emissiveIntensity: intensity || 1, metalness: 0.1, roughness: 0.6, flatShading: false },
      'chrome': { color: 0xcccccc, metalness: 1.0, roughness: 0.1, flatShading: false },
      'steel': { color: color || 0x888888, metalness: 0.7, roughness: 0.3 },
      'gold': { color: color || 0xd4a040, metalness: 0.9, roughness: 0.15, flatShading: false },
      'brass': { color: color || 0xb8963a, metalness: 0.8, roughness: 0.25, flatShading: false },
      'copper': { color: color || 0xc07040, metalness: 0.8, roughness: 0.3, flatShading: false },
      'rubber': { color: color || 0x1a1a1a, metalness: 0.0, roughness: 0.9 },
      'glass': {
        color: color || 0xa9c8dd,
        metalness: 0.0,
        roughness: 0.08,
        flatShading: false,
        transparent: true,
        opacity: overrides.opacity ?? 0.35,
        transmission: overrides.transmission ?? 0.8,
        ior: overrides.ior ?? 1.45
      },
      'glass-tinted': {
        color: color || 0x335566,
        metalness: 0.0,
        roughness: 0.08,
        flatShading: false,
        transparent: true,
        opacity: overrides.opacity ?? 0.45,
        transmission: overrides.transmission ?? 0.65,
        ior: overrides.ior ?? 1.45
      },
      'concrete': { color: color || 0xa0a090, metalness: 0.1, roughness: 0.95 },
      'asphalt': { color: color || 0x333333, metalness: 0.1, roughness: 0.9 },
      'brick': { color: color || 0x8b4513, metalness: 0.1, roughness: 0.85 },
      'wood': { color: color || 0x8b6914, metalness: 0.1, roughness: 0.8 },
      'leather': { color: color || 0x3d2817, metalness: 0.2, roughness: 0.7 },
      'plastic': { color: color || 0x444444, metalness: 0.3, roughness: 0.6 },
      'painted-metal': { color: color || 0x666666, metalness: 0.5, roughness: 0.5 },
      'rusted-metal': { color: color || 0x6b4423, metalness: 0.4, roughness: 0.8 },
      'neon': { color: 0x111111, emissive: color || 0xff00ff, emissiveIntensity: intensity || 3, metalness: 0.1, roughness: 0.5, flatShading: false },
      'fabric': { color: color || 0x666688, metalness: 0.0, roughness: 0.95 },
      'ceramic': { color: color || 0xeeeeee, metalness: 0.3, roughness: 0.4, flatShading: false },
      'water': { color: color || 0x3388aa, metalness: 0.2, roughness: 0.15, flatShading: false, transparent: true, opacity: overrides.opacity ?? 0.85 },
      'tile': { color: color || 0xe8e4e0, metalness: 0.2, roughness: 0.6 },
      'wall-paint': { color: color || 0xffffff, metalness: 0.0, roughness: 0.95 },
      'screen': { color: 0x111122, emissive: color || 0x4488ff, emissiveIntensity: intensity || 1.5, metalness: 0.2, roughness: 0.35, flatShading: false },
      'rgb': { color: 0x111111, emissive: color || 0xff00ff, emissiveIntensity: intensity || 2, metalness: 0.1, roughness: 0.5, flatShading: false },
      'cushion': { color: color || 0xddccbb, metalness: 0.0, roughness: 1.0 },
      'carpet': { color: color || 0x888888, metalness: 0.0, roughness: 1.0 },
      'grass': { color: color || 0x4a7c3f, metalness: 0.0, roughness: 1.0 },
      'dirt-path': { color: color || 0x9b8b6e, metalness: 0.05, roughness: 0.95 },
      'fence-wood': { color: color || 0x8b6b4a, metalness: 0.0, roughness: 0.9 },
      'cinder-block': { color: color || 0xb8b0a0, metalness: 0.1, roughness: 0.9 },
      'foliage': { color: color || 0x2d5a27, metalness: 0.0, roughness: 1.0 },
      'wire-mesh': { color: color || 0x3a3a3a, metalness: 0.6, roughness: 0.4 },
      'sky': { color: color || 0x87ceeb, metalness: 0.0, roughness: 1.0, emissive: color || 0x87ceeb, emissiveIntensity: 0.3, flatShading: false },
      'cloud': { color: color || 0xffffff, metalness: 0.0, roughness: 1.0, emissive: 0xffffff, emissiveIntensity: 0.2, flatShading: false }
    };

    if (!base[name]) {
      return null;
    }

    return this.create({
      ...base[name],
      ...overrides
    });
  }
};

// Primitive factory functions
// All return THREE.Mesh with geometry centered appropriately

const Primitives = {
  /**
   * Box with configurable pivot point
   * @param {number} w - width (x)
   * @param {number} h - height (y)
   * @param {number} d - depth (z)
   * @param {object} opts - { pivot: 'center'|'bottom'|'top', material }
   */
  box(w, h, d, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    
    // Adjust geometry for pivot point
    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, h / 2, 0);
        break;
      case 'top':
        geo.translate(0, -h / 2, 0);
        break;
      // 'center' is default - no translation needed
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },
  
  /**
   * Cylinder
   * @param {number} radiusTop
   * @param {number} radiusBottom
   * @param {number} height
   * @param {number} segments - radial segments (lower = more lowpoly)
   * @param {object} opts
   */
  cylinder(radiusTop, radiusBottom, height, segments = 8, opts = {}) {
    const segs = Math.round(segments * (opts.qualitySegMul || 1));
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segs);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    
    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, height / 2, 0);
        break;
      case 'top':
        geo.translate(0, -height / 2, 0);
        break;
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },
  
  /**
   * Sphere (icosahedron for lowpoly)
   * @param {number} radius
   * @param {number} detail - 0 = 20 faces, 1 = 80 faces, 2 = 320 faces
   * @param {object} opts
   */
  sphere(radius, detail = 1, opts = {}) {
    const d = Math.max(detail, opts.qualitySphereDetail || 0);
    const geo = new THREE.IcosahedronGeometry(radius, d);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    
    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, radius, 0);
        break;
      case 'top':
        geo.translate(0, -radius, 0);
        break;
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },
  
  /**
   * Cone
   */
  cone(radius, height, segments = 6, opts = {}) {
    const segs = Math.round(segments * (opts.qualitySegMul || 1));
    const geo = new THREE.ConeGeometry(radius, height, segs);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    
    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, height / 2, 0);
        break;
      case 'top':
        geo.translate(0, -height / 2, 0);
        break;
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },
  
  /**
   * Torus (ring)
   */
  torus(radius, tube, radialSegs = 8, tubularSegs = 6, opts = {}) {
    const mul = opts.qualitySegMul || 1;
    const geo = new THREE.TorusGeometry(radius, tube, Math.round(radialSegs * mul), Math.round(tubularSegs * mul));
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },
  
  /**
   * Capsule (pill shape) - useful for limbs
   */
  capsule(radius, length, capSegs = 4, radialSegs = 8, opts = {}) {
    const mul = opts.qualitySegMul || 1;
    const geo = new THREE.CapsuleGeometry(radius, length, Math.round(capSegs * mul), Math.round(radialSegs * mul));
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    
    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, (length + radius * 2) / 2, 0);
        break;
      case 'top':
        geo.translate(0, -(length + radius * 2) / 2, 0);
        break;
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },
  
  /**
   * Octahedron - good for gems, indicators
   */
  octahedron(radius, detail = 0, opts = {}) {
    const geo = new THREE.OctahedronGeometry(radius, detail);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Wedge (triangular prism) - good for ramps, roofs, wings
   * Uses ExtrudeGeometry for reliable face creation
   * @param {number} w - width (x)
   * @param {number} h - height (y)
   * @param {number} d - depth (z)
   * @param {object} opts - { pivot, material, direction: 'right'|'left'|'front'|'back' }
   */
  wedge(w, h, d, opts = {}) {
    const direction = opts.direction || 'right';

    // Create a 2D triangle shape and extrude it
    const shape = new THREE.Shape();

    // Draw triangle in the XY plane, will extrude along Z
    if (direction === 'right') {
      // Slope goes down from left to right (high on left)
      shape.moveTo(-w/2, 0);
      shape.lineTo(w/2, 0);
      shape.lineTo(-w/2, h);
      shape.closePath();
    } else if (direction === 'left') {
      // Slope goes down from right to left (high on right)
      shape.moveTo(-w/2, 0);
      shape.lineTo(w/2, 0);
      shape.lineTo(w/2, h);
      shape.closePath();
    } else if (direction === 'front') {
      // For front/back, we draw in XY and rotate after
      shape.moveTo(-w/2, 0);
      shape.lineTo(w/2, 0);
      shape.lineTo(w/2, h);
      shape.lineTo(-w/2, h);
      shape.closePath();
    } else {
      // back
      shape.moveTo(-w/2, 0);
      shape.lineTo(w/2, 0);
      shape.lineTo(w/2, h);
      shape.lineTo(-w/2, h);
      shape.closePath();
    }

    const extrudeSettings = {
      depth: d,
      bevelEnabled: false
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Rotate and position based on direction
    if (direction === 'right' || direction === 'left') {
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0, d/2);
    } else if (direction === 'front') {
      // Slope faces front (high at back)
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(Math.PI / 2);
      geo.translate(0, 0, -w/2);
    } else {
      // back - slope faces back (high at front)
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-Math.PI / 2);
      geo.translate(0, 0, w/2);
    }

    switch (opts.pivot) {
      case 'center':
        geo.translate(0, -h/2, 0);
        break;
      // 'bottom' is default - no translation needed
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Pyramid - 4-sided pyramid
   * Uses ConeGeometry with 4 segments for reliable rendering
   * @param {number} baseW - base width (x)
   * @param {number} baseD - base depth (z)
   * @param {number} h - height (y)
   */
  pyramid(baseW, baseD, h, opts = {}) {
    // Support 2-param call: pyramid(baseWidth, height, opts)
    if (typeof h === 'object' || h === undefined) {
      opts = h || {};
      h = baseD;
      baseD = baseW;
    }
    // Use average of width and depth for radius, scale to compensate
    const radius = Math.max(baseW, baseD) / Math.sqrt(2);
    const geo = new THREE.ConeGeometry(radius, h, 4, 1);

    // Rotate 45 degrees so corners align with axes
    geo.rotateY(Math.PI / 4);

    // Scale to match requested dimensions
    const scaleX = baseW / (radius * Math.sqrt(2));
    const scaleZ = baseD / (radius * Math.sqrt(2));
    geo.scale(scaleX, 1, scaleZ);

    // Default pivot is bottom
    geo.translate(0, h / 2, 0);

    switch (opts.pivot) {
      case 'center':
        geo.translate(0, -h/2, 0);
        break;
      case 'top':
        geo.translate(0, -h, 0);
        break;
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Tetrahedron - 4-faced triangular pyramid
   */
  tetrahedron(radius, detail = 0, opts = {}) {
    const geo = new THREE.TetrahedronGeometry(radius, detail);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));

    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, radius * 0.5, 0);
        break;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Tube - hollow cylinder
   * @param {number} outerRadius
   * @param {number} innerRadius
   * @param {number} height
   * @param {number} segments
   */
  tube(outerRadius, innerRadius, height, segments = 8, opts = {}) {
    segments = Math.round(segments * (opts.qualitySegMul || 1));
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
      steps: 1
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, height / 2, 0);

    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, -height / 2, 0);
        break;
      case 'top':
        geo.translate(0, -height, 0);
        break;
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Ring - flat disc with hole (washer shape)
   * @param {number} outerRadius
   * @param {number} innerRadius
   * @param {number} segments
   */
  ring(outerRadius, innerRadius, segments = 16, opts = {}) {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, segments);
    geo.rotateX(-Math.PI / 2); // Make it horizontal

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Plane - flat rectangle, good for floors, walls, screens
   * @param {number} w - width
   * @param {number} h - height
   * @param {number} segsW - width segments
   * @param {number} segsH - height segments
   */
  plane(w, h, segsW = 1, segsH = 1, opts = {}) {
    const geo = new THREE.PlaneGeometry(w, h, segsW, segsH);

    // Default orientation is vertical (facing +Z)
    if (opts.orientation === 'horizontal') {
      geo.rotateX(-Math.PI / 2);
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Stairs - stepped staircase shape
   * @param {number} w - total width (x)
   * @param {number} h - total height (y)
   * @param {number} d - total depth (z)
   * @param {number} steps - number of steps
   */
  stairs(w, h, d, steps = 4, opts = {}) {
    const group = new THREE.Group();
    const stepH = h / steps;
    const stepD = d / steps;
    const mat = opts.material || Materials.matte(0x888888);

    for (let i = 0; i < steps; i++) {
      // Each step is just one tread, not extending back
      const stepGeo = new THREE.BoxGeometry(w, stepH, stepD);
      const stepMesh = new THREE.Mesh(stepGeo, mat);
      // Position each step at its proper height and depth
      stepMesh.position.set(0, stepH * i + stepH / 2, stepD * i + stepD / 2);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }

    switch (opts.pivot) {
      case 'center':
        group.position.set(0, -h/2, -d/2);
        break;
    }

    return group;
  },

  /**
   * Arch - curved archway (solid, no pass-through hole)
   * @param {number} w - width (span)
   * @param {number} h - height to top of arch
   * @param {number} d - depth/thickness
   * @param {number} segments - curve smoothness
   */
  arch(w, h, d, segments = 8, opts = {}) {
    segments = Math.round(segments * (opts.qualitySegMul || 1));
    const thickness = opts.thickness || w * 0.15;

    // Create arch as two vertical pillars + a curved top section
    const group = new THREE.Group();
    const mat = opts.material || Materials.matte(0x888888);

    // Left pillar
    const pillarH = h - w/2;
    if (pillarH > 0) {
      const leftPillar = new THREE.BoxGeometry(thickness, pillarH, d);
      const leftMesh = new THREE.Mesh(leftPillar, mat);
      leftMesh.position.set(-w/2 + thickness/2, pillarH/2, 0);
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = true;
      group.add(leftMesh);

      // Right pillar
      const rightPillar = new THREE.BoxGeometry(thickness, pillarH, d);
      const rightMesh = new THREE.Mesh(rightPillar, mat);
      rightMesh.position.set(w/2 - thickness/2, pillarH/2, 0);
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = true;
      group.add(rightMesh);
    }

    // Curved top - use extruded arc shape instead of torus for better control
    const arcShape = new THREE.Shape();
    const innerRadius = (w - thickness * 2) / 2;
    const outerRadius = w / 2;

    // Draw arc shape (half-ring cross-section in XY)
    arcShape.absarc(0, 0, outerRadius, 0, Math.PI, false);
    arcShape.absarc(0, 0, innerRadius, Math.PI, 0, true);
    arcShape.closePath();

    const arcExtrudeSettings = {
      depth: d,
      bevelEnabled: false,
      curveSegments: segments
    };

    const arcGeo = new THREE.ExtrudeGeometry(arcShape, arcExtrudeSettings);
    arcGeo.translate(0, 0, -d / 2);

    const arcMesh = new THREE.Mesh(arcGeo, mat);
    arcMesh.position.set(0, pillarH > 0 ? pillarH : 0, 0);
    arcMesh.castShadow = true;
    arcMesh.receiveShadow = true;
    group.add(arcMesh);

    return group;
  },

  /**
   * RoundedBox - box with beveled/rounded edges
   * @param {number} w - width
   * @param {number} h - height
   * @param {number} d - depth
   * @param {number} radius - edge radius
   * @param {number} segments - smoothness
   */
  roundedBox(w, h, d, radius = 0.1, segments = 2, opts = {}) {
    segments = Math.round(segments * (opts.qualitySegMul || 1));
    // Use a simplified approach - create box with chamfered edges via shape extrusion
    // Clamp radius to avoid zero/negative dimensions
    const maxRadius = Math.min(w/2, h/2, d/2) * 0.49; // Leave room for extrusion depth
    const r = Math.min(radius, maxRadius);

    const shape = new THREE.Shape();
    shape.moveTo(-w/2 + r, -h/2);
    shape.lineTo(w/2 - r, -h/2);
    shape.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
    shape.lineTo(w/2, h/2 - r);
    shape.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
    shape.lineTo(-w/2 + r, h/2);
    shape.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
    shape.lineTo(-w/2, -h/2 + r);
    shape.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);

    // Guard against zero/negative depth
    const extrudeDepth = Math.max(d - r * 2, 0.001);

    const extrudeSettings = {
      depth: extrudeDepth,
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelSegments: segments
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, -d/2 + r);

    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, h/2, 0);
        break;
      case 'top':
        geo.translate(0, -h/2, 0);
        break;
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Prism - n-sided extruded polygon
   * @param {number} radius - radius of polygon
   * @param {number} height - extrusion height
   * @param {number} sides - number of sides (3=triangle, 5=pentagon, 6=hexagon, etc.)
   */
  prism(radius, height, sides = 6, opts = {}) {
    sides = Math.round(sides * (opts.qualitySegMul || 1));
    const shape = new THREE.Shape();

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    const extrudeSettings = {
      depth: height,
      bevelEnabled: false
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, height / 2, 0);

    switch (opts.pivot) {
      case 'bottom':
        geo.translate(0, -height / 2, 0);
        break;
      case 'top':
        geo.translate(0, -height, 0);
        break;
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Dodecahedron - 12-faced polyhedron
   */
  dodecahedron(radius, detail = 0, opts = {}) {
    const geo = new THREE.DodecahedronGeometry(radius, detail);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Icosahedron - 20-faced polyhedron
   */
  icosahedron(radius, detail = 0, opts = {}) {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Lathe - Revolve a 2D profile around the Y axis
   * @param {Array} points - Array of [x, y] points defining the profile (x=radius, y=height)
   * @param {number} segments - Number of radial segments
   * @param {number} phiStart - Starting angle in degrees
   * @param {number} phiLength - Sweep angle in degrees (360 for full revolution)
   */
  lathe(points, segments = 12, phiStart = 0, phiLength = 360, opts = {}) {
    segments = Math.round(segments * (opts.qualitySegMul || 1));
    // Convert [x,y] arrays to Vector2
    const profile = points.map(p => new THREE.Vector2(p[0], p[1]));

    const geo = new THREE.LatheGeometry(
      profile,
      segments,
      THREE.MathUtils.degToRad(phiStart),
      THREE.MathUtils.degToRad(phiLength)
    );

    switch (opts.pivot) {
      case 'center':
        geo.computeBoundingBox();
        const centerY = (geo.boundingBox.max.y + geo.boundingBox.min.y) / 2;
        geo.translate(0, -centerY, 0);
        break;
      case 'top':
        geo.computeBoundingBox();
        geo.translate(0, -geo.boundingBox.max.y, 0);
        break;
      // 'bottom' is default (profile starts at y=0)
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * ExtrudePath - Extrude a shape along a curved path
   * @param {string} shape - Shape type: 'circle', 'square', 'rectangle'
   * @param {Array} shapeParams - Parameters for the shape [radius] or [width, height]
   * @param {Array} waypoints - Array of [x, y, z] points defining the path
   * @param {number} segments - Tube segments along the path
   * @param {boolean} closed - Whether the path is closed
   */
  extrudePath(shape, shapeParams, waypoints, segments = 64, closed = false, opts = {}) {
    // Create the path from waypoints using CatmullRom spline
    const pathPoints = waypoints.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(pathPoints, closed, 'catmullrom', 0.5);

    let geo;
    if (shape === 'circle') {
      // Use TubeGeometry for circular cross-section
      const radius = shapeParams[0] || 0.1;
      const radialSegments = shapeParams[1] || 8;
      geo = new THREE.TubeGeometry(curve, segments, radius, radialSegments, closed);
    } else {
      // For other shapes, use ExtrudeGeometry along the path
      const extrudeShape = new THREE.Shape();
      if (shape === 'square') {
        const size = shapeParams[0] || 0.1;
        extrudeShape.moveTo(-size/2, -size/2);
        extrudeShape.lineTo(size/2, -size/2);
        extrudeShape.lineTo(size/2, size/2);
        extrudeShape.lineTo(-size/2, size/2);
        extrudeShape.closePath();
      } else if (shape === 'rectangle') {
        const w = shapeParams[0] || 0.2;
        const h = shapeParams[1] || 0.1;
        extrudeShape.moveTo(-w/2, -h/2);
        extrudeShape.lineTo(w/2, -h/2);
        extrudeShape.lineTo(w/2, h/2);
        extrudeShape.lineTo(-w/2, h/2);
        extrudeShape.closePath();
      }

      geo = new THREE.ExtrudeGeometry(extrudeShape, {
        steps: segments,
        bevelEnabled: false,
        extrudePath: curve
      });
    }

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Cable - Smooth cable/wire/pipe along waypoints with bezier interpolation
   * @param {Array} waypoints - Array of [x, y, z] control points
   * @param {number} radius - Cable radius
   * @param {number} segments - Segments along the cable
   * @param {number} radialSegments - Segments around the cable
   * @param {string} tension - 'tight' (0.5), 'normal' (0.25), 'loose' (0)
   */
  cable(waypoints, radius = 0.02, segments = 32, radialSegments = 8, tension = 'normal', opts = {}) {
    const tensionValues = { tight: 0.5, normal: 0.25, loose: 0 };
    const t = tensionValues[tension] ?? 0.25;

    const points = waypoints.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', t);

    const geo = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * Catenary - Cable that sags under gravity between two points
   * Uses catenary curve equation: y = a * cosh((x-x0)/a) + c
   * @param {Array} start - [x, y, z] start point
   * @param {Array} end - [x, y, z] end point
   * @param {number} sag - Amount of sag (0-1, percentage of horizontal distance)
   * @param {number} radius - Cable radius
   * @param {number} segments - Segments along the cable
   * @param {number} radialSegments - Segments around the cable
   */
  catenary(start, end, sag = 0.2, radius = 0.02, segments = 32, radialSegments = 8, opts = {}) {
    const p1 = new THREE.Vector3(start[0], start[1], start[2]);
    const p2 = new THREE.Vector3(end[0], end[1], end[2]);

    // Calculate horizontal distance and direction
    const horizontal = new THREE.Vector3(p2.x - p1.x, 0, p2.z - p1.z);
    const horizontalDist = horizontal.length();
    horizontal.normalize();

    // Vertical difference
    const verticalDiff = p2.y - p1.y;

    // Calculate sag amount based on horizontal distance
    const sagAmount = horizontalDist * sag;

    // Generate points along the catenary
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Horizontal position
      const hPos = t * horizontalDist;

      // Vertical position using parabolic approximation of catenary
      // y = 4 * sag * t * (1-t) gives a nice droop
      const sagAtPoint = 4 * sagAmount * t * (1 - t);

      // Interpolate vertical position and subtract sag
      const vPos = p1.y + t * verticalDiff - sagAtPoint;

      // Calculate 3D position
      const point = new THREE.Vector3(
        p1.x + horizontal.x * hPos,
        vPos,
        p1.z + horizontal.z * hPos
      );
      points.push(point);
    }

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const geo = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);

    const mesh = new THREE.Mesh(geo, opts.material || Materials.matte(0x888888));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  /**
   * PointLight - Creates a point light with optional visible bulb
   * @param {number} intensity - Light intensity
   * @param {number} distance - Light reach (0 = infinite)
   * @param {number} decay - Light decay rate
   * @param {boolean} showBulb - Whether to show a visible bulb mesh
   * @param {number} bulbSize - Size of the visible bulb
   */
  pointLight(intensity = 1, distance = 10, decay = 2, showBulb = true, bulbSize = 0.05, opts = {}) {
    const group = new THREE.Group();

    const color = opts.lightColor || 0xffffff;
    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.castShadow = opts.castShadow !== false;
    if (light.castShadow) {
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = distance || 50;
    }
    group.add(light);

    if (showBulb) {
      const bulbGeo = new THREE.IcosahedronGeometry(bulbSize, 1);
      const bulbMat = Materials.glow(color, 2);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      group.add(bulb);
    }

    // Mark this as a light group for special handling
    group.userData.isLight = true;
    group.userData.lightType = 'point';

    return group;
  },

  /**
   * SpotLight - Creates a spot light with optional visible cone
   * @param {number} intensity - Light intensity
   * @param {number} distance - Light reach
   * @param {number} angle - Cone angle in degrees
   * @param {number} penumbra - Soft edge (0-1)
   * @param {boolean} showCone - Whether to show a visible cone mesh
   */
  spotLight(intensity = 1, distance = 10, angle = 30, penumbra = 0.5, showCone = false, opts = {}) {
    const group = new THREE.Group();

    const color = opts.lightColor || 0xffffff;
    const light = new THREE.SpotLight(
      color,
      intensity,
      distance,
      THREE.MathUtils.degToRad(angle),
      penumbra,
      2
    );
    light.castShadow = opts.castShadow !== false;
    if (light.castShadow) {
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = distance || 50;
    }

    // SpotLight needs a target
    light.target.position.set(0, -1, 0);
    group.add(light);
    group.add(light.target);

    if (showCone) {
      const coneHeight = Math.min(distance * 0.3, 2);
      const coneRadius = Math.tan(THREE.MathUtils.degToRad(angle)) * coneHeight;
      const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8, 1, true);
      coneGeo.translate(0, -coneHeight/2, 0);
      const coneMat = Materials.create({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        flatShading: true,
        doubleSide: true
      });
      coneMat.transparent = true;
      coneMat.opacity = 0.15;
      const cone = new THREE.Mesh(coneGeo, coneMat);
      group.add(cone);
    }

    // Add small housing
    const housingGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.1, 8);
    housingGeo.translate(0, 0.05, 0);
    const housing = new THREE.Mesh(housingGeo, opts.material || Materials.matte(0x333333));
    group.add(housing);

    group.userData.isLight = true;
    group.userData.lightType = 'spot';

    return group;
  },

  /**
   * AreaLight - Creates a rectangular area light (RectAreaLight)
   * Note: Requires RectAreaLightUniformsLib to be initialized
   * @param {number} width - Light width
   * @param {number} height - Light height
   * @param {number} intensity - Light intensity
   * @param {boolean} showPanel - Whether to show a visible light panel
   */
  areaLight(width = 1, height = 0.5, intensity = 1, showPanel = true, opts = {}) {
    const group = new THREE.Group();

    const color = opts.lightColor || 0xffffff;
    const light = new THREE.RectAreaLight(color, intensity, width, height);
    group.add(light);

    if (showPanel) {
      const panelGeo = new THREE.PlaneGeometry(width, height);
      const panelMat = Materials.glow(color, intensity * 0.5);
      panelMat.side = THREE.DoubleSide;
      const panel = new THREE.Mesh(panelGeo, panelMat);
      group.add(panel);

      // Add thin frame
      const frameGeo = new THREE.BoxGeometry(width + 0.02, height + 0.02, 0.02);
      frameGeo.translate(0, 0, -0.015);
      const frame = new THREE.Mesh(frameGeo, opts.material || Materials.matte(0x333333));
      group.add(frame);
    }

    group.userData.isLight = true;
    group.userData.lightType = 'area';

    return group;
  }
};

/**
 * Assembly helper - builds hierarchical models from spec
 */
class ModelAssembler {
  constructor() {
    this.root = new THREE.Group();
    this.parts = new Map(); // named parts for animation access
  }
  
  /**
   * Add a part to the model
   * @param {string} name - unique identifier
   * @param {THREE.Object3D} mesh - the mesh/group to add
   * @param {string} parentName - parent part name (null for root)
   * @param {object} transform - { position, rotation, scale }
   */
  addPart(name, mesh, parentName = null, transform = {}) {
    // Apply transform
    if (transform.position) {
      mesh.position.set(...transform.position);
    }
    if (transform.rotation) {
      // Rotation in degrees for easier spec writing
      mesh.rotation.set(
        THREE.MathUtils.degToRad(transform.rotation[0] || 0),
        THREE.MathUtils.degToRad(transform.rotation[1] || 0),
        THREE.MathUtils.degToRad(transform.rotation[2] || 0)
      );
    }
    if (transform.scale) {
      const s = transform.scale;
      mesh.scale.set(
        Array.isArray(s) ? s[0] : s,
        Array.isArray(s) ? s[1] : s,
        Array.isArray(s) ? s[2] : s
      );
    }
    
    mesh.name = name;
    this.parts.set(name, mesh);
    
    // Attach to parent
    const parent = parentName ? this.parts.get(parentName) : this.root;
    if (!parent) {
      console.warn(`Parent '${parentName}' not found, attaching to root`);
      this.root.add(mesh);
    } else {
      parent.add(mesh);
    }
    
    return mesh;
  }
  
  /**
   * Get a part by name
   */
  getPart(name) {
    return this.parts.get(name);
  }
  
  /**
   * Get the complete model
   */
  getModel() {
    return this.root;
  }
  
  /**
   * Get all animated-capable parts
   */
  getAnimatableParts() {
    return Object.fromEntries(this.parts);
  }
}

export { Primitives, Materials, ModelAssembler };
