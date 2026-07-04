#!/usr/bin/env node
/**
 * Render a clean hero shot of a spec for the gallery:
 *   - camera-relative 3-point lighting (key + fill + rim), always lighting the
 *     face the camera sees — "front" = camera side, whatever the spec's orientation.
 *   - centered, fully in frame (fit + margin).
 *   - grid off, UI off. The spec's own background + emissive accents are kept.
 *
 * Usage: node cli/hero.js <spec.json> [out.png]
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

// vec helpers (node side — THREE isn't on window)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (...vs) => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const specPath = process.argv[2];
if (!specPath) { console.log('Usage: node cli/hero.js <spec.json> [out.png]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const name = spec.name || path.basename(specPath, '.json');
const out = process.argv[3] || path.join(REPO, 'media', `hero-${name}.png`);

const port = Number.parseInt(process.env.SAMDIN_HERO_PORT ?? '', 10) || 8799;
const srv = await serve(port);
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 })).newPage();
await page.goto(`http://localhost:${port}`);
await page.waitForFunction(() => document.querySelector('#btn-export') !== null, { timeout: 15000 });
await page.waitForTimeout(500);

// Build + let the spec's own camera settle (it frames the front), then re-fit
// for centered full-frame and pull back a touch for margin.
const cam = await page.evaluate(async (s) => {
  const app = window.app;
  app.builder.registerSpec(s);
  await app.loadSpec(s.name);
  await new Promise((r) => setTimeout(r, 900));
  app.viewer.fitToModel();
  const c = app.viewer.camera, t = app.viewer.controls.target;
  // pull back 12% for margin, and lift the camera for a top-down three-quarter
  // (so flat objects show their face, not an edge).
  const dir = { x: c.position.x - t.x, y: c.position.y - t.y, z: c.position.z - t.z };
  const dist = Math.hypot(dir.x, dir.y, dir.z) || 4;
  c.position.set(t.x + dir.x * 1.12, t.y + dir.y * 1.12 + dist * 0.22, t.z + dir.z * 1.12);
  app.viewer.controls.update();
  if (app.viewer.grid) app.viewer.grid.visible = false;
  return { p: [c.position.x, c.position.y, c.position.z], t: [t.x, t.y, t.z] };
}, spec);

// camera-relative 3-point rig
const forward = norm(sub(cam.t, cam.p));
const worldUp = [0, 1, 0];
const right = norm(cross(forward, worldUp));
const up = norm(cross(right, forward));
const dist = len(sub(cam.p, cam.t)) || 4;
const key = add(cam.p, mul(right, -dist * 0.45), mul(up, dist * 0.55));   // front upper-left
const fill = add(cam.p, mul(right, dist * 0.7), mul(up, -dist * 0.05));    // front right, softer
const rim = add(cam.t, mul(forward, dist * 0.9), mul(up, dist * 0.8));     // behind, high — separation

await page.evaluate(({ key, fill, rim }) => {
  const app = window.app;
  // Softer directional + more ambient so glossy flat tops don't blow out to a
  // specular hotspot; the rim stays low.
  app.lighting.applyConfig({
    intensity: 1,
    ambient: { color: 0x424852, intensity: 0.85 },
    lights: [
      { type: 'directional', color: 0xfff4e6, intensity: 1.5, position: key, shadow: true },
      { type: 'directional', color: 0xdfe8f5, intensity: 0.8, position: fill },
      { type: 'directional', color: 0xffffff, intensity: 0.6, position: rim },
    ],
  });
  app.lighting.setEnvironment('studio');
  app.lighting.setEnvMapIntensity(0.85);
  app.viewer.setExposure(0.92);
}, { key, fill, rim });
await page.waitForTimeout(700);

const canvas = page.locator('#viewport canvas');
const box = await canvas.boundingBox();
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, clip: box });
const info = await page.evaluate(() => document.querySelector('#info-tris')?.textContent);
console.log(`${path.basename(out)}  ${info} tris`);

await browser.close();
srv.close();
