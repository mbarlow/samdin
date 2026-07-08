/**
 * deform.js — gestural deformers for the parts pipeline (#78).
 *
 * Opt-in per-part `deform` block, applied to a mesh's local geometry after
 * creation and before surface treatments (so breakup vertex colors follow the
 * deformed shape). Pure vertex transforms — no topology change, so segment
 * counts still come from the primitive params (a bend needs enough height
 * segments to read; use params or a boxier primitive when it looks faceted).
 *
 * Order: taper → twist → bend.
 *
 *   "deform": {
 *     "taper": 0.4,                          // or { "amount": 0.4, "axis": "y" }
 *     "twist": 25,                           // or { "angle": 25, "axis": "y" }
 *     "bend":  { "angle": 30, "axis": "x" }  // rotation axis; along-axis is y
 *   }
 *
 * taper: cross-section scale runs 1 → amount from base to top of the along
 * axis. twist: rotation about the along axis runs 0 → angle. bend: the along
 * axis arcs by angle about the given rotation axis, pivoting at the base.
 */
import * as THREE from 'three';

const AXIS_INDEX = { x: 0, y: 1, z: 2 };

function alongParam(geometry, axisIdx) {
  geometry.computeBoundingBox();
  const min = geometry.boundingBox.min.getComponent(axisIdx);
  const max = geometry.boundingBox.max.getComponent(axisIdx);
  const span = Math.max(max - min, 1e-6);
  return (v) => (v - min) / span;
}

function normalizeDeform(def) {
  const out = {};
  if (def.taper !== undefined) {
    out.taper = typeof def.taper === 'number' ? { amount: def.taper, axis: 'y' } : { axis: 'y', ...def.taper };
  }
  if (def.twist !== undefined) {
    out.twist = typeof def.twist === 'number' ? { angle: def.twist, axis: 'y' } : { axis: 'y', ...def.twist };
  }
  if (def.bend !== undefined) {
    out.bend = typeof def.bend === 'number' ? { angle: def.bend, axis: 'x' } : { axis: 'x', ...def.bend };
  }
  return out;
}

/** Apply the deform block to a single mesh's geometry (clones first). */
export function applyDeformToMesh(mesh, deformDef) {
  const source = mesh.geometry;
  if (!source?.attributes?.position) return;

  const geometry = source.clone();
  const pos = geometry.attributes.position;
  const ops = normalizeDeform(deformDef || {});
  const v = new THREE.Vector3();

  if (ops.taper) {
    const along = AXIS_INDEX[ops.taper.axis] ?? 1;
    const t = alongParam(geometry, along);
    const amount = ops.taper.amount ?? 1;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const s = 1 + (amount - 1) * t(v.getComponent(along));
      for (let a = 0; a < 3; a++) {
        if (a !== along) v.setComponent(a, v.getComponent(a) * s);
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }

  if (ops.twist) {
    const along = AXIS_INDEX[ops.twist.axis] ?? 1;
    const t = alongParam(geometry, along);
    const angle = THREE.MathUtils.degToRad(ops.twist.angle ?? 0);
    const axisVec = new THREE.Vector3().setComponent(along, 1);
    const q = new THREE.Quaternion();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      q.setFromAxisAngle(axisVec, angle * t(v.getComponent(along)));
      v.applyQuaternion(q);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }

  if (ops.bend) {
    // Arc the along axis (y) by angle about the rotation axis, pivot at base.
    const along = AXIS_INDEX[ops.bend.along ?? 'y'] ?? 1;
    const rotIdx = AXIS_INDEX[ops.bend.axis] ?? 0;
    const t = alongParam(geometry, along);
    const angle = THREE.MathUtils.degToRad(ops.bend.angle ?? 0);
    geometry.computeBoundingBox();
    const base = geometry.boundingBox.min.getComponent(along);
    const axisVec = new THREE.Vector3().setComponent(rotIdx, 1);
    const q = new THREE.Quaternion();
    const pivot = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const k = t(v.getComponent(along));
      pivot.set(0, 0, 0).setComponent(along, base);
      q.setFromAxisAngle(axisVec, angle * k);
      v.sub(pivot).applyQuaternion(q).add(pivot);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry = geometry;
}

/** Apply to every mesh under an object (a part may be a group, e.g. CSG multi-output). */
export function applyDeform(object, deformDef) {
  object.traverse((child) => {
    if (child.isMesh) applyDeformToMesh(child, deformDef);
  });
}
