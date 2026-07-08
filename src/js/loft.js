/**
 * loft.js — generic profile-along-path lofting for the parts pipeline (#77).
 *
 * Ports hullgen's `buildLofts` math into a browser module: stations (rings of
 * 2D profile points) are mapped onto planes perpendicular to the local path
 * tangent, banded into quads, and capped with fans (flat centroid cap, or a
 * pointed cap when startPoint/endPoint is given). Triangle winding is
 * auto-oriented to face away from the loft's centroid, matching hullgen.
 *
 * The output is a non-indexed BufferGeometry with flat normals — the chunky
 * low-poly read the parts pipeline targets. One material per part (samdin
 * convention); use multiple loft parts where hullgen would use band materials.
 */
import * as THREE from 'three';

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const cross = (u, v) => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0]
];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/**
 * Build the loft's triangle soup.
 * def: {
 *   stations: [{ at: [x,y,z], points: [[px,py], ...] }, ...]   // ≥ 2, equal point counts
 *   startPoint?: [x,y,z]   // pointed nose cap; omitted → flat centroid fan
 *   endPoint?: [x,y,z]     // pointed tail cap; omitted → flat centroid fan
 *   mirror?: boolean       // duplicate mirrored across X into the same mesh
 * }
 */
export function buildLoftGeometry(def) {
  const stations = def.stations || [];
  if (stations.length < 2) {
    console.error('[loft] needs at least 2 stations');
    return new THREE.BufferGeometry();
  }
  const pointCount = stations[0].points?.length ?? 0;
  if (pointCount < 3 || stations.some((s) => (s.points?.length ?? 0) !== pointCount)) {
    console.error('[loft] all stations need the same point count (≥ 3)');
    return new THREE.BufferGeometry();
  }

  const positions = [];
  const emitTri = (a, b, c, centroid) => {
    // Auto-orient winding to face away from the loft centroid (hullgen rule).
    const n = cross(sub(b, a), sub(c, a));
    const fc = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const outward = dot(n, sub(fc, centroid)) >= 0;
    const [p, q, r] = outward ? [a, b, c] : [a, c, b];
    positions.push(...p, ...q, ...r);
  };

  const sides = def.mirror ? [-1, 1] : [1];
  for (const side of sides) {
    const centers = stations.map((s) => [side * s.at[0], s.at[1], s.at[2]]);
    const tangent = (i) => {
      const a = centers[Math.max(0, i - 1)];
      const b = centers[Math.min(centers.length - 1, i + 1)];
      const d = sub(b, a);
      const l = Math.hypot(...d) || 1;
      return d.map((c) => c / l);
    };

    const rings = stations.map((s, i) => {
      const t = tangent(i);
      const up = Math.abs(t[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
      let u = cross(up, t);
      const ul = Math.hypot(...u) || 1;
      u = u.map((c) => c / ul);
      const v = cross(t, u);
      return s.points.map(([px, py]) => [
        centers[i][0] + u[0] * px * side + v[0] * py,
        centers[i][1] + u[1] * px * side + v[1] * py,
        centers[i][2] + u[2] * px * side + v[2] * py
      ]);
    });

    // Loft centroid for winding orientation
    let cs = [0, 0, 0];
    let cn = 0;
    for (const r of rings) for (const p of r) { cs[0] += p[0]; cs[1] += p[1]; cs[2] += p[2]; cn++; }
    const centroid = [cs[0] / cn, cs[1] / cn, cs[2] / cn];

    const ringAvg = (r) =>
      r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length, a[2] + p[2] / r.length], [0, 0, 0]);
    const fan = (point, ring) => {
      for (let k = 0; k < ring.length; k++) {
        emitTri(point, ring[k], ring[(k + 1) % ring.length], centroid);
      }
    };

    fan(
      def.startPoint ? [side * def.startPoint[0], def.startPoint[1], def.startPoint[2]] : ringAvg(rings[0]),
      rings[0]
    );
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i];
      const b = rings[i + 1];
      for (let k = 0; k < pointCount; k++) {
        const k2 = (k + 1) % pointCount;
        emitTri(a[k], a[k2], b[k2], centroid);
        emitTri(a[k], b[k2], b[k], centroid);
      }
    }
    fan(
      def.endPoint ? [side * def.endPoint[0], def.endPoint[1], def.endPoint[2]] : ringAvg(rings[rings.length - 1]),
      rings[rings.length - 1]
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non-indexed → flat facet normals
  return geometry;
}
