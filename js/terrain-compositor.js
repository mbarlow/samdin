/**
 * terrain-compositor.js - Middle-pass that drapes a single unified mesh over
 * all parts tagged category: "environment". Designed structures are untouched.
 *
 * Runs at the end of builder.buildParts(), before the model is returned.
 * Attaches the generated mesh as a child of the model root under the name
 * `__terrain__` so it participates in GLB export automatically.
 *
 * Display modes are applied by the viewer at render time — the compositor
 * just tags meshes with userData.role so the viewer can toggle visibility.
 */

import {
  collectCategorizedMeshes,
  tagRole,
  flipNormalsOnObject
} from './terrain/sampler.js';
import { buildHeightfield } from './terrain/heightfield.js';

const TERRAIN_MESH_NAME = '__terrain__';
const ROLE_ENV = 'environment-primitive';
const ROLE_TERRAIN = 'generated-terrain';

/**
 * Apply terrain compositing to a built model in-place.
 * @param {THREE.Group} model - The root of the built model.
 * @param {object} spec - The full spec object.
 * @returns {THREE.Group} The same model, with a `__terrain__` mesh attached if applicable.
 */
export function applyTerrainCompositor(model, spec) {
  const terrainSpec = spec?.scene?.terrain;
  if (!terrainSpec || terrainSpec.enabled !== true) return model;

  // Collect environment meshes and tag them for later toggling.
  const envMeshes = collectCategorizedMeshes(model, 'environment');
  if (envMeshes.length === 0) {
    console.warn(
      '[terrain] scene.terrain.enabled but no parts with category: "environment" — skipping generation.'
    );
    return model;
  }
  tagRole(envMeshes, ROLE_ENV);

  // Dispatch by method. MC and cloth-drape stub to heightfield for PR 1.
  const method = terrainSpec.method || 'heightfield';
  let terrainMesh = null;

  switch (method) {
    case 'heightfield':
      terrainMesh = buildHeightfield(envMeshes, terrainSpec);
      break;
    case 'marching-cubes':
      console.warn('[terrain] marching-cubes not yet implemented — falling back to heightfield');
      terrainMesh = buildHeightfield(envMeshes, terrainSpec);
      break;
    case 'cloth-drape':
      console.warn('[terrain] cloth-drape not yet implemented — falling back to heightfield');
      terrainMesh = buildHeightfield(envMeshes, terrainSpec);
      break;
    default:
      console.warn(`[terrain] unknown method "${method}" — falling back to heightfield`);
      terrainMesh = buildHeightfield(envMeshes, terrainSpec);
  }

  if (!terrainMesh) {
    console.warn('[terrain] compositor produced no mesh.');
    return model;
  }

  terrainMesh.name = TERRAIN_MESH_NAME;
  terrainMesh.userData.role = ROLE_TERRAIN;
  terrainMesh.userData.terrainMethodRequested = method;

  if (terrainSpec.flipNormals === true) {
    flipNormalsOnObject(terrainMesh);
  }

  model.add(terrainMesh);

  // Stash initial display mode on the model for the viewer to read.
  model.userData.terrainDisplay = terrainSpec.display || 'terrain';

  // Apply initial visibility based on the declared display mode.
  applyDisplayMode(model, model.userData.terrainDisplay);

  return model;
}

/**
 * Toggle which parts of a model with terrain are visible.
 * Called both at build-time (initial state) and by the viewer UI at runtime.
 *
 * Modes:
 *  - "primitives": env primitives visible, __terrain__ hidden.
 *  - "terrain":    env primitives hidden, __terrain__ visible.
 *  - "both":       everything visible (lookdev / debug).
 *
 * Structures are always visible regardless of mode.
 */
export function applyDisplayMode(model, mode) {
  if (!model) return;
  const showPrimitives = mode === 'primitives' || mode === 'both';
  const showTerrain = mode === 'terrain' || mode === 'both';

  model.traverse((child) => {
    if (!child.userData) return;
    if (child.userData.role === ROLE_ENV) {
      child.visible = showPrimitives;
    } else if (child.userData.role === ROLE_TERRAIN) {
      child.visible = showTerrain;
    }
  });

  model.userData.terrainDisplay = mode;
}

export const TERRAIN_ROLE_ENV = ROLE_ENV;
export const TERRAIN_ROLE_TERRAIN = ROLE_TERRAIN;
export const TERRAIN_MESH_NAME_CONST = TERRAIN_MESH_NAME;
