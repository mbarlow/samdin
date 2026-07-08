/**
 * terrain/water.js - Water as a level, not an object (#96).
 *
 * Given the composited terrain mesh and a scene.terrain.water block, emits a
 * flat water plane at `level` clipped to where the terrain sits below it —
 * coves, rivers between dunes, tide pools all fall out of the same sampling.
 * A shoreline vertex-color band tints water within `shoreline.width` of the
 * dry edge: the foam-line read cue that sells natural water.
 *
 *   "water": {
 *     "level": -0.08,
 *     "color": "#2a5f6d",
 *     "shoreline": { "width": 0.25, "color": "#cfe4de" },
 *     "opacity": 0.9,          // optional, < 1 enables transparency
 *     "roughness": 0.15,       // optional
 *     "resolution": 96         // optional grid resolution
 *   }
 *
 * Cells whose quad touches a wet vertex are kept, so the water edge tucks
 * under the rising bank instead of leaving a gap at the shoreline.
 */

import * as THREE from 'three';

export function buildWaterLevel(terrainMesh, terrainSpec) {
  const water = terrainSpec?.water;
  if (!water || typeof water.level !== 'number') return null;
  if (!terrainMesh?.geometry) return null;

  const level = water.level;
  const resolution = Math.max(8, Math.min(512, Math.round(water.resolution ?? 96)));

  terrainMesh.updateMatrixWorld(true);
  if (!terrainMesh.geometry.boundingBox) terrainMesh.geometry.computeBoundingBox();
  const bounds = terrainMesh.geometry.boundingBox;
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;
  if (sizeX <= 0 || sizeZ <= 0) return null;

  const W = resolution;
  const H = resolution;
  const stepX = sizeX / (W - 1);
  const stepZ = sizeZ / (H - 1);

  // Sample the terrain by rasterizing its triangles into the grid, keeping
  // the max Y per vertex — one O(tris) pass instead of per-cell raycasts,
  // which freeze the main thread on real scenes (no BVH in the viewer).
  // Winding/flipped normals are irrelevant to a max-Y rasterizer.
  const heights = new Float32Array(W * H).fill(-Infinity);
  const pos = terrainMesh.geometry.getAttribute('position');
  const idx = terrainMesh.geometry.getIndex();
  const triCount = (idx ? idx.count : pos.count) / 3;
  const vx = (i) => (idx ? pos.getX(idx.getX(i)) : pos.getX(i));
  const vy = (i) => (idx ? pos.getY(idx.getX(i)) : pos.getY(i));
  const vz = (i) => (idx ? pos.getZ(idx.getX(i)) : pos.getZ(i));
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const ax = vx(i0), ay = vy(i0), az = vz(i0);
    const bx = vx(i0 + 1), by = vy(i0 + 1), bz = vz(i0 + 1);
    const cx = vx(i0 + 2), cy = vy(i0 + 2), cz = vz(i0 + 2);
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-12) continue; // vertical (skirt) or degenerate in XZ
    const ix0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - bounds.min.x) / stepX));
    const ix1 = Math.min(W - 1, Math.floor((Math.max(ax, bx, cx) - bounds.min.x) / stepX));
    const iz0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - bounds.min.z) / stepZ));
    const iz1 = Math.min(H - 1, Math.floor((Math.max(az, bz, cz) - bounds.min.z) / stepZ));
    for (let iz = iz0; iz <= iz1; iz++) {
      const z = bounds.min.z + iz * stepZ;
      for (let ix = ix0; ix <= ix1; ix++) {
        const x = bounds.min.x + ix * stepX;
        const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
        if (w0 < -1e-6) continue;
        const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
        if (w1 < -1e-6 || w0 + w1 > 1 + 1e-6) continue;
        const y = w0 * ay + w1 * by + (1 - w0 - w1) * cy;
        const cellIndex = iz * W + ix;
        if (y > heights[cellIndex]) heights[cellIndex] = y;
      }
    }
  }

  // Dry when the terrain is at/above the waterline. Outside the terrain
  // (no coverage) counts as dry so water never leaks past the drape.
  const dry = new Uint8Array(W * H);
  for (let i = 0; i < dry.length; i++) {
    dry[i] = heights[i] === -Infinity || heights[i] >= level ? 1 : 0;
  }

  // Chamfer distance transform: world-space distance from each wet vertex to
  // the nearest dry vertex, for the shoreline band.
  const cell = (stepX + stepZ) / 2;
  const DIAG = Math.SQRT2;
  const INF = 1e9;
  const dist = new Float32Array(W * H);
  for (let i = 0; i < dist.length; i++) dist[i] = dry[i] ? 0 : INF;
  const relax = (i, j, cost) => { if (dist[j] + cost < dist[i]) dist[i] = dist[j] + cost; };
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const i = iz * W + ix;
      if (ix > 0) relax(i, i - 1, 1);
      if (iz > 0) relax(i, i - W, 1);
      if (ix > 0 && iz > 0) relax(i, i - W - 1, DIAG);
      if (ix < W - 1 && iz > 0) relax(i, i - W + 1, DIAG);
    }
  }
  for (let iz = H - 1; iz >= 0; iz--) {
    for (let ix = W - 1; ix >= 0; ix--) {
      const i = iz * W + ix;
      if (ix < W - 1) relax(i, i + 1, 1);
      if (iz < H - 1) relax(i, i + W, 1);
      if (ix < W - 1 && iz < H - 1) relax(i, i + W + 1, DIAG);
      if (ix > 0 && iz < H - 1) relax(i, i + W - 1, DIAG);
    }
  }

  const baseColor = new THREE.Color(water.color || '#3388aa');
  const shoreWidth = Math.max(0, water.shoreline?.width ?? 0);
  const shoreColor = new THREE.Color(water.shoreline?.color || '#cfe4de');

  const positions = [];
  const colors = [];
  const vertColor = new THREE.Color();
  const pushVert = (ix, iz) => {
    positions.push(bounds.min.x + ix * stepX, level, bounds.min.z + iz * stepZ);
    const d = dist[iz * W + ix] * cell;
    if (shoreWidth > 0 && d < shoreWidth) {
      const t = 1 - d / shoreWidth; // 1 at the dry edge, 0 at band's inner rim
      vertColor.copy(baseColor).lerp(shoreColor, t);
    } else {
      vertColor.copy(baseColor);
    }
    colors.push(vertColor.r, vertColor.g, vertColor.b);
  };

  for (let iz = 0; iz < H - 1; iz++) {
    for (let ix = 0; ix < W - 1; ix++) {
      const wet = 4 - (dry[iz * W + ix] + dry[iz * W + ix + 1] +
        dry[(iz + 1) * W + ix] + dry[(iz + 1) * W + ix + 1]);
      if (wet === 0) continue; // fully dry quad
      pushVert(ix, iz); pushVert(ix, iz + 1); pushVert(ix + 1, iz);
      pushVert(ix + 1, iz); pushVert(ix, iz + 1); pushVert(ix + 1, iz + 1);
    }
  }

  if (!positions.length) {
    console.warn('[terrain.water] level is above/below all terrain in bounds — no water emitted.');
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const opacity = typeof water.opacity === 'number' ? water.opacity : 0.9;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: typeof water.roughness === 'number' ? water.roughness : 0.15,
    metalness: 0.1,
    transparent: opacity < 1,
    opacity
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.waterLevel = level;
  return mesh;
}
