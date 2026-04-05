/**
 * CSGPrimitives.js - Library of complex shapes built via CSG
 *
 * These shapes can be used in primitive-style specs via type: "csg-primitive".
 * Each generator returns a spec fragment that gets processed by CSGBuilder.
 */
import * as THREE from 'three';
import { SUBTRACTION, INTERSECTION, ADDITION, Evaluator, Brush } from 'three-bvh-csg';

/**
 * CSG Primitive generators
 * Each returns a THREE.Mesh with the specified material
 */
const CSGPrimitives = {
  /**
   * I-Beam: Structural beam with H-shaped cross-section
   * @param {number} width - Overall width
   * @param {number} height - Overall height
   * @param {number} depth - Depth (length of beam)
   * @param {number} thickness - Flange/web thickness
   */
  ibeam(width = 0.6, height = 0.7, depth = 0.6, flangeThickness = 0.08, webThickness = flangeThickness, opts = {}) {
    if (isOptionsArg(webThickness)) {
      opts = webThickness;
      webThickness = flangeThickness;
    }
    const evaluator = new Evaluator();
    const safeFlangeThickness = Math.max(Math.min(flangeThickness, height / 2 - 0.001), 0.001);
    const safeWebThickness = Math.max(Math.min(webThickness, width - 0.001), 0.001);

    // Top flange
    const topFlange = new Brush(new THREE.BoxGeometry(width, safeFlangeThickness, depth));
    topFlange.position.set(0, height / 2 - safeFlangeThickness / 2, 0);
    topFlange.updateMatrixWorld(true);

    // Bottom flange
    const bottomFlange = new Brush(new THREE.BoxGeometry(width, safeFlangeThickness, depth));
    bottomFlange.position.set(0, -height / 2 + safeFlangeThickness / 2, 0);
    bottomFlange.updateMatrixWorld(true);

    // Web (guard against negative height)
    const webHeight = Math.max(height - safeFlangeThickness * 2, 0.001);
    const web = new Brush(new THREE.BoxGeometry(safeWebThickness, webHeight, depth));
    web.updateMatrixWorld(true);

    // Union all parts
    let result = evaluator.evaluate(topFlange, bottomFlange, ADDITION);
    result = evaluator.evaluate(result, web, ADDITION);

    return createMesh(result.geometry, opts);
  },

  /**
   * L-Beam: Angle bracket
   */
  lbeam(width = 0.6, height = 0.6, depth = 0.6, thickness = 0.1, opts = {}) {
    const evaluator = new Evaluator();

    const vertical = new Brush(new THREE.BoxGeometry(thickness, height, depth));
    vertical.position.set(-width / 2 + thickness / 2, 0, 0);
    vertical.updateMatrixWorld(true);

    const horizontal = new Brush(new THREE.BoxGeometry(width, thickness, depth));
    horizontal.position.set(0, -height / 2 + thickness / 2, 0);
    horizontal.updateMatrixWorld(true);

    const result = evaluator.evaluate(vertical, horizontal, ADDITION);
    return createMesh(result.geometry, opts);
  },

  /**
   * T-Beam: T-shaped structural member
   */
  tbeam(width = 0.6, height = 0.6, depth = 0.5, flangeThickness = 0.1, webThickness = flangeThickness, opts = {}) {
    if (isOptionsArg(webThickness)) {
      opts = webThickness;
      webThickness = flangeThickness;
    }
    const evaluator = new Evaluator();
    const safeFlangeThickness = Math.max(Math.min(flangeThickness, height - 0.001), 0.001);
    const safeWebThickness = Math.max(Math.min(webThickness, width - 0.001), 0.001);

    const stem = new Brush(new THREE.BoxGeometry(safeWebThickness, height, depth));
    stem.updateMatrixWorld(true);

    const top = new Brush(new THREE.BoxGeometry(width, safeFlangeThickness, depth));
    top.position.set(0, height / 2 - safeFlangeThickness / 2, 0);
    top.updateMatrixWorld(true);

    const result = evaluator.evaluate(stem, top, ADDITION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Channel: C-shaped beam
   */
  channel(width = 0.6, height = 0.6, depth = 0.6, thickness = 0.1, opts = {}) {
    const evaluator = new Evaluator();

    const outer = new Brush(new THREE.BoxGeometry(width, height, depth));
    outer.updateMatrixWorld(true);

    // Guard against negative cutout dimensions
    const cutWidth = Math.max(width - thickness, 0.001);
    const cutHeight = Math.max(height - thickness * 2, 0.001);

    const cutout = new Brush(new THREE.BoxGeometry(cutWidth, cutHeight, depth + 0.1));
    cutout.position.set(thickness / 2, 0, 0);
    cutout.updateMatrixWorld(true);

    const result = evaluator.evaluate(outer, cutout, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * H-Beam: Wide flange beam
   */
  hbeam(width = 0.7, height = 0.7, depth = 0.5, flangeThickness = 0.1, webThickness = 0.12, opts = {}) {
    const evaluator = new Evaluator();

    const box = new Brush(new THREE.BoxGeometry(width, height, depth));
    box.updateMatrixWorld(true);

    // Guard against negative cutout dimensions
    const cutWidth = Math.max((width - webThickness) / 2, 0.001);
    const cutHeight = Math.max(height - flangeThickness * 2, 0.001);

    const cutLeft = new Brush(new THREE.BoxGeometry(cutWidth, cutHeight, depth + 0.1));
    cutLeft.position.set(-width / 4 - webThickness / 4, 0, 0);
    cutLeft.updateMatrixWorld(true);

    const cutRight = new Brush(new THREE.BoxGeometry(cutWidth, cutHeight, depth + 0.1));
    cutRight.position.set(width / 4 + webThickness / 4, 0, 0);
    cutRight.updateMatrixWorld(true);

    let result = evaluator.evaluate(box, cutLeft, SUBTRACTION);
    result = evaluator.evaluate(result, cutRight, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Angle: 90-degree angle bracket
   */
  angle(width = 0.5, height = 0.5, depth = 0.5, thickness = 0.08, opts = {}) {
    const evaluator = new Evaluator();

    const vertical = new Brush(new THREE.BoxGeometry(thickness, height, depth));
    vertical.position.set(width / 2 - thickness / 2, 0, 0);
    vertical.updateMatrixWorld(true);

    const horizontal = new Brush(new THREE.BoxGeometry(width, thickness, depth));
    horizontal.position.set(0, -height / 2 + thickness / 2, 0);
    horizontal.updateMatrixWorld(true);

    const result = evaluator.evaluate(vertical, horizontal, ADDITION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Hollow Box: Box with hollow interior
   */
  hollowBox(width = 0.7, height = 0.7, depth = 0.7, thickness = 0.1, opts = {}) {
    const evaluator = new Evaluator();

    const outer = new Brush(new THREE.BoxGeometry(width, height, depth));
    outer.updateMatrixWorld(true);

    // Guard against negative inner dimensions
    const innerWidth = Math.max(width - thickness * 2, 0.001);
    const innerDepth = Math.max(depth - thickness * 2, 0.001);

    const inner = new Brush(new THREE.BoxGeometry(
      innerWidth,
      height + 0.1,
      innerDepth
    ));
    inner.updateMatrixWorld(true);

    const result = evaluator.evaluate(outer, inner, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Hollow Cylinder: Pipe/tube shape
   */
  hollowCylinder(outerRadius = 0.35, innerRadius = 0.22, height = 0.7, segments = 32, opts = {}) {
    const evaluator = new Evaluator();

    // Guard against invalid radii
    const safeInnerRadius = Math.max(Math.min(innerRadius, outerRadius - 0.001), 0.001);

    const outer = new Brush(new THREE.CylinderGeometry(outerRadius, outerRadius, height, segments));
    outer.updateMatrixWorld(true);

    const inner = new Brush(new THREE.CylinderGeometry(safeInnerRadius, safeInnerRadius, height + 0.1, segments));
    inner.updateMatrixWorld(true);

    const result = evaluator.evaluate(outer, inner, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Pipe with Flanges: Pipe with mounting flanges at both ends
   */
  pipeFlange(pipeRadius = 0.15, flangeRadius = 0.3, flangeThickness = 0.08, pipeLength = 0.8, boltHoles = 0, opts = {}) {
    if (isOptionsArg(boltHoles)) {
      opts = boltHoles;
      boltHoles = 0;
    }
    const evaluator = new Evaluator();
    const safeFlangeRadius = Math.max(flangeRadius, pipeRadius + 0.01);
    const safePipeRadius = Math.max(Math.min(pipeRadius, safeFlangeRadius - 0.01), 0.01);
    const safeFlangeThickness = Math.max(Math.min(flangeThickness, pipeLength / 2), 0.01);
    const safePipeLength = Math.max(pipeLength, safeFlangeThickness * 2 + 0.02);
    const coreRadius = Math.max(safePipeRadius * 0.58, 0.004);

    const pipe = new Brush(new THREE.CylinderGeometry(safePipeRadius, safePipeRadius, safePipeLength, 32));
    pipe.updateMatrixWorld(true);

    const flange1 = new Brush(new THREE.CylinderGeometry(safeFlangeRadius, safeFlangeRadius, safeFlangeThickness, 32));
    flange1.position.set(0, -safePipeLength / 2 + safeFlangeThickness / 2, 0);
    flange1.updateMatrixWorld(true);

    const flange2 = new Brush(new THREE.CylinderGeometry(safeFlangeRadius, safeFlangeRadius, safeFlangeThickness, 32));
    flange2.position.set(0, safePipeLength / 2 - safeFlangeThickness / 2, 0);
    flange2.updateMatrixWorld(true);

    let result = evaluator.evaluate(pipe, flange1, ADDITION);
    result = evaluator.evaluate(result, flange2, ADDITION);

    const core = new Brush(new THREE.CylinderGeometry(coreRadius, coreRadius, safePipeLength + safeFlangeThickness * 2 + 0.2, 32));
    core.updateMatrixWorld(true);
    result = evaluator.evaluate(result, core, SUBTRACTION);

    const safeBoltHoles = Math.max(Math.round(boltHoles), 0);
    if (safeBoltHoles > 0) {
      const orbitRadius = safePipeRadius + (safeFlangeRadius - safePipeRadius) * 0.55;
      const boltHoleRadius = Math.max((safeFlangeRadius - safePipeRadius) * 0.16, 0.01);
      const flangeYs = [
        -safePipeLength / 2 + safeFlangeThickness / 2,
        safePipeLength / 2 - safeFlangeThickness / 2
      ];

      for (const flangeY of flangeYs) {
        for (let i = 0; i < safeBoltHoles; i++) {
          const angle = (i / safeBoltHoles) * Math.PI * 2;
          const bolt = new Brush(new THREE.CylinderGeometry(boltHoleRadius, boltHoleRadius, safeFlangeThickness + 0.04, 16));
          bolt.position.set(
            Math.cos(angle) * orbitRadius,
            flangeY,
            Math.sin(angle) * orbitRadius
          );
          bolt.updateMatrixWorld(true);
          result = evaluator.evaluate(result, bolt, SUBTRACTION);
        }
      }
    }

    return createMesh(result.geometry, opts);
  },

  /**
   * Elbow: 90-degree pipe elbow
   */
  elbow(radius = 0.2, tubeRadius = 0.08, angle = 90, segments = 32, opts = {}) {
    if (isOptionsArg(segments)) {
      opts = segments;
      segments = 32;
    }
    const safeRadius = Math.max(radius, 0.02);
    const safeTubeRadius = Math.max(Math.min(tubeRadius, safeRadius - 0.001), 0.004);
    const safeAngle = THREE.MathUtils.degToRad(Math.max(Math.min(angle, 360), 5));
    const radialSegments = Math.max(Math.round(segments / 2), 8);
    const tubularSegments = Math.max(Math.round(segments), 12);
    const geometry = new THREE.TorusGeometry(safeRadius, safeTubeRadius, radialSegments, tubularSegments, safeAngle);
    geometry.rotateZ(Math.PI / 2);
    return createMesh(geometry, opts);
  },

  /**
   * Bracket: L-bracket with gusset
   */
  bracket(width = 0.5, height = 0.5, depth = 0.5, thickness = 0.08, holeRadius = 0, opts = {}) {
    if (isOptionsArg(holeRadius)) {
      opts = holeRadius;
      holeRadius = 0;
    }
    const evaluator = new Evaluator();
    const safeThickness = Math.max(Math.min(thickness, Math.min(width, height, depth) - 0.001), 0.001);
    const safeHoleRadius = Math.max(holeRadius, 0);

    // Guard against zero/negative wall height
    const wallHeight = Math.max(height - safeThickness, 0.001);

    const base = new Brush(new THREE.BoxGeometry(width, safeThickness, depth));
    base.position.set(0, -height / 2 + safeThickness / 2, 0);
    base.updateMatrixWorld(true);

    const wall = new Brush(new THREE.BoxGeometry(width, wallHeight, safeThickness));
    wall.position.set(0, 0, -depth / 2 + safeThickness / 2);
    wall.updateMatrixWorld(true);

    const gusset = new Brush(new THREE.BoxGeometry(safeThickness, height * 0.6, depth * 0.6));
    gusset.position.set(0, -height / 4, -depth / 4);
    gusset.updateMatrixWorld(true);

    // Cut gusset at 45 degrees
    const gussetCut = new Brush(new THREE.BoxGeometry(safeThickness * 2, height, depth));
    gussetCut.rotation.set(Math.PI / 4, 0, 0);
    gussetCut.position.set(0, height / 4, depth / 4);
    gussetCut.updateMatrixWorld(true);

    let result = evaluator.evaluate(base, wall, ADDITION);
    result = evaluator.evaluate(result, gusset, ADDITION);
    result = evaluator.evaluate(result, gussetCut, SUBTRACTION);

    if (safeHoleRadius > 0.001) {
      const baseHole = new Brush(new THREE.CylinderGeometry(safeHoleRadius, safeHoleRadius, safeThickness + 0.04, 16));
      baseHole.position.set(0, -height / 2 + safeThickness / 2, 0);
      baseHole.updateMatrixWorld(true);
      result = evaluator.evaluate(result, baseHole, SUBTRACTION);

      const wallHole = new Brush(new THREE.CylinderGeometry(safeHoleRadius, safeHoleRadius, safeThickness + 0.04, 16));
      wallHole.rotation.set(Math.PI / 2, 0, 0);
      wallHole.position.set(0, 0, -depth / 2 + safeThickness / 2);
      wallHole.updateMatrixWorld(true);
      result = evaluator.evaluate(result, wallHole, SUBTRACTION);
    }

    return createMesh(result.geometry, opts);
  },

  /**
   * Gear: Simple gear wheel
   */
  gear(radius = 0.4, teeth = 8, height = 0.2, toothDepth = 0.12, opts = {}) {
    if (isOptionsArg(toothDepth)) {
      opts = toothDepth;
      toothDepth = 0.12;
    }
    const evaluator = new Evaluator();
    const safeTeeth = Math.max(Math.round(teeth), 3);
    const safeHeight = Math.max(height, 0.01);
    const safeToothDepth = Math.max(toothDepth, 0.01);
    const safeHoleRadius = Math.max(
      Math.min(opts.holeRadius ?? radius * 0.32, radius - 0.01),
      0.001
    );
    const toothWidth = Math.max((2 * Math.PI * radius / safeTeeth) * 0.45, safeToothDepth * 0.5);

    const base = new Brush(new THREE.CylinderGeometry(radius, radius, safeHeight, Math.max(safeTeeth * 2, 12)));
    base.updateMatrixWorld(true);

    const hole = new Brush(new THREE.CylinderGeometry(safeHoleRadius, safeHoleRadius, safeHeight + 0.1, 32));
    hole.updateMatrixWorld(true);

    let result = evaluator.evaluate(base, hole, SUBTRACTION);

    // Add teeth around the perimeter
    for (let i = 0; i < safeTeeth; i++) {
      const angle = (i / safeTeeth) * Math.PI * 2;
      const tooth = new Brush(new THREE.BoxGeometry(safeToothDepth, safeHeight, toothWidth));
      tooth.position.set(
        Math.cos(angle) * (radius + safeToothDepth / 2 - 0.01),
        0,
        Math.sin(angle) * (radius + safeToothDepth / 2 - 0.01)
      );
      tooth.rotation.set(0, angle, 0);
      tooth.updateMatrixWorld(true);
      result = evaluator.evaluate(result, tooth, ADDITION);
    }

    return createMesh(result.geometry, opts);
  },

  /**
   * Cross: 3D cross shape
   */
  cross(armLength = 0.4, armWidth = 0.2, thickness = armWidth, opts = {}) {
    if (isOptionsArg(thickness)) {
      opts = thickness;
      thickness = armWidth;
    }
    const evaluator = new Evaluator();
    const safeThickness = Math.max(thickness, 0.001);

    const xArm = new Brush(new THREE.BoxGeometry(armLength * 2, armWidth, safeThickness));
    xArm.updateMatrixWorld(true);

    const yArm = new Brush(new THREE.BoxGeometry(armWidth, armLength * 2, safeThickness));
    yArm.updateMatrixWorld(true);

    const zArm = new Brush(new THREE.BoxGeometry(safeThickness, armWidth, armLength * 2));
    zArm.updateMatrixWorld(true);

    let result = evaluator.evaluate(xArm, yArm, ADDITION);
    result = evaluator.evaluate(result, zArm, ADDITION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Frame: Rectangular frame with window opening
   */
  frame(width = 0.8, height = 0.8, border = 0.12, depth = 0.15, opts = {}) {
    if (isOptionsArg(depth)) {
      opts = depth;
      depth = 0.15;
    }
    const evaluator = new Evaluator();

    const outer = new Brush(new THREE.BoxGeometry(width, height, depth));
    outer.updateMatrixWorld(true);

    // Guard against negative inner dimensions
    const innerWidth = Math.max(width - border * 2, 0.001);
    const innerHeight = Math.max(height - border * 2, 0.001);

    const inner = new Brush(new THREE.BoxGeometry(innerWidth, innerHeight, depth + 0.1));
    inner.updateMatrixWorld(true);

    const result = evaluator.evaluate(outer, inner, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Window Frame: Frame with mullions (crossbars)
   */
  windowFrame(width = 0.7, height = 0.9, frameWidth = 0.1, frameDepth = 0.1, divisions = 2, opts = {}) {
    if (isOptionsArg(divisions)) {
      opts = divisions;
      divisions = 2;
    }
    const evaluator = new Evaluator();
    const safeFrameWidth = Math.max(frameWidth, 0.01);
    const safeFrameDepth = Math.max(frameDepth, 0.01);

    const outer = new Brush(new THREE.BoxGeometry(width, height, safeFrameDepth));
    outer.updateMatrixWorld(true);

    // Guard against negative inner dimensions
    const innerWidth = Math.max(width - safeFrameWidth * 2, 0.001);
    const innerHeight = Math.max(height - safeFrameWidth * 2, 0.001);

    const inner = new Brush(new THREE.BoxGeometry(innerWidth, innerHeight, safeFrameDepth + 0.1));
    inner.updateMatrixWorld(true);

    let result = evaluator.evaluate(outer, inner, SUBTRACTION);

    const safeDivisions = Math.max(Math.round(divisions), 1);
    const mullionWidth = Math.max(Math.min(safeFrameWidth * 0.65, Math.min(innerWidth, innerHeight)), 0.01);

    for (let i = 1; i < safeDivisions; i++) {
      const x = -innerWidth / 2 + innerWidth * (i / safeDivisions);
      const vMullion = new Brush(new THREE.BoxGeometry(mullionWidth, innerHeight, safeFrameDepth));
      vMullion.position.set(x, 0, 0);
      vMullion.updateMatrixWorld(true);
      result = evaluator.evaluate(result, vMullion, ADDITION);
    }

    for (let i = 1; i < safeDivisions; i++) {
      const y = -innerHeight / 2 + innerHeight * (i / safeDivisions);
      const hMullion = new Brush(new THREE.BoxGeometry(innerWidth, mullionWidth, safeFrameDepth));
      hMullion.position.set(0, y, 0);
      hMullion.updateMatrixWorld(true);
      result = evaluator.evaluate(result, hMullion, ADDITION);
    }

    return createMesh(result.geometry, opts);
  },

  /**
   * Dome: Half sphere, optionally hollow
   */
  dome(radius = 0.4, thickness = 0.08, segments = 32, opts = {}) {
    const evaluator = new Evaluator();

    const sphere = new Brush(new THREE.SphereGeometry(radius, segments, segments));
    sphere.updateMatrixWorld(true);

    // Cut off bottom half
    const cutBox = new Brush(new THREE.BoxGeometry(radius * 3, radius, radius * 3));
    cutBox.position.set(0, -radius / 2, 0);
    cutBox.updateMatrixWorld(true);

    let result = evaluator.evaluate(sphere, cutBox, SUBTRACTION);

    // Make hollow (guard against negative inner radius)
    const innerRadius = radius - thickness;
    if (thickness > 0 && innerRadius > 0) {
      const innerSphere = new Brush(new THREE.SphereGeometry(innerRadius, segments, segments));
      innerSphere.updateMatrixWorld(true);
      result = evaluator.evaluate(result, innerSphere, SUBTRACTION);
    }

    return createMesh(result.geometry, opts);
  },

  /**
   * Hex Nut: Hexagonal nut with center hole
   */
  hexNut(radius = 0.35, height = 0.25, holeRadius = 0.18, opts = {}) {
    if (isOptionsArg(holeRadius)) {
      opts = holeRadius;
      holeRadius = 0.18;
    }
    const evaluator = new Evaluator();

    const hex = new Brush(new THREE.CylinderGeometry(radius, radius, height, 6));
    hex.updateMatrixWorld(true);

    const hole = new Brush(new THREE.CylinderGeometry(holeRadius, holeRadius, height + 0.1, 32));
    hole.updateMatrixWorld(true);

    const result = evaluator.evaluate(hex, hole, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Countersunk Hole: Block with countersunk screw hole
   */
  countersunk(headRadius = 0.2, shaftRadius = 0.08, headHeight = 0.12, shaftLength = 0.4, opts = {}) {
    if (isOptionsArg(shaftLength)) {
      opts = shaftLength;
      shaftLength = 0.4;
    }
    const evaluator = new Evaluator();

    const shaft = new Brush(new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 24));
    shaft.updateMatrixWorld(true);

    const head = new Brush(new THREE.CylinderGeometry(headRadius, shaftRadius, headHeight, 24));
    head.position.set(0, shaftLength / 2 + headHeight / 2 - 0.001, 0);
    head.updateMatrixWorld(true);

    const result = evaluator.evaluate(shaft, head, ADDITION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Keyhole: Plate with keyhole-shaped opening
   */
  keyhole(width = 0.5, height = 0.7, depth = 0.1, circleRadius = 0.12, slotWidth = 0.1, opts = {}) {
    const evaluator = new Evaluator();

    const plate = new Brush(new THREE.BoxGeometry(width, height, depth));
    plate.updateMatrixWorld(true);

    const circle = new Brush(new THREE.CylinderGeometry(circleRadius, circleRadius, depth + 0.1, 32));
    circle.position.set(0, height * 0.15, 0);
    circle.updateMatrixWorld(true);

    const slot = new Brush(new THREE.BoxGeometry(slotWidth, height * 0.3, depth + 0.1));
    slot.position.set(0, -height * 0.1, 0);
    slot.updateMatrixWorld(true);

    let result = evaluator.evaluate(plate, circle, SUBTRACTION);
    result = evaluator.evaluate(result, slot, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Half Torus: Half of a donut shape
   */
  halfTorus(radius = 0.3, tube = 0.1, segments = 32, opts = {}) {
    const evaluator = new Evaluator();

    const torus = new Brush(new THREE.TorusGeometry(radius, tube, 16, segments));
    torus.rotation.set(Math.PI / 2, 0, 0);
    torus.updateMatrixWorld(true);

    const cutBox = new Brush(new THREE.BoxGeometry(radius * 3, tube * 3, radius * 2));
    cutBox.position.set(0, 0, -radius / 2);
    cutBox.updateMatrixWorld(true);

    const result = evaluator.evaluate(torus, cutBox, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Sphere Slab: Sphere sliced into a slab
   */
  sphereSlab(radius = 0.4, thickness = 0.25, segments = 32, opts = {}) {
    const evaluator = new Evaluator();

    const sphere = new Brush(new THREE.SphereGeometry(radius, segments, segments));
    sphere.updateMatrixWorld(true);

    const topCut = new Brush(new THREE.BoxGeometry(radius * 3, radius, radius * 3));
    topCut.position.set(0, thickness / 2 + radius / 2, 0);
    topCut.updateMatrixWorld(true);

    const bottomCut = new Brush(new THREE.BoxGeometry(radius * 3, radius, radius * 3));
    bottomCut.position.set(0, -thickness / 2 - radius / 2, 0);
    bottomCut.updateMatrixWorld(true);

    let result = evaluator.evaluate(sphere, topCut, SUBTRACTION);
    result = evaluator.evaluate(result, bottomCut, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Notched Cylinder: Cylinder with notches cut out
   */
  notchedCylinder(radius = 0.3, height = 0.6, notchWidth = 0.15, notchDepth = 0.15, segments = 32, opts = {}) {
    const evaluator = new Evaluator();

    const cyl = new Brush(new THREE.CylinderGeometry(radius, radius, height, segments));
    cyl.updateMatrixWorld(true);

    const notch1 = new Brush(new THREE.BoxGeometry(notchWidth, height + 0.1, notchDepth));
    notch1.position.set(radius - notchWidth / 4, 0, 0);
    notch1.updateMatrixWorld(true);

    const notch2 = new Brush(new THREE.BoxGeometry(notchWidth, height + 0.1, notchDepth));
    notch2.position.set(-radius + notchWidth / 4, 0, 0);
    notch2.updateMatrixWorld(true);

    let result = evaluator.evaluate(cyl, notch1, SUBTRACTION);
    result = evaluator.evaluate(result, notch2, SUBTRACTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Stepped Pyramid: Layered pyramid shape
   */
  steppedPyramid(baseSize = 0.7, height = 0.6, steps = 3, opts = {}) {
    if (isOptionsArg(steps)) {
      opts = steps;
      steps = 3;
    }
    const evaluator = new Evaluator();
    const safeSteps = Math.max(Math.round(steps), 1);
    const stepHeight = Math.max(height / safeSteps, 0.001);
    const stepShrink = baseSize / (safeSteps * 2.2);

    let result = null;
    for (let i = 0; i < safeSteps; i++) {
      const size = Math.max(baseSize - i * stepShrink * 2, stepShrink);
      const block = new Brush(new THREE.BoxGeometry(size, stepHeight, size));
      block.position.set(0, i * stepHeight + stepHeight / 2, 0);
      block.updateMatrixWorld(true);

      if (result === null) {
        result = block;
      } else {
        result = evaluator.evaluate(result, block, ADDITION);
      }
    }

    return createMesh(result.geometry, opts);
  },

  /**
   * Box-Sphere Intersection: Rounded cube via intersection
   */
  boxSphereIntersect(boxSize = 0.5, sphereRadius = 0.35, opts = {}) {
    const evaluator = new Evaluator();

    const box = new Brush(new THREE.BoxGeometry(boxSize, boxSize, boxSize));
    box.updateMatrixWorld(true);

    const sphere = new Brush(new THREE.SphereGeometry(sphereRadius, 32, 32));
    sphere.updateMatrixWorld(true);

    const result = evaluator.evaluate(box, sphere, INTERSECTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Cylinder Intersection: Two cylinders intersected at 90 degrees
   */
  cylinderIntersect(radius = 0.3, height = 0.8, segments = 32, opts = {}) {
    const evaluator = new Evaluator();

    const vCyl = new Brush(new THREE.CylinderGeometry(radius, radius, height, segments));
    vCyl.updateMatrixWorld(true);

    const hCyl = new Brush(new THREE.CylinderGeometry(radius, radius, height, segments));
    hCyl.rotation.set(Math.PI / 2, 0, 0);
    hCyl.updateMatrixWorld(true);

    const result = evaluator.evaluate(vCyl, hCyl, INTERSECTION);
    return createMesh(result.geometry, opts);
  },

  /**
   * Swiss Cheese: Block with random holes
   */
  swissCheese(width = 0.7, height = 0.7, depth = 0.4, holeRadius = 0.1, holes = 4, opts = {}) {
    if (isOptionsArg(holes)) {
      opts = holes;
      holes = 4;
    }
    const evaluator = new Evaluator();
    const safeHoles = Math.max(Math.round(holes), 0);
    const safeHoleRadius = Math.max(holeRadius, 0.01);

    let result = new Brush(new THREE.BoxGeometry(width, height, depth));
    result.updateMatrixWorld(true);

    // Create holes at different positions
    const positions = [
      [-width * 0.22, height * 0.1],
      [width * 0.22, -height * 0.1],
      [0, height * 0.22],
      [width * 0.15, height * 0.16]
    ];

    for (let i = 0; i < Math.min(safeHoles, positions.length); i++) {
      const r = safeHoleRadius * (0.8 + Math.random() * 0.4);
      const hole = new Brush(new THREE.CylinderGeometry(r, r, depth + 0.1, 32));
      hole.position.set(positions[i][0], positions[i][1], 0);
      hole.updateMatrixWorld(true);
      result = evaluator.evaluate(result, hole, SUBTRACTION);
    }

    return createMesh(result.geometry, opts);
  }
};

/**
 * Helper to create a mesh with material
 */
function createMesh(geometry, opts = {}) {
  // Validate geometry for NaN values
  const posAttr = geometry.getAttribute('position');
  if (posAttr) {
    for (let i = 0; i < posAttr.count; i++) {
      if (isNaN(posAttr.getX(i)) || isNaN(posAttr.getY(i)) || isNaN(posAttr.getZ(i))) {
        const sourceBits = [];
        if (opts.primitiveType) sourceBits.push(`type=${opts.primitiveType}`);
        if (opts.debugName) sourceBits.push(`part=${opts.debugName}`);
        const sourceSuffix = sourceBits.length ? ` (${sourceBits.join(', ')})` : '';
        console.error(`[CSGPrimitives] NaN detected in geometry position attribute at index ${i}${sourceSuffix}`);
        console.error('[CSGPrimitives] Geometry:', geometry);
        // Return a tiny placeholder box instead of NaN geometry
        const placeholder = new THREE.BoxGeometry(0.001, 0.001, 0.001);
        return new THREE.Mesh(placeholder, new THREE.MeshBasicMaterial({ visible: false }));
      }
    }
  }

  const material = opts.material || new THREE.MeshStandardMaterial({
    color: opts.color || 0x888888,
    metalness: opts.metalness ?? 0.5,
    roughness: opts.roughness ?? 0.5,
    flatShading: opts.flatShading ?? false
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Handle pivot positioning
  if (opts.pivot === 'bottom') {
    geometry.computeBoundingBox();
    const height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
    geometry.translate(0, height / 2, 0);
  } else if (opts.pivot === 'top') {
    geometry.computeBoundingBox();
    const height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
    geometry.translate(0, -height / 2, 0);
  }

  return mesh;
}

function isOptionsArg(value) {
  return value !== null && typeof value === 'object' && Array.isArray(value) === false;
}

/**
 * List of available CSG primitive types
 */
const CSG_PRIMITIVE_TYPES = Object.keys(CSGPrimitives);

export { CSGPrimitives, CSG_PRIMITIVE_TYPES };
