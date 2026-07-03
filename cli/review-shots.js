#!/usr/bin/env node
/**
 * Render a review shot-set for a spec: multiple shaded angles + wireframe +
 * a design-grid top, plus model stats. This is the *evidence* half of a
 * review — the grading is done by eye against docs/review-rubric.md.
 *
 * Output: reviews/<name>/shots/*.png  and prints stats + world bbox size.
 *
 * Usage: node cli/review-shots.js <spec.json> [outdir]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const ROOTS = [path.join(REPO, 'src'), REPO];
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const SHADED = ['threeQuarter', 'front', 'left', 'back', 'top', 'lowAngle'];
const WIRE = ['threeQuarter', 'top'];

function serve(port) {
  const s = http.createServer((req, res) => {
    const rel = req.url === '/' ? 'index.html' : req.url.replace(/^\/+/, '').split('?')[0];
    let i = 0;
    const next = () => {
      if (i >= ROOTS.length) { res.writeHead(404); return res.end('nf'); }
      fs.readFile(path.join(ROOTS[i++], rel), (e, c) => {
        if (e) return next();
        res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
        res.end(c);
      });
    };
    next();
  });
  return new Promise((r) => s.listen(port, () => r(s)));
}

const specPath = process.argv[2];
if (!specPath) { console.log('Usage: node cli/review-shots.js <spec.json> [outdir]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const name = spec.name || path.basename(specPath, '.json');
const outDir = process.argv[3] || path.join(REPO, 'reviews', name, 'shots');
fs.mkdirSync(outDir, { recursive: true });

const port = Number.parseInt(process.env.SAMDIN_REVIEW_PORT ?? '', 10) || 8797;
const srv = await serve(port);
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1024, height: 900 } })).newPage();
await page.goto(`http://localhost:${port}`);
await page.waitForFunction(() => document.querySelector('#btn-export') !== null, { timeout: 15000 });
await page.waitForTimeout(500);

await page.evaluate(async (s) => {
  window.app.builder.registerSpec(s);
  await window.app.loadSpec(s.name);
}, spec);
await page.waitForTimeout(900);

const canvas = page.locator('#viewport canvas');
async function shot(preset, file) {
  await page.selectOption('#camera-select', preset);
  await page.waitForTimeout(500);
  const box = await canvas.boundingBox();
  await page.screenshot({ path: path.join(outDir, file), clip: box });
}

for (const v of SHADED) await shot(v, `shaded-${v}.png`);
await page.click('#cam-wireframe');
await page.waitForTimeout(300);
for (const v of WIRE) await shot(v, `wire-${v}.png`);
await page.click('#cam-wireframe');

const stats = await page.evaluate(() => {
  const app = window.app;
  const num = (id) => Number.parseInt((document.querySelector(id)?.textContent || '0').replace(/[^\d]/g, ''), 10);
  // World-space size of the model, for scale reasoning.
  let size = null;
  try {
    const THREE = app.viewer.THREE || window.THREE;
    const box = new (THREE.Box3)().setFromObject(app.viewer.currentModel);
    const s = box.getSize(new (THREE.Vector3)());
    size = [Number(s.x.toFixed(2)), Number(s.y.toFixed(2)), Number(s.z.toFixed(2))];
  } catch { /* THREE not exposed — skip */ }
  return { tris: num('#info-tris'), verts: num('#info-verts'), objects: num('#info-objects'), size };
});

await browser.close();
srv.close();

console.log(JSON.stringify({ name, outDir: path.relative(REPO, outDir), ...stats, shots: [...SHADED.map((v) => `shaded-${v}`), ...WIRE.map((v) => `wire-${v}`)] }, null, 2));
