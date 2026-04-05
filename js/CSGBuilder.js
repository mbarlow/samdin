/**
 * CSGBuilder.js - Constructive Solid Geometry model builder
 *
 * Uses three-bvh-csg for boolean operations on meshes.
 * Supports union, subtract, and intersect operations.
 *
 * Two modes:
 * 1. Single output: Classic CSG with one final mesh
 * 2. Multi-output: Multiple named outputs, each with its own material
 */
import * as THREE from 'three';
import { SUBTRACTION, INTERSECTION, ADDITION, Evaluator, Brush } from 'three-bvh-csg';
import { Primitives, Materials } from './primitives.js';

/**
 * CSG Spec format (single output):
 * {
 *   name: "model_name",
 *   type: "csg",
 *   shapes: { ... },
 *   operations: [ ... ],
 *   output: "final",
 *   material: { color: "#4a5a6a", metalness: 0.7, roughness: 0.3 }
 * }
 *
 * CSG Spec format (multi-output):
 * {
 *   name: "model_name",
 *   type: "csg",
 *   shapes: { ... },
 *   operations: [ ... ],
 *   outputs: [
 *     { name: "ibeam", material: { color: "#ff4444" } },
 *     { name: "lbeam", material: { color: "#44ff44" } }
 *   ]
 * }
 */

class CSGBuilder {
  constructor() {
    this.evaluator = new Evaluator();
  }

  /**
   * Build a model from a CSG spec
   */
  build(spec) {
    console.log('[CSG] Building:', spec.name);

    // Create brushes for each shape
    const brushes = new Map();

    for (const [name, shapeDef] of Object.entries(spec.shapes || {})) {
      const brush = this.createBrush(shapeDef);
      if (brush) {
        brushes.set(name, brush);
        console.log(`[CSG] Created brush: ${name}`);
      }
    }

    // Apply operations in sequence
    for (const op of (spec.operations || [])) {
      const result = this.applyOperation(brushes, op);
      if (result) {
        brushes.set(op.result, result);
        console.log(`[CSG] Operation ${op.op}: ${op.a} + ${op.b} -> ${op.result}`);
      }
    }

    // Check for multi-output mode
    if (spec.outputs && Array.isArray(spec.outputs)) {
      return this.buildMultiOutput(spec, brushes);
    }

    // Single output mode
    return this.buildSingleOutput(spec, brushes);
  }

  /**
   * Build single output (classic CSG)
   */
  buildSingleOutput(spec, brushes) {
    const outputName = spec.output || 'result';
    const finalBrush = brushes.get(outputName);

    if (!finalBrush) {
      console.error(`[CSG] Output '${outputName}' not found`);
      return this.createErrorMesh();
    }

    // Create material
    const material = this.createMaterial(spec.material);

    // Convert brush to mesh
    const geometry = finalBrush.geometry.clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = spec.name;
    mesh.userData.spec = spec;

    // Wrap in group for consistency
    const group = new THREE.Group();
    group.add(mesh);
    group.name = spec.name;

    console.log('[CSG] Build complete (single output)');
    return group;
  }

  /**
   * Build multiple outputs with individual materials
   */
  buildMultiOutput(spec, brushes) {
    const group = new THREE.Group();
    group.name = spec.name;

    for (const outputDef of spec.outputs) {
      const brush = brushes.get(outputDef.name);
      if (!brush) {
        console.warn(`[CSG] Output '${outputDef.name}' not found, skipping`);
        continue;
      }

      // Create material for this output
      const material = this.createMaterial(outputDef.material);

      // Convert brush to mesh
      const geometry = brush.geometry.clone();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = outputDef.name;
      mesh.userData.csgPrimitive = outputDef.name;

      group.add(mesh);
      console.log(`[CSG] Added output: ${outputDef.name}`);
    }

    group.userData.spec = spec;
    console.log(`[CSG] Build complete (${spec.outputs.length} outputs)`);
    return group;
  }

  /**
   * Create a CSG brush from a shape definition
   */
  createBrush(shapeDef) {
    let geometry;

    switch (shapeDef.type) {
      case 'box':
        const size = shapeDef.size || [1, 1, 1];
        geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        break;

      case 'sphere':
        geometry = new THREE.SphereGeometry(
          shapeDef.radius || 0.5,
          shapeDef.segments || 32,
          shapeDef.segments || 32
        );
        break;

      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          shapeDef.radiusTop ?? shapeDef.radius ?? 0.5,
          shapeDef.radiusBottom ?? shapeDef.radius ?? 0.5,
          shapeDef.height || 1,
          shapeDef.segments || 32
        );
        break;

      case 'cone':
        geometry = new THREE.ConeGeometry(
          shapeDef.radius || 0.5,
          shapeDef.height || 1,
          shapeDef.segments || 32
        );
        break;

      case 'torus':
        geometry = new THREE.TorusGeometry(
          shapeDef.radius || 0.5,
          shapeDef.tube || 0.2,
          shapeDef.radialSegments || 16,
          shapeDef.tubularSegments || 48
        );
        break;

      case 'capsule':
        geometry = new THREE.CapsuleGeometry(
          shapeDef.radius || 0.5,
          shapeDef.length || 1,
          shapeDef.capSegments || 8,
          shapeDef.radialSegments || 16
        );
        break;

      default:
        console.warn(`[CSG] Unknown shape type: ${shapeDef.type}`);
        return null;
    }

    // Create brush with temporary material
    const brush = new Brush(geometry, new THREE.MeshStandardMaterial());

    // Apply transforms
    if (shapeDef.position) {
      brush.position.set(...shapeDef.position);
    }
    if (shapeDef.rotation) {
      brush.rotation.set(
        THREE.MathUtils.degToRad(shapeDef.rotation[0] || 0),
        THREE.MathUtils.degToRad(shapeDef.rotation[1] || 0),
        THREE.MathUtils.degToRad(shapeDef.rotation[2] || 0)
      );
    }
    if (shapeDef.scale) {
      if (Array.isArray(shapeDef.scale)) {
        brush.scale.set(...shapeDef.scale);
      } else {
        brush.scale.setScalar(shapeDef.scale);
      }
    }

    // Update matrix for CSG operations
    brush.updateMatrixWorld(true);

    return brush;
  }

  /**
   * Apply a CSG operation
   */
  applyOperation(brushes, op) {
    const brushA = brushes.get(op.a);
    const brushB = brushes.get(op.b);

    if (!brushA) {
      console.error(`[CSG] Brush '${op.a}' not found`);
      return null;
    }
    if (!brushB) {
      console.error(`[CSG] Brush '${op.b}' not found`);
      return null;
    }

    let operation;
    switch (op.op) {
      case 'union':
      case 'add':
        operation = ADDITION;
        break;
      case 'subtract':
      case 'difference':
        operation = SUBTRACTION;
        break;
      case 'intersect':
      case 'intersection':
        operation = INTERSECTION;
        break;
      default:
        console.error(`[CSG] Unknown operation: ${op.op}`);
        return null;
    }

    // Perform the operation
    const result = this.evaluator.evaluate(brushA, brushB, operation);
    return result;
  }

  /**
   * Create material from spec
   */
  createMaterial(matDef) {
    if (!matDef) {
      return new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.5,
        roughness: 0.5
      });
    }

    return new THREE.MeshStandardMaterial({
      color: matDef.color || '#888888',
      metalness: matDef.metalness ?? 0.5,
      roughness: matDef.roughness ?? 0.5,
      flatShading: matDef.flatShading ?? false
    });
  }

  /**
   * Create error placeholder
   */
  createErrorMesh() {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    return new THREE.Mesh(geometry, material);
  }
}

/**
 * Check if a spec is CSG type
 */
function isCSGSpec(spec) {
  return spec && spec.type === 'csg';
}

/**
 * Build a CSG model from spec
 */
function buildCSG(spec) {
  const builder = new CSGBuilder();
  return builder.build(spec);
}

export { CSGBuilder, buildCSG, isCSGSpec };
