#!/usr/bin/env node
/**
 * Samdin Probe — rendered-space linter (#83).
 *
 * validate-spec.cjs checks spec-space; this checks what actually builds and
 * renders. Loads the spec headless and emits machine-readable findings:
 *
 *   contact   — grounded-looking parts floating above / buried below the
 *               ground (terrain mesh → env meshes → y=0), per world bbox
 *   albedo    — materials whose effective albedo (color × mean vertex color)
 *               will render near-black or blown out
 *   clones    — instance families (arrays/scatters) with zero rotation AND
 *               zero scale variance → clone read
 *   luma      — specCamera render histogram: crushed-shadow / blown-highlight
 *               pixel share
 *
 * Usage: node cli/probe.js <spec.json> [--json out.json] [--port 8768]
 * Exit codes: 0 clean/warnings only, 1 errors found, 2 harness failure.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVE_ROOTS = [path.join(REPO_ROOT, 'src'), REPO_ROOT];

function createServer(roots, port) {
  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.gltf': 'model/gltf+json'
  };
  const server = http.createServer((req, res) => {
    const rel = req.url === '/' ? 'index.html' : req.url.replace(/^\/+/, '').split('?')[0];
    for (const root of roots) {
      const candidate = path.join(root, rel);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(candidate)] || 'application/octet-stream' });
        res.end(fs.readFileSync(candidate));
        return;
      }
    }
    res.writeHead(404);
    res.end('Not found');
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// Runs inside the page. Returns findings from scene-space analysis.
async function analyzeInPage(specName) {
  const THREE = await import('three');
  const app = window.app;
  const spec = await (await fetch(`/specs/${specName}`)).json();
  app.builder.registerSpec(spec);
  await app.loadSpec(spec.name);
  await new Promise((r) => setTimeout(r, 1200));

  const scene = app.viewer.getScene();
  let model = null;
  scene.traverse((o) => { if (!model && o.name === spec.name) model = o; });
  if (!model) return { error: 'model not found in scene' };
  model.updateMatrixWorld(true);

  const findings = [];

  // ── ground candidates ──────────────────────────────────────────────
  const terrain = [];
  const env = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === '__terrain__') terrain.push(o);
    else if (o.userData?.category === 'environment') env.push(o);
  });
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const groundYAt = (x, z, topY, excludeRoot) => {
    const inExcluded = (obj) => {
      for (let p = obj; p; p = p.parent) if (p === excludeRoot) return true;
      return false;
    };
    raycaster.set(new THREE.Vector3(x, topY + 100, z), down);
    for (const candidates of [terrain, env]) {
      if (!candidates.length) continue;
      const hits = raycaster.intersectObjects(candidates, false).filter((h) => !inExcluded(h.object));
      if (hits.length) return hits[0].point.y;
    }
    return 0;
  };

  // ── contact check: root-level assemblies + modifier instances ──────
  const rootGroup = model.children.find((c) => c.name === spec.root) || model;
  const contactTargets = [];
  for (const child of rootGroup.children) {
    if (!child.name || child.name === '__terrain__') continue;
    if (child.userData?.category === 'environment') continue;
    contactTargets.push(child);
  }
  const bbox = new THREE.Box3();
  for (const target of contactTargets) {
    // Deliberately snapped/offset parts are authored intent — skip.
    if (target.userData?.snapToGround) continue;
    bbox.setFromObject(target);
    if (bbox.isEmpty()) continue;
    const cx = (bbox.min.x + bbox.max.x) / 2;
    const cz = (bbox.min.z + bbox.max.z) / 2;
    const groundY = groundYAt(cx, cz, bbox.max.y, target);
    const gap = bbox.min.y - groundY;
    const height = bbox.max.y - bbox.min.y;
    // Only judge parts that plausibly want ground contact: near the ground
    // relative to their own size. Skip obviously airborne detail.
    if (bbox.min.y - groundY > Math.max(1.5, height)) continue;
    if (gap > 0.08) {
      findings.push({
        severity: 'warning', check: 'contact', part: target.name,
        value: +gap.toFixed(3),
        hint: `floats ${gap.toFixed(2)}m above ground — snapToGround or lower position`
      });
    } else if (gap < -Math.min(0.35 * height, 0.5)) {
      findings.push({
        severity: 'warning', check: 'contact', part: target.name,
        value: +gap.toFixed(3),
        hint: `buried ${(-gap).toFixed(2)}m into ground — snapToGround or raise position`
      });
    }
  }

  // ── effective albedo ────────────────────────────────────────────────
  const seenMats = new Set();
  model.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = o.material;
    if (seenMats.has(m.uuid) || !m.color) return;
    seenMats.add(m.uuid);
    if (m.emissive && m.emissive.getHex() !== 0) return;
    if (o.name === '__terrain__') return;
    let vcLuma = 1;
    if (m.vertexColors && o.geometry?.attributes?.color) {
      const col = o.geometry.attributes.color;
      let sum = 0;
      const step = Math.max(1, Math.floor(col.count / 200));
      let n = 0;
      for (let i = 0; i < col.count; i += step) {
        sum += 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
        n++;
      }
      vcLuma = n ? sum / n : 1;
    }
    const baseLuma = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
    const effective = baseLuma * vcLuma;
    if (effective < 0.03) {
      findings.push({
        severity: 'error', check: 'albedo', part: o.name,
        value: +effective.toFixed(4),
        hint: 'effective albedo near-black — will silhouette under any rig'
      });
    } else if (effective > 0.92) {
      findings.push({
        severity: 'warning', check: 'albedo', part: o.name,
        value: +effective.toFixed(4),
        hint: 'effective albedo near-white — will blow out under bloom'
      });
    }
  });

  // ── clone read: instance families with zero variance ───────────────
  // Measure the instance ROOT (shallowest object per index) — jitter and
  // scatter variation live on the placement group, not the leaf meshes.
  const families = new Map();
  const depthOf = (o) => { let d = 0; for (let p = o; p; p = p.parent) d++; return d; };
  model.traverse((o) => {
    if (!o.name) return;
    const m = o.name.match(/^(.*?)(?:_scatter)?_(\d+)(?:_|$)/);
    if (!m) return;
    let fam = families.get(m[1]);
    if (!fam) families.set(m[1], (fam = new Map()));
    const idx = m[2];
    const existing = fam.get(idx);
    if (!existing || depthOf(o) < depthOf(existing)) fam.set(idx, o);
  });
  for (const [name, byIndex] of families) {
    const members = [...byIndex.values()];
    if (members.length < 4) continue;
    const rotY = members.map((o) => o.rotation.y);
    const scl = members.map((o) => o.scale.x);
    const variance = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    };
    if (variance(rotY) < 1e-6 && variance(scl) < 1e-8) {
      findings.push({
        severity: 'warning', check: 'clones', part: name,
        value: members.length,
        hint: `${members.length} identical instances — add array jitter or scatter randomRotation/scaleVariation`
      });
    }
  }

  return { findings, stats: { objects: (() => { let n = 0; model.traverse(() => n++); return n; })() } };
}

async function main() {
  const args = process.argv.slice(2);
  const specPath = args.find((a) => !a.startsWith('--'));
  if (!specPath) {
    console.error('Usage: node cli/probe.js <spec.json> [--json out.json] [--port 8768]');
    process.exit(2);
  }
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
  const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1], 10) : 8768;
  const specName = path.basename(specPath);

  const server = await createServer(SERVE_ROOTS, port);
  const browser = await chromium.launch();
  let findings = [];
  let exitCode = 0;

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (err) => console.error('[page]', err.message));
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.app?.builder, { timeout: 15000 });

    const result = await page.evaluate(analyzeInPage, specName);
    if (result.error) throw new Error(result.error);
    findings = result.findings;

    // ── luma histogram over the canvas render ─────────────────────────
    const canvas = await page.$('canvas');
    const shot = PNG.sync.read(await canvas.screenshot({ type: 'png' }));
    let crushed = 0;
    let blown = 0;
    const total = shot.width * shot.height;
    for (let i = 0; i < shot.data.length; i += 4) {
      const luma = 0.2126 * shot.data[i] + 0.7152 * shot.data[i + 1] + 0.0722 * shot.data[i + 2];
      if (luma < 8) crushed++;
      else if (luma > 247) blown++;
    }
    const crushedPct = (crushed / total) * 100;
    const blownPct = (blown / total) * 100;
    if (crushedPct > 40) {
      findings.push({
        severity: 'warning', check: 'luma', part: '(render)',
        value: +crushedPct.toFixed(1),
        hint: `${crushedPct.toFixed(0)}% of pixels crushed to black — check lighting rig / albedo`
      });
    }
    if (blownPct > 6) {
      findings.push({
        severity: 'warning', check: 'luma', part: '(render)',
        value: +blownPct.toFixed(1),
        hint: `${blownPct.toFixed(0)}% of pixels blown to white — check exposure / bloom`
      });
    }

    // ── report ────────────────────────────────────────────────────────
    const errors = findings.filter((f) => f.severity === 'error');
    const warnings = findings.filter((f) => f.severity === 'warning');
    console.log(`\n📡 probe ${specName} — ${result.stats.objects} objects, luma crushed ${crushedPct.toFixed(1)}% / blown ${blownPct.toFixed(1)}%`);
    console.log('─'.repeat(48));
    for (const f of findings) {
      const icon = f.severity === 'error' ? '✗' : '⚠';
      console.log(`${icon} [${f.check}] ${f.part}: ${f.hint} (${f.value})`);
    }
    if (!findings.length) console.log('✓ no findings');
    console.log('─'.repeat(48));
    console.log(`${errors.length} errors, ${warnings.length} warnings`);

    if (jsonOut) {
      fs.writeFileSync(jsonOut, JSON.stringify({ spec: specName, findings }, null, 2) + '\n');
      console.log(`findings → ${jsonOut}`);
    }
    if (errors.length) exitCode = 1;
  } catch (err) {
    console.error('probe failed:', err.message);
    exitCode = 2;
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(exitCode);
}

main();
