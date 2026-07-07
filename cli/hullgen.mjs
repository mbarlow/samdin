#!/usr/bin/env node
/**
 * hullgen — procedural low-poly starfighter hull generator (v0).
 *
 * Escapes the primitive-kitbash ceiling: lofts faceted cross-sections along a
 * spine into ONE continuous flat-shaded mesh (fuselage, delta wing, V-tails,
 * engine nacelles with recessed glow throats), assigns materials per facet
 * band, and writes a self-contained .gltf (embedded buffer, flat normals).
 *
 * Target look: media/concepts/arcwing-interceptor-concept-v1.png
 * Usage: node cli/hullgen.mjs [out.gltf]   (default: media/models/arcwing-interceptor-hull.gltf)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ||
  path.join(__dirname, '..', 'media', 'models', 'arcwing-interceptor-hull.gltf');

// ── materials ────────────────────────────────────────────────────────────────
const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
};
const mat = (hex, { metal = 0.2, rough = 0.5, emissive = null, strength = 1 } = {}) => {
  const m = {
    pbrMetallicRoughness: {
      baseColorFactor: [...srgb(hex), 1],
      metallicFactor: metal,
      roughnessFactor: rough
    },
    doubleSided: true
  };
  if (emissive) {
    m.emissiveFactor = srgb(emissive);
    if (strength !== 1) m.extensions = { KHR_materials_emissive_strength: { emissiveStrength: strength } };
  }
  return m;
};

const MATERIALS = [
  /* 0 hullBlue  */ mat('#2f5fd0', { metal: 0.2, rough: 0.5 }),
  /* 1 hullNavy  */ mat('#17306e', { metal: 0.25, rough: 0.55 }),
  /* 2 trimOrange*/ mat('#ff7a2f', { metal: 0.1, rough: 0.45 }),
  /* 3 glass     */ mat('#0b2136', { metal: 0.2, rough: 0.12, emissive: '#1d5b8a', strength: 0.4 }),
  /* 4 glowCyan  */ mat('#082a30', { metal: 0, rough: 0.4, emissive: '#33f2ff', strength: 2.6 }),
  /* 5 navGreen  */ mat('#0a2a12', { metal: 0, rough: 0.4, emissive: '#33ff4d', strength: 2.0 }),
  /* 6 navRed    */ mat('#2a0a0a', { metal: 0, rough: 0.4, emissive: '#ff3333', strength: 2.0 })
];
const BLUE = 0, NAVY = 1, ORANGE = 2, GLASS = 3, GLOW = 4, GREEN = 5, RED = 6;

// ── mesh assembly ────────────────────────────────────────────────────────────
const tris = []; // {a,b,c,mat} — a/b/c are [x,y,z]

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** Emit a triangle, auto-orienting its winding to face away from `centroid`. */
function tri(a, b, c, matId, centroid, flip = false) {
  const n = cross(sub(b, a), sub(c, a));
  const fc = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  let outward = dot(n, sub(fc, centroid)) >= 0;
  if (flip) outward = !outward;
  tris.push(outward ? { a, b, c, mat: matId } : { a, b: c, c: b, mat: matId });
}

/** Quad band between two same-length closed rings. matFn(k) → material per facet. */
function band(ringA, ringB, matFn, centroid, flip = false) {
  const n = ringA.length;
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    const m = typeof matFn === 'function' ? matFn(k) : matFn;
    tri(ringA[k], ringA[k2], ringB[k2], m, centroid, flip);
    tri(ringA[k], ringB[k2], ringB[k], m, centroid, flip);
  }
}

/** Triangle fan from a point to a closed ring (nose tips, caps). */
function fan(point, ring, matId, centroid, flip = false) {
  const n = ring.length;
  for (let k = 0; k < n; k++) {
    tri(point, ring[k], ring[(k + 1) % n], matId, centroid, flip);
  }
}

const ringCentroid = (rings) => {
  let s = [0, 0, 0], c = 0;
  for (const r of rings) for (const p of r) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; c++; }
  return [s[0] / c, s[1] / c, s[2] / c];
};

// ── fuselage: 8-pt chined profile lofted nose→tail ──────────────────────────
// station: { z, yT, wS, yS, wC, yC, wB, yL, yB }
const FUSELAGE = [
  { z: 1.15, yT: 0.10, wS: 0.09, yS: 0.07, wC: 0.16, yC: 0.00, wB: 0.10, yL: -0.07, yB: -0.10 },
  { z: 0.55, yT: 0.22, wS: 0.16, yS: 0.16, wC: 0.30, yC: 0.00, wB: 0.18, yL: -0.13, yB: -0.18 },
  { z: -0.15, yT: 0.26, wS: 0.19, yS: 0.19, wC: 0.34, yC: -0.01, wB: 0.20, yL: -0.15, yB: -0.21 },
  { z: -0.85, yT: 0.28, wS: 0.20, yS: 0.20, wC: 0.33, yC: -0.01, wB: 0.19, yL: -0.14, yB: -0.20 },
  { z: -1.50, yT: 0.22, wS: 0.15, yS: 0.16, wC: 0.26, yC: 0.00, wB: 0.15, yL: -0.11, yB: -0.16 }
];
const NOSE_TIP = [0, 0.0, 1.8];

const fuseRing = (s) => [
  [0, s.yT, s.z], [s.wS, s.yS, s.z], [s.wC, s.yC, s.z], [s.wB, s.yL, s.z],
  [0, s.yB, s.z], [-s.wB, s.yL, s.z], [-s.wC, s.yC, s.z], [-s.wS, s.yS, s.z]
];
// bands 2-5 are the lower hull → navy; the rest blue
const fuseMat = (k) => (k >= 2 && k <= 5 ? NAVY : BLUE);

{
  const rings = FUSELAGE.map(fuseRing);
  const c = ringCentroid(rings);
  fan(NOSE_TIP, rings[0], BLUE, c);
  for (let i = 0; i < rings.length - 1; i++) band(rings[i], rings[i + 1], fuseMat, c);
  const last = FUSELAGE[FUSELAGE.length - 1];
  fan([0, (last.yT + last.yB) / 2, last.z], rings[rings.length - 1], NAVY, c); // tail bulkhead
}

// ── delta wing: one continuous loft tip→tip through the hull ────────────────
// station: { x, zLE, zTE, yMid, th }
const WING = [
  { x: -1.65, zLE: -0.78, zTE: -1.22, yMid: 0.07, th: 0.045 },
  { x: -1.05, zLE: -0.15, zTE: -1.28, yMid: 0.02, th: 0.09 },
  { x: -0.50, zLE: 0.55, zTE: -1.30, yMid: -0.01, th: 0.13 },
  { x: 0.00, zLE: 0.95, zTE: -1.30, yMid: -0.02, th: 0.16 },
  { x: 0.50, zLE: 0.55, zTE: -1.30, yMid: -0.01, th: 0.13 },
  { x: 1.05, zLE: -0.15, zTE: -1.28, yMid: 0.02, th: 0.09 },
  { x: 1.65, zLE: -0.78, zTE: -1.22, yMid: 0.07, th: 0.045 }
];
// 8-pt airfoil: LE, leTop, topF, topR, TE, botR, botF, leBot
const wingRing = (s) => {
  const c = s.zLE - s.zTE, h = s.th / 2;
  return [
    [s.x, s.yMid, s.zLE],
    [s.x, s.yMid + h * 0.7, s.zLE - 0.06 * c],
    [s.x, s.yMid + h, s.zLE - 0.30 * c],
    [s.x, s.yMid + h, s.zTE + 0.22 * c],
    [s.x, s.yMid, s.zTE],
    [s.x, s.yMid - h, s.zTE + 0.22 * c],
    [s.x, s.yMid - h, s.zLE - 0.30 * c],
    [s.x, s.yMid - h * 0.7, s.zLE - 0.06 * c]
  ];
};
// band 0-1 upper LE strip → orange; underside (4..7) navy
const wingMat = (k) => (k === 0 ? ORANGE : k >= 4 ? NAVY : BLUE);

{
  const rings = WING.map(wingRing);
  const c = ringCentroid(rings);
  fan([WING[0].x, WING[0].yMid, (WING[0].zLE + WING[0].zTE) / 2], rings[0], BLUE, c); // port tip cap
  for (let i = 0; i < rings.length - 1; i++) band(rings[i], rings[i + 1], wingMat, c);
  const e = WING[WING.length - 1];
  fan([e.x, e.yMid, (e.zLE + e.zTE) / 2], rings[rings.length - 1], BLUE, c); // starboard tip cap
}

// ── V-tails: canted fins, orange trailing edge ───────────────────────────────
// station along fin: { x, y, zLE, zTE, th } — diamond section, thickness in X
const vtailStations = (side) => [
  { x: side * 0.24, y: 0.26, zLE: -0.78, zTE: -1.48, th: 0.09 },
  { x: side * 0.48, y: 0.58, zLE: -0.98, zTE: -1.50, th: 0.065 },
  { x: side * 0.68, y: 0.88, zLE: -1.14, zTE: -1.52, th: 0.045 }
];
const finRing = (s) => {
  const mid = (s.zLE + s.zTE) / 2, h = s.th / 2;
  return [
    [s.x, s.y, s.zLE], [s.x + h, s.y, mid], [s.x, s.y, s.zTE], [s.x - h, s.y, mid]
  ];
};
const finMat = BLUE; // solid blue; orange lives on the tip cap only

for (const side of [-1, 1]) {
  const st = vtailStations(side);
  const rings = st.map(finRing);
  const c = ringCentroid(rings);
  for (let i = 0; i < rings.length - 1; i++) band(rings[i], rings[i + 1], finMat, c);
  const e = st[st.length - 1];
  fan([e.x, e.y, (e.zLE + e.zTE) / 2], rings[rings.length - 1], ORANGE, c); // tip cap
}

// ── engines: octagon nacelles, recessed cyan throats ────────────────────────
const octo = (cx, cy, z, r) => {
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
  }
  return ring;
};

for (const side of [-1, 1]) {
  const cx = side * 0.22, cy = 0.22;           // merged into the rear spine, not perched on it
  const rOut = 0.155, rIn = 0.115;
  const zFront = -0.35, zBack = -1.56, zThroat = -1.42;
  const c = [cx, cy, (zFront + zBack) / 2];

  const outNose = octo(cx, cy, zFront, rOut * 0.55); // tapered intake nose
  const outF = octo(cx, cy, zFront - 0.28, rOut);
  const outB = octo(cx, cy, zBack, rOut);
  band(outNose, outF, BLUE, c);                 // intake bevel
  band(outF, outB, BLUE, c);                    // housing
  fan([cx, cy, zFront], outNose, BLUE, c);      // front cap

  const inB = octo(cx, cy, zBack, rIn);
  band(outB, inB, NAVY, c);                     // rear rim annulus
  const inT = octo(cx, cy, zThroat, rIn);
  band(inB, inT, NAVY, c, true);                // inner throat wall (faces inward)
  fan([cx, cy, zThroat], inT, GLOW, c, true);   // recessed glow disk (faces aft)
}

// ── wingtip nav pods ─────────────────────────────────────────────────────────
for (const side of [-1, 1]) {
  const cx = side * 1.68, cy = 0.07, cz = -1.0, r = 0.05;
  const c = [cx, cy, cz];
  const ring = [
    [cx + r, cy, cz], [cx, cy, cz + r], [cx - r, cy, cz], [cx, cy, cz - r]
  ];
  const matId = side > 0 ? GREEN : RED;
  fan([cx, cy + r, cz], ring, matId, c);
  fan([cx, cy - r, cz], ring, matId, c);
}

// ── canopy: faceted glass blister set into the spine ────────────────────────
const spineTopAt = (z) => { // linear interp over fuselage yT
  for (let i = 0; i < FUSELAGE.length - 1; i++) {
    const a = FUSELAGE[i], b = FUSELAGE[i + 1];
    if (z <= a.z && z >= b.z) {
      const t = (a.z - z) / (a.z - b.z);
      return a.yT + (b.yT - a.yT) * t;
    }
  }
  return FUSELAGE[0].yT;
};
const canopyRing = (z, w, h) => {
  const y0 = spineTopAt(z) - 0.03;
  return [
    [-w, y0, z], [-w * 0.7, y0 + h * 0.75, z], [0, y0 + h, z],
    [w * 0.7, y0 + h * 0.75, z], [w, y0, z], [0, y0 - 0.03, z]
  ];
};
{
  const rings = [
    canopyRing(0.60, 0.12, 0.11),
    canopyRing(0.30, 0.16, 0.19),
    canopyRing(-0.08, 0.15, 0.17)
  ];
  const c = ringCentroid(rings);
  fan([0, spineTopAt(0.72) + 0.01, 0.72], rings[0], GLASS, c); // front point
  for (let i = 0; i < rings.length - 1; i++) band(rings[i], rings[i + 1], GLASS, c);
  fan([0, spineTopAt(-0.18) + 0.05, -0.18], rings[rings.length - 1], GLASS, c); // rear cap
}

// ── glTF writer: unindexed, flat normals, one primitive per material ────────
const norm = (a, b, c) => {
  const n = cross(sub(b, a), sub(c, a));
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
};

const byMat = new Map();
for (const t of tris) {
  if (!byMat.has(t.mat)) byMat.set(t.mat, { pos: [], nrm: [] });
  const g = byMat.get(t.mat);
  const n = norm(t.a, t.b, t.c);
  for (const p of [t.a, t.b, t.c]) { g.pos.push(...p); g.nrm.push(...n); }
}

const bufParts = [], bufferViews = [], accessors = [], primitives = [];
let offset = 0;
for (const [matId, g] of [...byMat.entries()].sort((a, b) => a[0] - b[0])) {
  const pos = new Float32Array(g.pos), nrm = new Float32Array(g.nrm);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let d = 0; d < 3; d++) {
      min[d] = Math.min(min[d], pos[i + d]);
      max[d] = Math.max(max[d], pos[i + d]);
    }
  }
  const attrs = {};
  for (const [name, arr, extra] of [['POSITION', pos, { min, max }], ['NORMAL', nrm, {}]]) {
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: arr.byteLength });
    bufParts.push(Buffer.from(arr.buffer));
    offset += arr.byteLength;
    accessors.push({
      bufferView: bufferViews.length - 1, componentType: 5126,
      count: arr.length / 3, type: 'VEC3', ...extra
    });
    attrs[name] = accessors.length - 1;
  }
  primitives.push({ attributes: attrs, material: matId, mode: 4 });
}

const bin = Buffer.concat(bufParts);
const gltf = {
  asset: { version: '2.0', generator: 'samdin hullgen v0' },
  extensionsUsed: ['KHR_materials_emissive_strength'],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'arcwing-interceptor-hull' }],
  meshes: [{ primitives, name: 'hull' }],
  materials: MATERIALS,
  buffers: [{ byteLength: bin.byteLength, uri: `data:application/octet-stream;base64,${bin.toString('base64')}` }],
  bufferViews, accessors
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(gltf));
console.log(`wrote ${OUT}`);
console.log(`  ${tris.length} tris, ${primitives.length} materials, ${(bin.byteLength / 1024).toFixed(1)} KiB buffer`);
