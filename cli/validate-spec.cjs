#!/usr/bin/env node
/**
 * validate-spec.js - Validates samdin spec files
 *
 * Supports:
 * - Parts-based specs
 * - Top-level CSG specs
 * - Embedded CSG parts
 * - Nested children arrays
 * - Spec-local modules
 * - Scene/render settings
 */

const fs = require('fs');
const path = require('path');

const PRIMITIVE_PARAMS = {
  box: { min: 3, max: 3 },
  cylinder: { min: 4, max: 5 },
  sphere: { min: 1, max: 2 },
  cone: { min: 2, max: 3 },
  torus: { min: 2, max: 4 },
  capsule: { min: 2, max: 4 },
  roundedBox: { min: 3, max: 5 },
  plane: { min: 2, max: 4 },
  group: { min: 0, max: 0 },
  prefab: { min: 0, max: 0, requiresSrc: true },
  module: { min: 0, max: 0, requiresSrc: true },
  csg: { min: 0, max: 0, validate: validateEmbeddedCSG },

  tetrahedron: { min: 0, max: 2 },
  octahedron: { min: 0, max: 2 },
  dodecahedron: { min: 0, max: 2 },
  icosahedron: { min: 0, max: 2 },
  prism: { min: 0, max: 3 },
  pyramid: { min: 0, max: 3 },
  wedge: { min: 0, max: 3 },
  tube: { min: 0, max: 5 },
  ring: { min: 0, max: 4 },
  stairs: { min: 0, max: 4 },
  arch: { min: 0, max: 5 },

  lathe: { min: 1, max: 4, skipNumericParams: true },
  extrudePath: { min: 3, max: 5, skipNumericParams: true },
  cable: { min: 1, max: 5, skipNumericParams: true },
  catenary: { min: 2, max: 6, skipNumericParams: true },
  pointLight: { min: 0, max: 5 },
  spotLight: { min: 0, max: 5 },
  areaLight: { min: 0, max: 4 },

  ibeam: { min: 0, max: 4 },
  lbeam: { min: 0, max: 4 },
  tbeam: { min: 0, max: 4 },
  channel: { min: 0, max: 4 },
  hbeam: { min: 0, max: 5 },
  angle: { min: 0, max: 4 },
  hollowBox: { min: 0, max: 4, validate: validateHollowBox },
  hollowCylinder: { min: 0, max: 4, validate: validateHollowCylinder },
  pipeFlange: { min: 0, max: 5 },
  elbow: { min: 0, max: 4 },
  bracket: { min: 0, max: 5, validate: validateBracket },
  gear: { min: 0, max: 5 },
  cross: { min: 0, max: 3 },
  frame: { min: 0, max: 4 },
  windowFrame: { min: 0, max: 5 },
  dome: { min: 0, max: 4, validate: validateDome },
  hexNut: { min: 0, max: 3 },
  countersunk: { min: 0, max: 5 },
  keyhole: { min: 0, max: 5 },
  halfTorus: { min: 0, max: 3 },
  sphereSlab: { min: 0, max: 3 },
  notchedCylinder: { min: 0, max: 5 },
  steppedPyramid: { min: 0, max: 4 },
  boxSphereIntersect: { min: 0, max: 2 },
  cylinderIntersect: { min: 0, max: 3 },
  swissCheese: { min: 0, max: 5 }
};

const CSG_SHAPE_TYPES = new Set(['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule']);

function validateHollowBox(params) {
  const [width, height, depth, thickness = 0.1] = params;
  const issues = [];
  if (width !== undefined && thickness !== undefined && width <= thickness * 2) {
    issues.push(`width (${width}) should be > thickness*2 (${thickness * 2})`);
  }
  if (depth !== undefined && thickness !== undefined && depth <= thickness * 2) {
    issues.push(`depth (${depth}) should be > thickness*2 (${thickness * 2})`);
  }
  return issues;
}

function validateHollowCylinder(params) {
  const [outerRadius, innerRadius] = params;
  const issues = [];
  if (outerRadius !== undefined && innerRadius !== undefined && innerRadius >= outerRadius) {
    issues.push(`innerRadius (${innerRadius}) should be < outerRadius (${outerRadius})`);
  }
  return issues;
}

function validateBracket(params) {
  const [width, height, depth, thickness = 0.08] = params;
  const issues = [];
  if (height !== undefined && thickness !== undefined && height <= thickness) {
    issues.push(`height (${height}) should be > thickness (${thickness})`);
  }
  return issues;
}

function validateDome(params) {
  const [radius, widthSegments, heightSegments, phiLength, thickness] = params;
  const issues = [];
  if (radius !== undefined && thickness !== undefined && thickness >= radius) {
    issues.push(`thickness (${thickness}) should be < radius (${radius})`);
  }
  return issues;
}

function flattenParts(parts, inheritedParent = null) {
  const flattened = [];

  for (const part of parts || []) {
    const clone = JSON.parse(JSON.stringify(part));
    const children = Array.isArray(clone.children) ? clone.children : [];
    delete clone.children;

    if (inheritedParent && !clone.parent) {
      clone.parent = inheritedParent;
    }

    flattened.push(clone);
    flattened.push(...flattenParts(children, clone.name));
  }

  return flattened;
}

function normalizeModules(modules) {
  if (!modules) return [];

  if (Array.isArray(modules)) {
    return modules.map((moduleDef) => ({
      ...moduleDef,
      parts: flattenParts(moduleDef.parts || [])
    }));
  }

  return Object.entries(modules).map(([name, moduleDef]) => ({
    name,
    ...moduleDef,
    parts: flattenParts(moduleDef.parts || [])
  }));
}

function validateTransform(part, prefix, issues) {
  if (part.position && (!Array.isArray(part.position) || part.position.length !== 3)) {
    issues.push(`${prefix} Invalid position: should be [x, y, z]`);
  }

  if (part.rotation && (!Array.isArray(part.rotation) || part.rotation.length !== 3)) {
    issues.push(`${prefix} Invalid rotation: should be [x, y, z]`);
  }

  if (part.scale) {
    const scaleOk = typeof part.scale === 'number' ||
      (Array.isArray(part.scale) && part.scale.length === 3);
    if (!scaleOk) {
      issues.push(`${prefix} Invalid scale: should be number or [x, y, z]`);
    }
  }
}

function validateParams(part, typeInfo, prefix, issues, warnings) {
  if (!part.params) return;

  if (!Array.isArray(part.params)) {
    issues.push(`${prefix} Invalid params: should be an array`);
    return;
  }

  if (part.params.length < typeInfo.min) {
    warnings.push(`${prefix} Too few params: got ${part.params.length}, expected at least ${typeInfo.min}`);
  }
  if (part.params.length > typeInfo.max && typeInfo.max > 0) {
    warnings.push(`${prefix} Too many params: got ${part.params.length}, expected at most ${typeInfo.max}`);
  }

  if (!typeInfo.skipNumericParams) {
    for (let i = 0; i < part.params.length; i++) {
      if (typeof part.params[i] !== 'number' || Number.isNaN(part.params[i])) {
        issues.push(`${prefix} Invalid param[${i}]: ${part.params[i]} (should be number)`);
      }
      if (typeof part.params[i] === 'number' && part.params[i] < 0) {
        warnings.push(`${prefix} Negative param[${i}]: ${part.params[i]}`);
      }
      if (part.params[i] === 0 && i < 3) {
        warnings.push(`${prefix} Zero dimension param[${i}] may cause issues`);
      }
    }
  }

  if (typeInfo.validate) {
    const typeIssues = typeInfo.validate(part.params, part.name);
    issues.push(...typeIssues.map((issue) => `${prefix} ${issue}`));
  }
}

function validateSceneSettings(scene, issues, warnings) {
  if (!scene || typeof scene !== 'object') {
    issues.push('scene must be an object');
    return;
  }

  if (scene.background && typeof scene.background !== 'object') {
    issues.push('scene.background must be an object');
  }

  if (scene.fog && typeof scene.fog !== 'object') {
    issues.push('scene.fog must be an object');
  }

  if (scene.lighting && typeof scene.lighting !== 'object') {
    issues.push('scene.lighting must be an object');
  }

  if (scene.postfx && typeof scene.postfx !== 'object') {
    issues.push('scene.postfx must be an object');
  }

  if (scene.exposure !== undefined && typeof scene.exposure !== 'number') {
    issues.push('scene.exposure must be a number');
  }

  if (scene.toneMapping !== undefined && typeof scene.toneMapping !== 'string') {
    issues.push('scene.toneMapping must be a string');
  }
}

function validateEmbeddedCSG(part) {
  const errors = [];
  if (!part.shapes || typeof part.shapes !== 'object') {
    errors.push('embedded csg part requires a shapes object');
  }
  if (!Array.isArray(part.operations)) {
    errors.push('embedded csg part requires an operations array');
  }
  if (!part.output && !Array.isArray(part.outputs)) {
    errors.push('embedded csg part requires output or outputs');
  }
  return errors;
}

function validateCSGSpec(spec, issues, warnings) {
  if (!spec.shapes || typeof spec.shapes !== 'object') {
    issues.push('Missing or invalid field: shapes (should be object)');
  }

  if (!Array.isArray(spec.operations)) {
    issues.push('Missing or invalid field: operations (should be array)');
  }

  if (!spec.output && !Array.isArray(spec.outputs)) {
    issues.push('Missing output or outputs definition');
  }

  const shapeNames = new Set(Object.keys(spec.shapes || {}));
  for (const [shapeName, shapeDef] of Object.entries(spec.shapes || {})) {
    if (!shapeDef.type) {
      issues.push(`[shape:${shapeName}] Missing type`);
      continue;
    }
    if (!CSG_SHAPE_TYPES.has(shapeDef.type)) {
      warnings.push(`[shape:${shapeName}] Unknown/unsupported CSG shape type: ${shapeDef.type}`);
    }
  }

  for (const op of spec.operations || []) {
    if (!op.op || !op.a || !op.b || !op.result) {
      issues.push('Each CSG operation requires op, a, b, and result');
      continue;
    }
    if (!shapeNames.has(op.a)) {
      warnings.push(`[csg:${op.result}] Input a not found among initial shapes: ${op.a}`);
    }
    if (!shapeNames.has(op.b) && !spec.operations.some((candidate) => candidate.result === op.b)) {
      warnings.push(`[csg:${op.result}] Input b not found among initial shapes/results: ${op.b}`);
    }
  }

  if (spec.scene) {
    validateSceneSettings(spec.scene, issues, warnings);
  }
}

function validatePartCollection(parts, issues, warnings, scopeLabel = 'spec') {
  const flatParts = flattenParts(parts);
  const partNames = new Set();
  const duplicates = new Set();

  for (const part of flatParts) {
    if (!part?.name) continue;
    if (partNames.has(part.name)) duplicates.add(part.name);
    partNames.add(part.name);
  }

  if (duplicates.size > 0) {
    issues.push(`${scopeLabel}: duplicate part names: ${[...duplicates].join(', ')}`);
  }

  for (const part of flatParts) {
    const prefix = `[${part.name || 'unnamed'}]`;

    if (!part.name) {
      issues.push(`${prefix} Missing part name`);
      continue;
    }

    if (!part.type) {
      issues.push(`${prefix} Missing type`);
      continue;
    }

    const typeInfo = PRIMITIVE_PARAMS[part.type];
    if (!typeInfo) {
      warnings.push(`${prefix} Unknown primitive type: ${part.type}`);
    }

    if (part.parent && !partNames.has(part.parent)) {
      issues.push(`${prefix} Parent not found: ${part.parent}`);
    }

    if ((part.type === 'prefab' || part.type === 'module') && !(part.src || part.module || part.ref)) {
      issues.push(`${prefix} ${part.type} requires src/module/ref`);
    }

    if (part.material && typeof part.material !== 'object') {
      issues.push(`${prefix} Invalid material: should be object`);
    }

    if (part.scene) {
      warnings.push(`${prefix} Found nested scene field; scene settings should be top-level on the spec`);
    }

    validateTransform(part, prefix, issues);

    if (typeInfo) {
      validateParams(part, typeInfo, prefix, issues, warnings);
    }

    if (part.modifiers && typeof part.modifiers !== 'object') {
      issues.push(`${prefix} modifiers should be an object`);
    }
  }

  return flatParts;
}

function validateSpec(specPath) {
  const issues = [];
  const warnings = [];

  let spec;
  try {
    const content = fs.readFileSync(specPath, 'utf8');
    spec = JSON.parse(content);
  } catch (err) {
    return { valid: false, issues: [`Failed to parse JSON: ${err.message}`], warnings: [] };
  }

  if (!spec.name) {
    issues.push('Missing required field: name');
  }

  if (spec.scene) {
    validateSceneSettings(spec.scene, issues, warnings);
  }

  if (spec.type === 'csg') {
    validateCSGSpec(spec, issues, warnings);
    return { valid: issues.length === 0, issues, warnings };
  }

  if (!spec.parts || !Array.isArray(spec.parts)) {
    issues.push('Missing or invalid field: parts (should be array)');
    return { valid: false, issues, warnings };
  }

  validatePartCollection(spec.parts, issues, warnings);

  const modules = normalizeModules(spec.modules);
  for (const moduleDef of modules) {
    if (!moduleDef.name) {
      issues.push('Module missing name');
      continue;
    }
    if (!Array.isArray(moduleDef.parts)) {
      issues.push(`[module:${moduleDef.name}] parts must be an array`);
      continue;
    }
    validatePartCollection(moduleDef.parts, issues, warnings, `module:${moduleDef.name}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

function expandArgs(args) {
  const files = [];
  for (const arg of args) {
    if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
      files.push(arg);
    }
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node validate-spec.js <spec-file.json> [more-files...]');
    console.log('       node validate-spec.js specs/*.json');
    process.exit(1);
  }

  const files = expandArgs(args);
  if (files.length === 0) {
    console.error('No input files found');
    process.exit(1);
  }

  let totalIssues = 0;
  let totalWarnings = 0;

  for (const file of files) {
    console.log(`\n📄 ${path.basename(file)}`);
    console.log('─'.repeat(40));

    const result = validateSpec(file);

    if (result.issues.length > 0) {
      console.log('❌ Issues:');
      result.issues.forEach((issue) => console.log(`   ${issue}`));
      totalIssues += result.issues.length;
    }

    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach((warning) => console.log(`   ${warning}`));
      totalWarnings += result.warnings.length;
    }

    if (result.valid && result.warnings.length === 0) {
      console.log('✅ Valid');
    } else if (result.valid) {
      console.log('✅ Valid (with warnings)');
    }
  }

  console.log('\n' + '═'.repeat(40));
  console.log(`Total: ${totalIssues} issues, ${totalWarnings} warnings`);

  process.exit(totalIssues > 0 ? 1 : 0);
}

main();
