#!/usr/bin/env node
/**
 * Samdin CLI - Convert specs to GLB
 * Usage: node index.js <spec.json> [output.glb]
 */
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';

// Polyfill browser APIs for Node.js
globalThis.Blob = Blob;
globalThis.FileReader = class FileReader {
  readAsDataURL(blob) {
    // Use sync approach with setImmediate to ensure onload fires
    setImmediate(async () => {
      const buffer = await blob.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = blob.type || 'application/octet-stream';
      this.result = `data:${mimeType};base64,${base64}`;
      if (this.onload) this.onload({ target: this });
    });
  }
  readAsArrayBuffer(blob) {
    setImmediate(async () => {
      const buffer = await blob.arrayBuffer();
      this.result = buffer;
      if (this.onload) this.onload({ target: this });
    });
  }
};
globalThis.document = {
  createElement: () => ({ style: {} })
};
globalThis.self = globalThis;

import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

// Catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Material presets
const MATERIAL_PRESETS = {
  chrome: { metalness: 0.95, roughness: 0.05 },
  steel: { metalness: 0.8, roughness: 0.3 },
  metal: { metalness: 0.7, roughness: 0.4 },
  gold: { color: '#ffd700', metalness: 0.9, roughness: 0.1 },
  brass: { color: '#b5a642', metalness: 0.7, roughness: 0.3 },
  copper: { color: '#b87333', metalness: 0.7, roughness: 0.3 },
  'painted-metal': { metalness: 0.4, roughness: 0.5 },
  'rusted-metal': { color: '#8b4513', metalness: 0.3, roughness: 0.8 },
  concrete: { color: '#808080', metalness: 0.0, roughness: 0.9 },
  asphalt: { color: '#333333', metalness: 0.0, roughness: 0.95 },
  brick: { color: '#8b4513', metalness: 0.0, roughness: 0.85 },
  wood: { color: '#8b6914', metalness: 0.0, roughness: 0.8 },
  plastic: { metalness: 0.0, roughness: 0.4 },
  rubber: { color: '#1a1a1a', metalness: 0.0, roughness: 0.95 },
  glass: { color: '#88ccff', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3 },
  'glass-tinted': { color: '#334455', metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.5 },
  matte: { metalness: 0.0, roughness: 0.9 },
  glow: { emissive: true, emissiveIntensity: 2.0, metalness: 0.0, roughness: 0.5 },
  neon: { emissive: true, emissiveIntensity: 3.0, metalness: 0.0, roughness: 0.3 },
  leather: { color: '#4a3728', metalness: 0.0, roughness: 0.7 },
};

// Create geometry based on type
function createGeometry(type, params = []) {
  switch (type) {
    case 'box':
      return new THREE.BoxGeometry(...(params.length ? params : [1, 1, 1]));
    case 'sphere':
      const [radius = 0.5, detail = 1] = params;
      return new THREE.IcosahedronGeometry(radius, detail);
    case 'cylinder':
      const [radTop = 0.5, radBot = 0.5, height = 1, segments = 8] = params;
      return new THREE.CylinderGeometry(radTop, radBot, height, segments);
    case 'cone':
      const [coneRad = 0.5, coneHeight = 1, coneSegs = 8] = params;
      return new THREE.ConeGeometry(coneRad, coneHeight, coneSegs);
    case 'torus':
      const [torusRad = 0.5, tube = 0.2, radialSegs = 8, tubularSegs = 16] = params;
      return new THREE.TorusGeometry(torusRad, tube, radialSegs, tubularSegs);
    case 'plane':
      return new THREE.PlaneGeometry(...(params.length ? params : [1, 1]));
    case 'capsule':
      const [capRad = 0.25, capLen = 0.5, capSegs = 4, capRadSegs = 8] = params;
      return new THREE.CapsuleGeometry(capRad, capLen, capSegs, capRadSegs);
    case 'octahedron':
      return new THREE.OctahedronGeometry(...(params.length ? params : [0.5]));
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(...(params.length ? params : [0.5]));
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(...(params.length ? params : [0.5]));
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(...(params.length ? params : [0.5, 0]));
    case 'ring':
      const [innerR = 0.3, outerR = 0.5, ringSegs = 8] = params;
      return new THREE.RingGeometry(innerR, outerR, ringSegs);
    case 'roundedBox':
      // Approximate with box for now
      const [rbW = 1, rbH = 1, rbD = 1] = params;
      return new THREE.BoxGeometry(rbW, rbH, rbD);
    default:
      console.warn(`Unknown geometry type: ${type}, using box`);
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

// Create material from definition
function createMaterial(matDef = {}) {
  const props = { flatShading: true };

  // Apply preset if specified
  if (matDef.preset && MATERIAL_PRESETS[matDef.preset]) {
    Object.assign(props, MATERIAL_PRESETS[matDef.preset]);
  }

  // Apply color
  if (matDef.color) {
    props.color = new THREE.Color(matDef.color);
  }
  if (matDef.metalness !== undefined) props.metalness = matDef.metalness;
  if (matDef.roughness !== undefined) props.roughness = matDef.roughness;

  // Handle emissive/glow
  if (props.emissive || matDef.emissive) {
    props.emissive = new THREE.Color(matDef.color || '#ffffff');
    props.emissiveIntensity = matDef.emissiveIntensity || props.emissiveIntensity || 1.0;
  }

  if (matDef.transparent) props.transparent = true;
  if (matDef.opacity !== undefined) props.opacity = matDef.opacity;

  return new THREE.MeshStandardMaterial(props);
}

// Build model from spec
function buildModel(spec) {
  const root = new THREE.Group();
  root.name = spec.name || 'model';

  const partMap = new Map();

  // Skip prefabs and groups for now - focus on primitives
  for (const part of spec.parts || []) {
    if (part.type === 'group') {
      const group = new THREE.Group();
      group.name = part.name;
      if (part.position) group.position.set(...part.position);
      if (part.rotation) {
        group.rotation.set(
          THREE.MathUtils.degToRad(part.rotation[0] || 0),
          THREE.MathUtils.degToRad(part.rotation[1] || 0),
          THREE.MathUtils.degToRad(part.rotation[2] || 0)
        );
      }
      partMap.set(part.name, group);
      continue;
    }

    if (part.type === 'prefab') {
      console.warn(`Skipping prefab: ${part.name} (not supported in CLI yet)`);
      continue;
    }

    // Create geometry and material
    const geometry = createGeometry(part.type, part.params);
    const material = createMaterial(part.material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.name;

    // Apply transforms
    if (part.position) mesh.position.set(...part.position);
    if (part.rotation) {
      mesh.rotation.set(
        THREE.MathUtils.degToRad(part.rotation[0] || 0),
        THREE.MathUtils.degToRad(part.rotation[1] || 0),
        THREE.MathUtils.degToRad(part.rotation[2] || 0)
      );
    }
    if (part.scale) {
      if (Array.isArray(part.scale)) {
        mesh.scale.set(...part.scale);
      } else {
        mesh.scale.setScalar(part.scale);
      }
    }

    partMap.set(part.name, mesh);
  }

  // Build hierarchy
  for (const part of spec.parts || []) {
    const obj = partMap.get(part.name);
    if (!obj) continue;

    if (part.parent && partMap.has(part.parent)) {
      partMap.get(part.parent).add(obj);
    } else {
      root.add(obj);
    }
  }

  return root;
}

// Export model to OBJ format (sync, works in Node.js)
function exportToOBJ(model, outputPath) {
  console.log('Starting OBJ export to:', outputPath);
  const exporter = new OBJExporter();
  const result = exporter.parse(model);
  fs.writeFileSync(outputPath, result);
  console.log(`Exported: ${outputPath} (${(result.length / 1024).toFixed(1)} KB)`);
  return outputPath;
}

// Convert OBJ to GLB using Blender
import { execSync } from 'child_process';

function convertToGLB(objPath, glbPath) {
  console.log('Converting to GLB via Blender...');
  // Write Python script to temp file to avoid quoting issues
  const scriptPath = '/tmp/samdin-convert.py';
  const script = `
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath="${objPath}")
bpy.ops.export_scene.gltf(filepath="${glbPath}", export_format='GLB')
print("GLB export complete")
`;
  fs.writeFileSync(scriptPath, script);
  try {
    execSync(`blender --background --python ${scriptPath}`, { stdio: 'pipe' });
    console.log(`Converted: ${glbPath}`);
    fs.unlinkSync(scriptPath);
    return glbPath;
  } catch (err) {
    console.error('Blender conversion failed:', err.message);
    console.log('OBJ file is available at:', objPath);
    return null;
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  console.log('Samdin CLI starting...');
  console.log('Args:', args);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Samdin CLI - Convert specs to OBJ/GLB');
    console.log('');
    console.log('Usage:');
    console.log('  node index.js <spec.json> [output]     Export single spec');
    console.log('  node index.js --glb <spec.json>        Export as GLB (via Blender)');
    console.log('  node index.js --batch <dir> [outdir]   Batch export directory');
    console.log('');
    console.log('Examples:');
    console.log('  node index.js arwing.json              -> arwing.obj');
    console.log('  node index.js --glb arwing.json        -> arwing.glb');
    process.exit(0);
  }

  if (args[0] === '--batch') {
    // Batch mode: convert all specs in directory
    const inputDir = args[1] || '../specs';
    const outputDir = args[2] || './output';

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
    console.log(`Converting ${files.length} specs...`);

    for (const file of files) {
      try {
        const specPath = path.join(inputDir, file);
        const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
        const model = buildModel(spec);
        const outPath = path.join(outputDir, file.replace('.json', '.glb'));
        await exportToGLB(model, outPath);
      } catch (err) {
        console.error(`Failed: ${file} - ${err.message}`);
      }
    }
  } else if (args[0] === '--glb') {
    // GLB mode: export OBJ then convert via Blender
    const specPath = args[1];
    if (!specPath) {
      console.error('Error: No spec file provided');
      process.exit(1);
    }
    const baseName = path.basename(specPath, '.json');
    const objPath = path.join(path.dirname(specPath), `${baseName}.obj`);
    const glbPath = args[2] || path.join(path.dirname(specPath), `${baseName}.glb`);

    console.log('Loading spec:', specPath);
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    console.log('Spec loaded:', spec.name, 'with', spec.parts?.length, 'parts');

    const model = buildModel(spec);
    let meshCount = 0;
    model.traverse(obj => { if (obj.isMesh) meshCount++; });
    console.log('Model built with', meshCount, 'meshes');

    exportToOBJ(model, objPath);
    convertToGLB(objPath, glbPath);

  } else {
    // Single file OBJ mode
    const specPath = args[0];
    const outputPath = args[1] || specPath.replace('.json', '.obj');
    console.log('Loading spec:', specPath);

    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    console.log('Spec loaded:', spec.name, 'with', spec.parts?.length, 'parts');

    const model = buildModel(spec);
    let meshCount = 0;
    model.traverse(obj => { if (obj.isMesh) meshCount++; });
    console.log('Model built with', meshCount, 'meshes');

    exportToOBJ(model, outputPath);
    console.log('Export complete');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
