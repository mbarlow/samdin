/**
 * terrain/sampler.js - Shared helpers for terrain generation methods.
 *
 * Handles:
 *  - category resolution (explicit leaf wins, else walk up for inherited group category)
 *  - environment mesh collection from a built model
 *  - AABB / bounds computation
 *  - top-down raycasting against an env mesh set
 *  - flat-shaded non-indexed BufferGeometry construction from a triangle soup
 *  - separable Gaussian smoothing of a 2D scalar grid
 *  - skirt extrusion for heightfield borders
 */

import * as THREE from 'three';

/**
 * Walk up the parent chain to find the nearest ancestor (or self) with a
 * userData.category set. Returns undefined if none.
 */
export function resolveCategory(object) {
  let cursor = object;
  while (cursor) {
    if (cursor.userData && cursor.userData.category !== undefined) {
      return cursor.userData.category;
    }
    cursor = cursor.parent;
  }
  return undefined;
}

/**
 * Walk a model and collect meshes whose resolved category matches `category`.
 * Lights, groups, and non-mesh objects are skipped.
 * Tags each returned mesh with userData.role = 'environment-primitive' for
 * later display-mode toggling.
 */
export function collectCategorizedMeshes(model, category) {
  const matches = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    if (resolveCategory(child) !== category) return;
    matches.push(child);
  });
  return matches;
}

/**
 * Tag meshes with a role (used by the viewer's display-mode toggle).
 * Idempotent.
 */
export function tagRole(meshes, role) {
  for (const mesh of meshes) {
    mesh.userData = mesh.userData || {};
    mesh.userData.role = role;
  }
}

/**
 * Compute world-space AABB over an array of meshes. Ensures world matrices
 * are up to date first (model is added to scene by the time this runs, but
 * in case the model is still detached, we force updates).
 */
export function computeMeshesBounds(meshes, padding = 0) {
  const box = new THREE.Box3();
  if (!meshes.length) return box;

  const tmp = new THREE.Box3();
  let first = true;
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    tmp.setFromObject(mesh);
    if (first) {
      box.copy(tmp);
      first = false;
    } else {
      box.union(tmp);
    }
  }

  if (padding > 0) {
    box.expandByScalar(padding);
  }
  return box;
}

/**
 * Resolve a bounds spec into a THREE.Box3.
 *  - "auto"  → union of mesh AABBs + padding
 *  - [minX, minZ, maxX, maxZ] → XZ rectangle; Y derived from meshes
 */
export function resolveBounds(boundsSpec, meshes, padding = 0.5) {
  if (boundsSpec === undefined || boundsSpec === 'auto') {
    return computeMeshesBounds(meshes, padding);
  }
  if (Array.isArray(boundsSpec) && boundsSpec.length === 4) {
    const [minX, minZ, maxX, maxZ] = boundsSpec;
    const meshBox = computeMeshesBounds(meshes, 0);
    return new THREE.Box3(
      new THREE.Vector3(minX, meshBox.min.y, minZ),
      new THREE.Vector3(maxX, meshBox.max.y, maxZ)
    );
  }
  return computeMeshesBounds(meshes, padding);
}

/**
 * Top-down raycast against a set of meshes. Returns the highest hit Y within
 * the ray, or `fallback` if no hit.
 *
 * Reuses a single Raycaster for efficiency.
 */
const _raycaster = new THREE.Raycaster();
const _down = new THREE.Vector3(0, -1, 0);
const _origin = new THREE.Vector3();

export function raycastDown(x, z, startY, meshes, fallback = 0) {
  _origin.set(x, startY, z);
  _raycaster.set(_origin, _down);
  _raycaster.far = startY * 2 + 1;
  const hits = _raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return fallback;
  return hits[0].point.y;
}

/**
 * Apply a separable Gaussian 3x3 smoothing to a scalar grid, blended by
 * `amount` (0 = no change, 1 = full smooth).
 *  grid: Float32Array of length W*H, row-major (index = z*W + x)
 */
export function smoothGrid(grid, W, H, amount) {
  if (amount <= 0) return grid;
  const out = new Float32Array(grid.length);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  // Kernel: [1, 2, 1] / 4 in each axis (approx Gaussian, separable)
  const tmp = new Float32Array(grid.length);
  // X pass
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const l = grid[z * W + clamp(x - 1, 0, W - 1)];
      const c = grid[z * W + x];
      const r = grid[z * W + clamp(x + 1, 0, W - 1)];
      tmp[z * W + x] = (l + c * 2 + r) * 0.25;
    }
  }
  // Z pass
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const u = tmp[clamp(z - 1, 0, H - 1) * W + x];
      const c = tmp[z * W + x];
      const d = tmp[clamp(z + 1, 0, H - 1) * W + x];
      const smoothed = (u + c * 2 + d) * 0.25;
      out[z * W + x] = grid[z * W + x] * (1 - amount) + smoothed * amount;
    }
  }
  return out;
}

/**
 * Build a non-indexed flat-shaded BufferGeometry from a triangle soup.
 *  triangles: Float32Array (or plain array) of length N*9 — three xyz verts per triangle.
 */
export function buildFlatShadedGeometry(triangles) {
  const positions = triangles instanceof Float32Array
    ? triangles
    : new Float32Array(triangles);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  // For flat shading on non-indexed geometry, normals are per-face automatically
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Build a non-indexed flat-shaded BufferGeometry from a heightfield grid.
 *  bounds: THREE.Box3
 *  W, H:   grid sample counts
 *  heights: Float32Array of length W*H (Y values, world space)
 *  skirt:  border depth to extrude downward (0 = no skirt)
 */
export function buildHeightfieldGeometry(bounds, W, H, heights, skirt = 0) {
  const triangles = [];
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;
  const stepX = sizeX / (W - 1);
  const stepZ = sizeZ / (H - 1);

  const xAt = (ix) => bounds.min.x + ix * stepX;
  const zAt = (iz) => bounds.min.z + iz * stepZ;
  const yAt = (ix, iz) => heights[iz * W + ix];

  // Main surface — 2 triangles per cell
  for (let iz = 0; iz < H - 1; iz++) {
    for (let ix = 0; ix < W - 1; ix++) {
      const x0 = xAt(ix), x1 = xAt(ix + 1);
      const z0 = zAt(iz), z1 = zAt(iz + 1);
      const y00 = yAt(ix, iz);
      const y10 = yAt(ix + 1, iz);
      const y01 = yAt(ix, iz + 1);
      const y11 = yAt(ix + 1, iz + 1);

      // tri 1: (x0,z0) (x1,z0) (x1,z1)
      triangles.push(x0, y00, z0, x1, y10, z0, x1, y11, z1);
      // tri 2: (x0,z0) (x1,z1) (x0,z1)
      triangles.push(x0, y00, z0, x1, y11, z1, x0, y01, z1);
    }
  }

  if (skirt > 0) {
    const skirtY = bounds.min.y - skirt;

    // Border edges: north (iz=0), south (iz=H-1), west (ix=0), east (ix=W-1)
    const addQuad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => {
      // ABCD quad → ABC + ACD
      triangles.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      triangles.push(ax, ay, az, cx, cy, cz, dx, dy, dz);
    };

    // North (iz = 0): wind so outward-facing normal points +Z-
    for (let ix = 0; ix < W - 1; ix++) {
      const x0 = xAt(ix), x1 = xAt(ix + 1);
      const z = zAt(0);
      const y0 = yAt(ix, 0), y1 = yAt(ix + 1, 0);
      addQuad(x1, y1, z, x0, y0, z, x0, skirtY, z, x1, skirtY, z);
    }
    // South (iz = H-1)
    for (let ix = 0; ix < W - 1; ix++) {
      const x0 = xAt(ix), x1 = xAt(ix + 1);
      const z = zAt(H - 1);
      const y0 = yAt(ix, H - 1), y1 = yAt(ix + 1, H - 1);
      addQuad(x0, y0, z, x1, y1, z, x1, skirtY, z, x0, skirtY, z);
    }
    // West (ix = 0)
    for (let iz = 0; iz < H - 1; iz++) {
      const z0 = zAt(iz), z1 = zAt(iz + 1);
      const x = xAt(0);
      const y0 = yAt(0, iz), y1 = yAt(0, iz + 1);
      addQuad(x, y0, z0, x, y1, z1, x, skirtY, z1, x, skirtY, z0);
    }
    // East (ix = W-1)
    for (let iz = 0; iz < H - 1; iz++) {
      const z0 = zAt(iz), z1 = zAt(iz + 1);
      const x = xAt(W - 1);
      const y0 = yAt(W - 1, iz), y1 = yAt(W - 1, iz + 1);
      addQuad(x, y1, z1, x, y0, z0, x, skirtY, z0, x, skirtY, z1);
    }
  }

  return buildFlatShadedGeometry(triangles);
}

/**
 * Flip the winding (and therefore face normals) of every mesh inside the given
 * Object3D. Indexed geometry gets its index triplets reversed; non-indexed
 * geometry has its per-triangle vertex positions swapped in place. Normals are
 * recomputed.
 *
 * Toggles `object.userData.normalsFlipped` each call so callers can track state
 * and decide whether to persist the flag to the spec.
 */
export function flipNormalsOnObject(object) {
  if (!object) return;

  const targets = [];
  object.traverse((child) => {
    if (child.isMesh && child.geometry) targets.push(child);
  });

  for (const mesh of targets) {
    flipGeometryWinding(mesh.geometry);
  }

  object.userData = object.userData || {};
  object.userData.normalsFlipped = !object.userData.normalsFlipped;
}

/**
 * Flip winding on a BufferGeometry, in place. Recomputes normals.
 */
export function flipGeometryWinding(geometry) {
  if (!geometry) return;

  const index = geometry.index;
  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    index.needsUpdate = true;
  } else {
    const pos = geometry.getAttribute('position');
    if (!pos) return;
    const a = pos.array;
    // Swap vertex 1 and 2 in each triangle (stride 9 floats per tri)
    for (let i = 0; i < a.length; i += 9) {
      const x1 = a[i + 3], y1 = a[i + 4], z1 = a[i + 5];
      a[i + 3] = a[i + 6]; a[i + 4] = a[i + 7]; a[i + 5] = a[i + 8];
      a[i + 6] = x1;       a[i + 7] = y1;       a[i + 8] = z1;
    }
    pos.needsUpdate = true;
  }

  geometry.computeVertexNormals();
}

/**
 * Safe material construction from a spec fragment. Strips any fields that
 * THREE.MeshStandardMaterial doesn't accept directly (breakup, decals, etc.)
 * and always forces flatShading.
 */
export function buildTerrainMaterial(materialSpec = {}) {
  const SAFE_KEYS = new Set([
    'color', 'metalness', 'roughness', 'opacity', 'transparent',
    'emissive', 'emissiveIntensity', 'side', 'alphaTest'
  ]);
  const params = { flatShading: true };
  for (const [key, value] of Object.entries(materialSpec || {})) {
    if (SAFE_KEYS.has(key)) params[key] = value;
  }
  if (!('color' in params)) params.color = '#506874';
  if (!('roughness' in params)) params.roughness = 0.9;
  if (!('metalness' in params)) params.metalness = 0.0;
  return new THREE.MeshStandardMaterial(params);
}
