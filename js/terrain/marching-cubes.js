/**
 * terrain/marching-cubes.js - Volumetric terrain generator.
 *
 * Strategy: build a 3D density grid by column-raycasting against env meshes
 * (odd crossings = inside), optionally smooth, then extract an iso-surface
 * via three.js's MarchingCubes helper. Unlike the heightfield method this
 * can represent overhangs, caves, and other non-2.5D topology.
 *
 * Produces a flat-shaded THREE.Mesh ready to attach to the model root.
 */

import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { resolveBounds, buildTerrainMaterial } from './sampler.js';

export function buildMarchingCubes(envMeshes, terrainSpec) {
  if (!envMeshes.length) {
    console.warn('[terrain.marching-cubes] No environment meshes to sample; skipping.');
    return null;
  }

  const opts = terrainSpec || {};
  const resolution = Math.max(8, Math.min(128, Math.round(opts.resolution ?? 48)));
  const smoothing = clamp01(opts.smoothing ?? 0.3);
  const methodOpts = opts.methodOptions?.marchingCubes || {};
  const padding = methodOpts.padding ?? 0.5;
  const isoLevel = clampRange(methodOpts.isoLevel ?? 0.5, 0.05, 0.95);
  const extraSmoothPasses = Math.max(0, Math.min(4, Math.round(methodOpts.smoothingPasses ?? 0)));

  const bounds = resolveBounds(opts.bounds, envMeshes, padding);
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeY = bounds.max.y - bounds.min.y;
  const sizeZ = bounds.max.z - bounds.min.z;

  if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) {
    console.warn('[terrain.marching-cubes] Degenerate bounds; skipping.');
    return null;
  }

  const size = resolution;
  const size2 = size * size;
  const size3 = size2 * size;
  const field = new Float32Array(size3);

  const stepX = sizeX / (size - 1);
  const stepY = sizeY / (size - 1);
  const stepZ = sizeZ / (size - 1);

  const raycaster = new THREE.Raycaster();
  const downDir = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const topY = bounds.max.y + 1.0;
  raycaster.far = sizeY + 2.0;

  for (let iz = 0; iz < size; iz++) {
    const z = bounds.min.z + iz * stepZ;
    for (let ix = 0; ix < size; ix++) {
      const x = bounds.min.x + ix * stepX;
      origin.set(x, topY, z);
      raycaster.set(origin, downDir);
      const hits = raycaster.intersectObjects(envMeshes, false);

      for (let iy = 0; iy < size; iy++) {
        const y = bounds.min.y + iy * stepY;
        let crossings = 0;
        for (let k = 0; k < hits.length; k++) {
          if (hits[k].point.y > y) crossings++;
          else break;
        }
        field[ix + size * iy + size2 * iz] = (crossings & 1) ? 1.0 : 0.0;
      }
    }
  }

  let smoothed = field;
  const totalPasses = (smoothing > 0 ? 1 : 0) + extraSmoothPasses;
  for (let p = 0; p < totalPasses; p++) {
    const amount = p === 0 && smoothing > 0 ? smoothing : 0.5;
    smoothed = smooth3DField(smoothed, size, amount);
  }

  const material = buildTerrainMaterial(opts.material);
  const maxPolys = Math.max(10000, size3);
  const mc = new MarchingCubes(size, material, false, false, maxPolys);
  mc.reset();
  mc.isolation = isoLevel;
  mc.field.set(smoothed);
  mc.update();

  const vertexCount = mc.count;
  if (!vertexCount || vertexCount < 3) {
    console.warn('[terrain.marching-cubes] Empty iso-surface — check density sampling / isoLevel.');
    return null;
  }

  const positions = new Float32Array(vertexCount * 3);
  positions.set(mc.positionArray.subarray(0, vertexCount * 3));
  const normals = new Float32Array(vertexCount * 3);
  normals.set(mc.normalArray.subarray(0, vertexCount * 3));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const mcX = bb.max.x - bb.min.x || 1;
  const mcY = bb.max.y - bb.min.y || 1;
  const mcZ = bb.max.z - bb.min.z || 1;

  geometry.translate(
    -(bb.min.x + bb.max.x) * 0.5,
    -(bb.min.y + bb.max.y) * 0.5,
    -(bb.min.z + bb.max.z) * 0.5
  );
  geometry.scale(sizeX / mcX, sizeY / mcY, sizeZ / mcZ);
  geometry.translate(
    (bounds.min.x + bounds.max.x) * 0.5,
    (bounds.min.y + bounds.max.y) * 0.5,
    (bounds.min.z + bounds.max.z) * 0.5
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.terrainMethod = 'marching-cubes';
  mesh.userData.terrainBounds = {
    min: [bounds.min.x, bounds.min.y, bounds.min.z],
    max: [bounds.max.x, bounds.max.y, bounds.max.z]
  };
  mesh.userData.terrainResolution = resolution;

  return mesh;
}

function smooth3DField(field, size, amount) {
  if (amount <= 0) return field;
  const size2 = size * size;
  const idx = (x, y, z) => x + size * y + size2 * z;
  const clamp = (v) => (v < 0 ? 0 : v > size - 1 ? size - 1 : v);

  const tmp1 = new Float32Array(field.length);
  const tmp2 = new Float32Array(field.length);
  const out = new Float32Array(field.length);

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const l = field[idx(clamp(x - 1), y, z)];
        const c = field[idx(x, y, z)];
        const r = field[idx(clamp(x + 1), y, z)];
        tmp1[idx(x, y, z)] = (l + 2 * c + r) * 0.25;
      }
    }
  }
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = tmp1[idx(x, clamp(y - 1), z)];
        const c = tmp1[idx(x, y, z)];
        const d = tmp1[idx(x, clamp(y + 1), z)];
        tmp2[idx(x, y, z)] = (u + 2 * c + d) * 0.25;
      }
    }
  }
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const b = tmp2[idx(x, y, clamp(z - 1))];
        const c = tmp2[idx(x, y, z)];
        const f = tmp2[idx(x, y, clamp(z + 1))];
        const s = (b + 2 * c + f) * 0.25;
        const i = idx(x, y, z);
        out[i] = field[i] * (1 - amount) + s * amount;
      }
    }
  }
  return out;
}

function clamp01(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function clampRange(v, lo, hi) {
  if (typeof v !== 'number' || Number.isNaN(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
