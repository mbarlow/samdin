#!/usr/bin/env node
/**
 * hullgen — procedural low-poly starfighter hull generator.
 *
 * Escapes the primitive-kitbash ceiling: lofts faceted cross-sections along a
 * spine into ONE continuous flat-shaded mesh, assigns materials per facet
 * band, auto-orients winding, and writes a self-contained .gltf (embedded
 * buffer, flat normals, stdlib-only — no deps).
 *
 * Ships are data: JSON definitions in cli/ships/*.json describe the palette
 * and the lofted components (fuselage, wing, vtails, engines, canopy/eye,
 * navPods). The generator is anatomy-agnostic — components are optional.
 *
 * Usage:
 *   node cli/hullgen.mjs                      # build every def in cli/ships/
 *   node cli/hullgen.mjs cli/ships/foo.json   # build one
 * Output: media/models/<name>-hull.gltf  (loads via app.loader.loadFromURL)
 *
 * Target look: media/concepts/ (No Man's Sky chunky low-poly).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const SHIP_DIR = path.join(__dirname, 'ships');
const OUT_DIR = path.join(REPO, 'media', 'models');

// ── color / material helpers ─────────────────────────────────────────────────
const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
};
const pbr = (hex, { metal = 0.2, rough = 0.5, emissive = null, strength = 1 } = {}) => {
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

// material slot order is fixed; palettes recolor the slots
const HULL = 0, PANEL = 1, TRIM = 2, GLASS = 3, GLOW = 4, GREEN = 5, RED = 6;
const SLOT = { hull: HULL, panel: PANEL, trim: TRIM, glass: GLASS, glow: GLOW };

const buildMaterials = (p) => [
  pbr(p.hull, { metal: 0.2, rough: 0.5 }),
  pbr(p.panel, { metal: 0.25, rough: 0.55 }),
  pbr(p.trim, { metal: 0.1, rough: 0.45 }),
  pbr(p.glass ?? '#0b2136', { metal: 0.2, rough: 0.12, emissive: p.glassGlow ?? '#1d5b8a', strength: 0.4 }),
  pbr('#0a1a1c', { metal: 0, rough: 0.4, emissive: p.glow, strength: p.glowStrength ?? 2.6 }),
  pbr('#0a2a12', { metal: 0, rough: 0.4, emissive: '#33ff4d', strength: 2.0 }),
  pbr('#2a0a0a', { metal: 0, rough: 0.4, emissive: '#ff3333', strength: 2.0 })
];

// ── vector + triangle-soup helpers ───────────────────────────────────────────
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

function makeMesh() {
  const tris = [];
  /** Emit a triangle, auto-orienting winding to face away from `centroid`. */
  const tri = (a, b, c, matId, centroid, flip = false) => {
    const n = cross(sub(b, a), sub(c, a));
    const fc = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    let outward = dot(n, sub(fc, centroid)) >= 0;
    if (flip) outward = !outward;
    tris.push(outward ? { a, b, c, mat: matId } : { a, b: c, c: b, mat: matId });
  };
  /** Quad band between two same-length closed rings. matFn(k) → material per facet. */
  const band = (ringA, ringB, matFn, centroid, flip = false) => {
    const n = ringA.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const m = typeof matFn === 'function' ? matFn(k) : matFn;
      tri(ringA[k], ringA[k2], ringB[k2], m, centroid, flip);
      tri(ringA[k], ringB[k2], ringB[k], m, centroid, flip);
    }
  };
  /** Triangle fan from a point to a closed ring (nose tips, caps). */
  const fan = (point, ring, matId, centroid, flip = false) => {
    const n = ring.length;
    for (let k = 0; k < n; k++) tri(point, ring[k], ring[(k + 1) % n], matId, centroid, flip);
  };
  return { tris, tri, band, fan };
}

const ringCentroid = (rings) => {
  let s = [0, 0, 0], c = 0;
  for (const r of rings) for (const p of r) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; c++; }
  return [s[0] / c, s[1] / c, s[2] / c];
};

const slot = (name, fallback) => (name ? SLOT[name] : fallback);

// ── components ───────────────────────────────────────────────────────────────

// fuselage: 8-pt chined profile lofted nose→tail
// station: { z, yT, wS, yS, wC, yC, wB, yL, yB }
const fuseRing = (s) => [
  [0, s.yT, s.z], [s.wS, s.yS, s.z], [s.wC, s.yC, s.z], [s.wB, s.yL, s.z],
  [0, s.yB, s.z], [-s.wB, s.yL, s.z], [-s.wC, s.yC, s.z], [-s.wS, s.yS, s.z]
];

function buildFuselage(mesh, def) {
  const under = slot(def.underside, PANEL);
  const matFn = (k) => (k >= 2 && k <= 5 ? under : HULL);
  const rings = def.stations.map(fuseRing);
  const c = ringCentroid(rings);
  mesh.fan(def.noseTip, rings[0], HULL, c);
  for (let i = 0; i < rings.length - 1; i++) mesh.band(rings[i], rings[i + 1], matFn, c);
  const last = def.stations[def.stations.length - 1];
  mesh.fan([0, (last.yT + last.yB) / 2, last.z], rings[rings.length - 1], slot(def.tailCap, PANEL), c);
}

// wing: one continuous loft tip→tip through the hull
// station: { x, zLE, zTE, yMid, th } — 8-pt airfoil, sharp LE/TE
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

function buildWing(mesh, def) {
  const base = slot(def.color, HULL);
  const under = slot(def.underside, PANEL);
  const matFn = (k) => (k === 0 && def.leTrim ? TRIM : k >= 4 ? under : base);
  const rings = def.stations.map(wingRing);
  const c = ringCentroid(rings);
  const cap = (s) => [s.x, s.yMid, (s.zLE + s.zTE) / 2];
  mesh.fan(cap(def.stations[0]), rings[0], base, c);
  for (let i = 0; i < rings.length - 1; i++) mesh.band(rings[i], rings[i + 1], matFn, c);
  mesh.fan(cap(def.stations[def.stations.length - 1]), rings[rings.length - 1], base, c);
}

// vtails: canted fins, defined for +x and mirrored
// station: { x, y, zLE, zTE, th } — 4-pt diamond, thickness in X
const finRing = (s, side) => {
  const mid = (s.zLE + s.zTE) / 2, h = s.th / 2;
  return [
    [side * s.x, s.y, s.zLE], [side * s.x + h, s.y, mid],
    [side * s.x, s.y, s.zTE], [side * s.x - h, s.y, mid]
  ];
};

function buildVtails(mesh, def) {
  const tip = slot(def.tipColor, TRIM);
  for (const side of [-1, 1]) {
    const rings = def.stations.map((s) => finRing(s, side));
    const c = ringCentroid(rings);
    for (let i = 0; i < rings.length - 1; i++) mesh.band(rings[i], rings[i + 1], HULL, c);
    const e = def.stations[def.stations.length - 1];
    mesh.fan([side * e.x, e.y, (e.zLE + e.zTE) / 2], rings[rings.length - 1], tip, c);
  }
}

// engines: octagonal nacelle, tapered intake, recessed emissive throat
// def: { x, y, rOut, rIn, zFront, zBack, zThroat, mirror }
const octo = (cx, cy, z, r) => {
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
  }
  return ring;
};

function buildEngine(mesh, e) {
  const sides = e.mirror ? [-1, 1] : [1];
  for (const side of sides) {
    const cx = side * e.x, cy = e.y;
    const c = [cx, cy, (e.zFront + e.zBack) / 2];
    const bevel = Math.min(0.28, (e.zBack - e.zFront) * -0.2);
    const outNose = octo(cx, cy, e.zFront, e.rOut * 0.55);
    const outF = octo(cx, cy, e.zFront - Math.abs(bevel), e.rOut);
    const outB = octo(cx, cy, e.zBack, e.rOut);
    mesh.band(outNose, outF, HULL, c);            // intake bevel
    mesh.band(outF, outB, HULL, c);               // housing
    mesh.fan([cx, cy, e.zFront], outNose, HULL, c); // front cap
    const inB = octo(cx, cy, e.zBack, e.rIn);
    mesh.band(outB, inB, PANEL, c);               // rear rim annulus
    const inT = octo(cx, cy, e.zThroat, e.rIn);
    mesh.band(inB, inT, PANEL, c, true);          // inner throat wall (faces inward)
    mesh.fan([cx, cy, e.zThroat], inT, GLOW, c, true); // recessed glow disk
  }
}

// canopy/eye: faceted blister set into the spine (glass cockpit or glow eye)
// def: { material, sink, frontPoint {z,lift}, rearPoint {z,lift}, rings [{z,w,h}] }
function buildCanopy(mesh, def, spineTopAt) {
  const matId = slot(def.material, GLASS);
  const sink = def.sink ?? 0.03;
  const ring = (r) => {
    const y0 = spineTopAt(r.z) - sink;
    return [
      [-r.w, y0, r.z], [-r.w * 0.7, y0 + r.h * 0.75, r.z], [0, y0 + r.h, r.z],
      [r.w * 0.7, y0 + r.h * 0.75, r.z], [r.w, y0, r.z], [0, y0 - sink, r.z]
    ];
  };
  const rings = def.rings.map(ring);
  const c = ringCentroid(rings);
  mesh.fan([0, spineTopAt(def.frontPoint.z) + def.frontPoint.lift, def.frontPoint.z], rings[0], matId, c);
  for (let i = 0; i < rings.length - 1; i++) mesh.band(rings[i], rings[i + 1], matId, c);
  mesh.fan([0, spineTopAt(def.rearPoint.z) + def.rearPoint.lift, def.rearPoint.z], rings[rings.length - 1], matId, c);
}

// lofts: the fully generic component — arbitrary profile points lofted along
// an arbitrary (curved) path. Everything the fixed-profile components can't
// express: creature bodies, flukes, fins, boat hulls, bottles-with-character.
// def: { material, bandMaterials?: {"<bandIdx>": mat}, mirror?,
//        startPoint?/endPoint?: [x,y,z] (pointed cap; else flat cap),
//        stations: [{ at:[x,y,z], points:[[px,py],...] }] }
// Each station is a ring: profile [px,py] mapped onto a plane perpendicular
// to the local path tangent (px ≈ horizontal, py ≈ vertical). All stations
// need the same point count. Winding is auto-oriented like everything else.
function buildLofts(mesh, defs) {
  for (const L of defs) {
    const sides = L.mirror ? [-1, 1] : [1];
    for (const side of sides) {
      const centers = L.stations.map((s) => [side * s.at[0], s.at[1], s.at[2]]);
      const tangent = (i) => {
        const a = centers[Math.max(0, i - 1)], b = centers[Math.min(centers.length - 1, i + 1)];
        const d = sub(b, a); const l = Math.hypot(...d) || 1;
        return d.map((c) => c / l);
      };
      const rings = L.stations.map((s, i) => {
        const t = tangent(i);
        const up = Math.abs(t[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
        let u = cross(up, t);
        const ul = Math.hypot(...u) || 1; u = u.map((c) => c / ul);
        const v = cross(t, u);
        return s.points.map(([px, py]) => [
          centers[i][0] + u[0] * px * side + v[0] * py,
          centers[i][1] + u[1] * px * side + v[1] * py,
          centers[i][2] + u[2] * px * side + v[2] * py
        ]);
      });
      const c = ringCentroid(rings);
      const base = slot(L.material, HULL);
      const bandMat = (k) =>
        L.bandMaterials && L.bandMaterials[k] != null ? slot(L.bandMaterials[k], base) : base;
      const ringAvg = (r) => r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length, a[2] + p[2] / r.length], [0, 0, 0]);
      mesh.fan(L.startPoint ? [side * L.startPoint[0], L.startPoint[1], L.startPoint[2]] : ringAvg(rings[0]),
        rings[0], base, c);
      for (let i = 0; i < rings.length - 1; i++) mesh.band(rings[i], rings[i + 1], bandMat, c);
      mesh.fan(L.endPoint ? [side * L.endPoint[0], L.endPoint[1], L.endPoint[2]] : ringAvg(rings[rings.length - 1]),
        rings[rings.length - 1], base, c);
    }
  }
}

// pods: octagonal prisms along an arbitrary axis, optional pointed tip.
// Covers barrels, warheads, spikes, coils, towers, masts, lit strips.
// def: { at:[x,y,z], axis:"x"|"y"|"z"|[dx,dy,dz], r, len, material,
//        tip?: material (pointed tip; length ~1.6r), mirror?: bool }
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

function ringAt(center, dir, r) {
  const up = Math.abs(dir[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  let u = cross(dir, up);
  const ul = Math.hypot(...u); u = u.map((c) => c / ul);
  const v = cross(dir, u);
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const cu = Math.cos(a) * r, cv = Math.sin(a) * r;
    ring.push([center[0] + u[0] * cu + v[0] * cv,
               center[1] + u[1] * cu + v[1] * cv,
               center[2] + u[2] * cu + v[2] * cv]);
  }
  return ring;
}

function buildPods(mesh, defs) {
  for (const p of defs) {
    const dirRaw = Array.isArray(p.axis) ? p.axis : AXES[p.axis ?? 'z'];
    const dl = Math.hypot(...dirRaw);
    const dir = dirRaw.map((c) => c / dl);
    const matId = slot(p.material, PANEL);
    const sides = p.mirror ? [-1, 1] : [1];
    for (const side of sides) {
      const at = [side * p.at[0], p.at[1], p.at[2]];
      const d = [side === -1 && Math.abs(dir[0]) > 0 ? -dir[0] : dir[0], dir[1], dir[2]];
      const end = [at[0] + d[0] * p.len, at[1] + d[1] * p.len, at[2] + d[2] * p.len];
      const c = [(at[0] + end[0]) / 2, (at[1] + end[1]) / 2, (at[2] + end[2]) / 2];
      const base = ringAt(at, d, p.r);
      const top = ringAt(end, d, p.r);
      mesh.band(base, top, matId, c);
      mesh.fan(at, base, matId, c);
      if (p.tip) {
        const tipLen = p.tipLen ?? p.r * 1.6;
        mesh.fan([end[0] + d[0] * tipLen, end[1] + d[1] * tipLen, end[2] + d[2] * tipLen],
          top, slot(p.tip, GLOW), c);
      } else {
        mesh.fan(end, top, matId, c);
      }
    }
  }
}

// navPods: wingtip octahedra — green starboard (+x), red port (-x)
function buildNavPods(mesh, def) {
  for (const side of [-1, 1]) {
    const cx = side * def.x, cy = def.y, cz = def.z, r = def.r;
    const c = [cx, cy, cz];
    const ring = [[cx + r, cy, cz], [cx, cy, cz + r], [cx - r, cy, cz], [cx, cy, cz - r]];
    const matId = side > 0 ? GREEN : RED;
    mesh.fan([cx, cy + r, cz], ring, matId, c);
    mesh.fan([cx, cy - r, cz], ring, matId, c);
  }
}

// ── ship assembly ────────────────────────────────────────────────────────────
function buildShip(def) {
  const mesh = makeMesh();
  const fst = def.fuselage?.stations;
  const spineTopAt = (z) => { // linear interp over fuselage yT, clamped
    if (z >= fst[0].z) return fst[0].yT;
    for (let i = 0; i < fst.length - 1; i++) {
      const a = fst[i], b = fst[i + 1];
      if (z <= a.z && z >= b.z) return a.yT + ((b.yT - a.yT) * (a.z - z)) / (a.z - b.z);
    }
    return fst[fst.length - 1].yT;
  };

  if (def.fuselage) buildFuselage(mesh, def.fuselage);
  if (def.wing) buildWing(mesh, def.wing);
  if (def.vtails) buildVtails(mesh, def.vtails);
  for (const e of def.engines ?? []) buildEngine(mesh, e);
  if (def.canopy) {
    if (!fst) throw new Error(`${def.name}: canopy requires a fuselage (spine interpolation)`);
    buildCanopy(mesh, def.canopy, spineTopAt);
  }
  if (def.lofts) buildLofts(mesh, def.lofts);
  if (def.pods) buildPods(mesh, def.pods);
  if (def.navPods) buildNavPods(mesh, def.navPods);
  if (!mesh.tris.length) throw new Error(`${def.name}: def produced no geometry`);
  return mesh.tris;
}

// ── glTF writer: unindexed, flat normals, one primitive per material ────────
function writeGltf(name, tris, materials, outPath) {
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
    for (const [attr, arr, extra] of [['POSITION', pos, { min, max }], ['NORMAL', nrm, {}]]) {
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: arr.byteLength });
      bufParts.push(Buffer.from(arr.buffer));
      offset += arr.byteLength;
      accessors.push({
        bufferView: bufferViews.length - 1, componentType: 5126,
        count: arr.length / 3, type: 'VEC3', ...extra
      });
      attrs[attr] = accessors.length - 1;
    }
    primitives.push({ attributes: attrs, material: matId, mode: 4 });
  }

  const bin = Buffer.concat(bufParts);
  const gltf = {
    asset: { version: '2.0', generator: 'samdin hullgen' },
    extensionsUsed: ['KHR_materials_emissive_strength'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{ primitives, name: 'hull' }],
    materials,
    buffers: [{ byteLength: bin.byteLength, uri: `data:application/octet-stream;base64,${bin.toString('base64')}` }],
    bufferViews, accessors
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(gltf));
  return { tris: tris.length, materials: primitives.length, kib: bin.byteLength / 1024 };
}

// ── Lua emitter: bake ships as arcwing/g3d vert tables ──────────────────────
// arcwing frame: +X forward, +Z up (hullgen: +Z forward, +Y up) — cyclic
// remap (x,y,z)→(z,x,y) preserves handedness so winding stays valid.
// Vert format: {x,y,z, u,v, nx,ny,nz, r,g,b,a} — flat normals, per-face
// color with arcwing's faceting jitter baked in. Colors are the palette's
// sRGB values (arcwing's flat shader uses vertex colors directly).
const srgb01 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function slotColor(matId, p) {
  const mix = (a, b, t) => a.map((c, i) => c * (1 - t) + b[i] * t);
  const boost = (c, f) => c.map((v) => Math.min(1, v * f));
  switch (matId) {
    case HULL: return srgb01(p.hull);
    case PANEL: return srgb01(p.panel);
    case TRIM: return srgb01(p.trim);
    case GLASS: return mix(srgb01(p.glass ?? '#0b2136'), srgb01(p.glassGlow ?? '#1d5b8a'), 0.35);
    case GLOW: return boost(srgb01(p.glow), 1.15);
    case GREEN: return boost(srgb01('#33ff4d'), 1.1);
    case RED: return boost(srgb01('#ff3333'), 1.1);
  }
}

function emitLua(ships, outPath) {
  const f = (n) => {
    const s = n.toFixed(4).replace(/\.?0+$/, '');
    return s === '-0' || s === '' ? '0' : s;
  };
  const lines = [
    '-- hulls.lua — GENERATED by samdin cli/hullgen.mjs (--lua). Do not hand-edit;',
    '-- edit the ship defs in samdin cli/ships/ and re-emit. g3d vert tables:',
    '-- {x,y,z, u,v, nx,ny,nz, r,g,b,a}, flat normals, per-face color+jitter baked.',
    'local H = {}'
  ];
  for (const { name, tris, palette } of ships) {
    const key = name.replace(/^arcwing-/, '').replace(/-/g, '_');
    lines.push(`H.${key} = {`);
    tris.forEach((t, ti) => {
      const nn = cross(sub(t.b, t.a), sub(t.c, t.a));
      const l = Math.hypot(...nn) || 1;
      const n = [nn[0] / l, nn[1] / l, nn[2] / l];
      const jitter = 1 - 0.05 + (ti % 7) / 7 * 0.10; // arcwing geometry.lua faceting
      const col = slotColor(t.mat, palette).map((c) => Math.min(1, c * jitter));
      const cstr = col.map(f).join(',');
      const nx = f(n[2]), ny = f(n[0]), nz = f(n[1]); // remap (x,y,z)→(z,x,y)
      for (const p of [t.a, t.b, t.c]) {
        lines.push(`  {${f(p[2])},${f(p[0])},${f(p[1])},0,0,${nx},${ny},${nz},${cstr},1},`);
      }
    });
    lines.push('}');
  }
  lines.push('return H', '');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'));
  return lines.length;
}

// ── main ─────────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const luaIdx = rawArgs.indexOf('--lua');
const luaOut = luaIdx !== -1 ? rawArgs[luaIdx + 1] : null;
const args = rawArgs.filter((a, i) => i !== luaIdx && i !== luaIdx + 1);
const defFiles = args.length
  ? args
  : fs.readdirSync(SHIP_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(SHIP_DIR, f));

const built = [];
for (const file of defFiles) {
  const def = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const tris = buildShip(def);
  const out = path.join(OUT_DIR, `${def.name}-hull.gltf`);
  const stats = writeGltf(def.name, tris, buildMaterials(def.palette), out);
  built.push({ name: def.name, tris, palette: def.palette });
  console.log(`${def.name}: ${stats.tris} tris, ${stats.materials} materials, ${stats.kib.toFixed(1)} KiB → ${path.relative(REPO, out)}`);
}

if (luaOut) {
  // game hulls only — the arcwing-* fleet, not gallery pieces like the whale
  const ships = built.filter((s) => s.name.startsWith('arcwing-'));
  const n = emitLua(ships, luaOut);
  console.log(`lua: ${ships.length} ships → ${luaOut} (${n} lines)`);
}
