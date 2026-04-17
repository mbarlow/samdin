/**
 * terrain/cloth-drape.js - Cloth-drape terrain generator.
 *
 * Strategy: a grid of particles (XZ fixed, Y dynamic) falls from above under
 * Verlet integration with gravity + damping. Distance constraints between
 * 4-connected neighbors (structural) and diagonals (shear) keep the cloth
 * taut; collision with the env surface (sampled top-down per-column) snaps
 * particles that fall through. The final Y grid is triangulated as a
 * heightfield-style mesh.
 *
 * Unlike the raw heightfield sampler, cloth-drape bridges gaps between
 * disjoint env chunks and produces a softer, more continuous blanket — a
 * closer analogue to how a tarp would settle on the scene.
 */

import * as THREE from 'three';
import {
  resolveBounds,
  raycastDown,
  buildHeightfieldGeometry,
  buildTerrainMaterial
} from './sampler.js';

export function buildClothDrape(envMeshes, terrainSpec) {
  if (!envMeshes.length) {
    console.warn('[terrain.cloth-drape] No environment meshes to sample; skipping.');
    return null;
  }

  const opts = terrainSpec || {};
  const resolution = Math.max(4, Math.min(256, Math.round(opts.resolution ?? 96)));
  const methodOpts = opts.methodOptions?.clothDrape || {};
  const padding = methodOpts.padding ?? 0.5;
  const skirt = methodOpts.skirt ?? 2.0;
  const iterations = Math.max(1, Math.min(400, Math.round(methodOpts.iterations ?? 80)));
  const stiffness = clampRange(methodOpts.stiffness ?? 0.7, 0, 1);
  const gravity = methodOpts.gravity ?? -9.8;
  const damping = clampRange(methodOpts.damping ?? 0.98, 0, 1);
  const thickness = methodOpts.thickness ?? 0.0;
  const startMargin = methodOpts.startMargin ?? 2.0;
  const dt = methodOpts.timeStep ?? 0.05;
  const useShear = methodOpts.shear !== false;

  const bounds = resolveBounds(opts.bounds, envMeshes, padding);
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;

  if (sizeX <= 0 || sizeZ <= 0) {
    console.warn('[terrain.cloth-drape] Degenerate bounds; skipping.');
    return null;
  }

  const W = resolution;
  const H = resolution;
  const N = W * H;
  const stepX = sizeX / (W - 1);
  const stepZ = sizeZ / (H - 1);

  const floorY = new Float32Array(N);
  const startY = bounds.max.y + 1.0;
  for (let iz = 0; iz < H; iz++) {
    const z = bounds.min.z + iz * stepZ;
    for (let ix = 0; ix < W; ix++) {
      const x = bounds.min.x + ix * stepX;
      floorY[iz * W + ix] = raycastDown(x, z, startY, envMeshes, bounds.min.y) + thickness;
    }
  }

  const y = new Float32Array(N);
  const yPrev = new Float32Array(N);
  const initialY = bounds.max.y + startMargin;
  y.fill(initialY);
  yPrev.fill(initialY);

  const gravStep = gravity * dt * dt;
  const idx = (ix, iz) => iz * W + ix;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < N; i++) {
      const vy = (y[i] - yPrev[i]) * damping;
      yPrev[i] = y[i];
      y[i] = y[i] + vy + gravStep;
      if (y[i] < floorY[i]) y[i] = floorY[i];
    }

    const relaxPasses = 2;
    for (let r = 0; r < relaxPasses; r++) {
      for (let iz = 0; iz < H; iz++) {
        for (let ix = 0; ix < W - 1; ix++) {
          const a = idx(ix, iz);
          const b = idx(ix + 1, iz);
          const diff = y[a] - y[b];
          const corr = diff * stiffness * 0.5;
          y[a] -= corr;
          y[b] += corr;
          if (y[a] < floorY[a]) y[a] = floorY[a];
          if (y[b] < floorY[b]) y[b] = floorY[b];
        }
      }
      for (let iz = 0; iz < H - 1; iz++) {
        for (let ix = 0; ix < W; ix++) {
          const a = idx(ix, iz);
          const b = idx(ix, iz + 1);
          const diff = y[a] - y[b];
          const corr = diff * stiffness * 0.5;
          y[a] -= corr;
          y[b] += corr;
          if (y[a] < floorY[a]) y[a] = floorY[a];
          if (y[b] < floorY[b]) y[b] = floorY[b];
        }
      }
      if (useShear) {
        const shearK = stiffness * 0.35;
        for (let iz = 0; iz < H - 1; iz++) {
          for (let ix = 0; ix < W - 1; ix++) {
            const a = idx(ix, iz);
            const d = idx(ix + 1, iz + 1);
            const diffAD = y[a] - y[d];
            const corrAD = diffAD * shearK * 0.5;
            y[a] -= corrAD;
            y[d] += corrAD;
            if (y[a] < floorY[a]) y[a] = floorY[a];
            if (y[d] < floorY[d]) y[d] = floorY[d];

            const b = idx(ix + 1, iz);
            const c = idx(ix, iz + 1);
            const diffBC = y[b] - y[c];
            const corrBC = diffBC * shearK * 0.5;
            y[b] -= corrBC;
            y[c] += corrBC;
            if (y[b] < floorY[b]) y[b] = floorY[b];
            if (y[c] < floorY[c]) y[c] = floorY[c];
          }
        }
      }
    }
  }

  const geometry = buildHeightfieldGeometry(bounds, W, H, y, skirt);
  const material = buildTerrainMaterial(opts.material);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.terrainMethod = 'cloth-drape';
  mesh.userData.terrainBounds = {
    min: [bounds.min.x, bounds.min.y, bounds.min.z],
    max: [bounds.max.x, bounds.max.y, bounds.max.z]
  };
  mesh.userData.terrainResolution = resolution;
  mesh.userData.clothIterations = iterations;

  return mesh;
}

function clampRange(v, lo, hi) {
  if (typeof v !== 'number' || Number.isNaN(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
