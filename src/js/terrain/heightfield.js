/**
 * terrain/heightfield.js - Heightfield terrain generator.
 *
 * Strategy: grid over bounds, top-down raycast against env meshes for each
 * cell, optional Gaussian smoothing, triangulate, optional skirt. Fully
 * deterministic for the same input set.
 *
 * Produces a flat-shaded THREE.Mesh ready to attach to the model root.
 */

import * as THREE from 'three';
import {
  resolveBounds,
  raycastDown,
  smoothGrid,
  buildHeightfieldGeometry,
  buildTerrainMaterial
} from './sampler.js';

export function buildHeightfield(envMeshes, terrainSpec) {
  if (!envMeshes.length) {
    console.warn('[terrain.heightfield] No environment meshes to sample; skipping.');
    return null;
  }

  const opts = terrainSpec || {};
  const resolution = Math.max(4, Math.min(1024, Math.round(opts.resolution ?? 128)));
  const smoothing = clamp01(opts.smoothing ?? 0.3);
  const methodOpts = opts.methodOptions?.heightfield || {};
  const padding = methodOpts.padding ?? 0.5;
  const skirt = methodOpts.skirt ?? 2.0;

  const bounds = resolveBounds(opts.bounds, envMeshes, padding);
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;

  if (sizeX <= 0 || sizeZ <= 0) {
    console.warn('[terrain.heightfield] Degenerate bounds; skipping.');
    return null;
  }

  const W = resolution;
  const H = resolution;
  const heights = new Float32Array(W * H);

  const startY = bounds.max.y + 1.0;
  const fallbackY = bounds.min.y;
  const stepX = sizeX / (W - 1);
  const stepZ = sizeZ / (H - 1);

  for (let iz = 0; iz < H; iz++) {
    const z = bounds.min.z + iz * stepZ;
    for (let ix = 0; ix < W; ix++) {
      const x = bounds.min.x + ix * stepX;
      heights[iz * W + ix] = raycastDown(x, z, startY, envMeshes, fallbackY);
    }
  }

  const smoothed = smoothing > 0
    ? smoothGrid(heights, W, H, smoothing)
    : heights;

  const geometry = buildHeightfieldGeometry(bounds, W, H, smoothed, skirt);
  const material = buildTerrainMaterial(opts.material);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.terrainMethod = 'heightfield';
  mesh.userData.terrainBounds = {
    min: [bounds.min.x, bounds.min.y, bounds.min.z],
    max: [bounds.max.x, bounds.max.y, bounds.max.z]
  };
  mesh.userData.terrainResolution = resolution;

  return mesh;
}

function clamp01(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
