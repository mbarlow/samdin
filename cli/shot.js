#!/usr/bin/env node
/**
 * Fast single-shot render — one spec, one camera, one screenshot.
 *
 * inspect-model.js sweeps ~18 angles (normal + wireframe + design-grid); for a
 * tight iteration loop you want one image, now. This does that.
 *
 * Usage: node cli/shot.js <spec.json> [out.png] [preset]
 *   preset: threeQuarter (default) | front | side | top | lowAngle | ...
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
const out = process.argv[3] || '/tmp/samdin-shot.png';
const preset = process.argv[4] || 'threeQuarter';
if (!specPath) { console.log('Usage: node cli/shot.js <spec.json> [out.png] [preset]'); process.exit(1); }

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const port = Number.parseInt(process.env.SAMDIN_SHOT_PORT ?? '', 10) || 8795;
const srv = await serve(port);
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`http://localhost:${port}`);
await page.waitForFunction(() => document.querySelector('#btn-export') !== null, { timeout: 15000 });
await page.waitForTimeout(500);

await page.evaluate(async ({ s, preset }) => {
  const app = window.app;
  app.builder.registerSpec(s);
  await app.loadSpec(s.name);
  app.viewer.setCameraPreset(preset);
  app.viewer.fitToModel();
}, { s: spec, preset });
await page.waitForTimeout(900);

const canvas = page.locator('#viewport canvas');
const box = await canvas.boundingBox();
await page.screenshot({ path: out, clip: box });
const info = await page.evaluate(() => ({
  t: document.querySelector('#info-tris')?.textContent,
  o: document.querySelector('#info-objects')?.textContent
}));
console.log(`${path.basename(out)}  ${info.t} tris, ${info.o} objects  [${preset}]`);

await browser.close();
srv.close();
