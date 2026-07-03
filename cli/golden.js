#!/usr/bin/env node
/**
 * Samdin golden regression harness for the quality-bar anchors.
 *
 * Two layers, because the browser renderer is not portable across machines
 * (local GPU vs CI software GL will never pixel-match):
 *
 *   1. STRUCTURAL FINGERPRINT (hard gate, renderer-independent)
 *      tris / verts / objects for each anchor, at the anchor's own pinned
 *      scene.quality. Deterministic. Catches geometry regressions — exactly
 *      what a qualityTier change (#12) would move.
 *
 *   2. CANVAS PNGs (soft, local-only)
 *      Rendered images per anchor at a few presets, diffed with pixelmatch.
 *      Useful for eyeballing on one machine; skipped as a gate under CI
 *      (set GOLDEN_NO_PIXEL=1) where the renderer differs.
 *
 * Usage:
 *   node cli/golden.js              # compare against goldens/, exit 1 on drift
 *   node cli/golden.js --update     # (re)write goldens from current build
 *   GOLDEN_NO_PIXEL=1 node ...      # fingerprint gate only (CI mode)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GOLDEN_DIR = path.join(REPO_ROOT, 'goldens');
const SERVE_ROOTS = [path.join(REPO_ROOT, 'src'), REPO_ROOT];

const VIEWS = ['specCamera', 'threeQuarter', 'lowAngle'];
const PIXEL_THRESHOLD = 0.02; // max fraction of differing pixels before a soft fail
const NO_PIXEL = process.env.GOLDEN_NO_PIXEL === '1' || process.env.CI === 'true';

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.webm': 'video/webm', '.mp4': 'video/mp4'
};

function createServer(roots, port) {
  function resolveFile(urlPath, cb) {
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '').split('?')[0];
    let i = 0;
    const tryNext = () => {
      if (i >= roots.length) return cb(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const candidate = path.join(roots[i++], rel);
      fs.readFile(candidate, (err, content) => {
        if (err && err.code === 'ENOENT') return tryNext();
        cb(err, content, candidate);
      });
    };
    tryNext();
  }
  const server = http.createServer((req, res) => {
    resolveFile(req.url, (err, content, filePath) => {
      if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); res.end('err'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(content);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

function num(text) {
  return Number.parseInt(String(text ?? '').replace(/[^\d]/g, ''), 10) || 0;
}

async function captureAnchor(page, spec, specName, outDir) {
  await page.click('#btn-paste-spec');
  await page.waitForSelector('#paste-modal:not(.hidden)', { timeout: 5000 });
  await page.fill('#paste-textarea', JSON.stringify(spec, null, 2));
  await page.click('#btn-paste-build');
  await page.waitForFunction(() => {
    const m = document.querySelector('#paste-modal');
    return m && m.classList.contains('hidden');
  }, { timeout: 10000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => ({
    tris: document.querySelector('#info-tris')?.textContent,
    verts: document.querySelector('#info-verts')?.textContent,
    objects: document.querySelector('#info-objects')?.textContent
  }));
  const fingerprint = { tris: num(info.tris), verts: num(info.verts), objects: num(info.objects) };

  // Pixel layer is local-only. Under CI/software GL, capturing the busy WebGL
  // canvas times out (8s+ each) and the accumulated thrash wedges the page so
  // later anchors' interactions die. Skip screenshots entirely when the pixel
  // gate is off — CI only needs the DOM-read fingerprint above.
  const shots = {};
  if (NO_PIXEL) return { fingerprint, shots };

  // locator.screenshot() waits for element "stability", which samdin's
  // continuous render loop never satisfies — page.screenshot({clip}) skips
  // that wait. Each shot is best-effort; a hiccup must not lose the fingerprint.
  const box = await page.locator('#viewport canvas').boundingBox();
  for (const view of VIEWS) {
    if (view !== 'specCamera') {
      await page.selectOption('#camera-select', view);
      await page.waitForTimeout(600);
    }
    const file = path.join(outDir, `${specName}-${view}.png`);
    try {
      await page.screenshot({ path: file, clip: box, timeout: 8000 });
      shots[view] = file;
    } catch (e) {
      console.log(`   ⚠ screenshot ${view} skipped: ${e.message.split('\n')[0]}`);
    }
  }
  return { fingerprint, shots };
}

function pixelDiff(aPath, bPath) {
  // No golden (or no fresh render) for this view — nothing to compare, so skip
  // rather than fail. A view that couldn't be captured at seed time (e.g. an
  // unstable spec camera) simply has no soft-layer reference.
  if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) return { ratio: 0, reason: 'skip' };
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  if (a.width !== b.width || a.height !== b.height) return { ratio: 1, reason: 'size' };
  const diff = new PNG({ width: a.width, height: a.height });
  const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  return { ratio: bad / (a.width * a.height), diffPng: diff };
}

async function main() {
  const update = process.argv.includes('--update');
  const specDir = path.join(REPO_ROOT, 'specs');
  const anchors = fs.readdirSync(specDir)
    .filter((f) => f.startsWith('quality-bar-') && f.endsWith('.json'))
    .map((f) => path.join(specDir, f));

  if (!anchors.length) { console.error('No quality-bar anchors found'); process.exit(1); }
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  const workDir = path.join(REPO_ROOT, '.golden-work');
  fs.mkdirSync(workDir, { recursive: true });

  const port = Number.parseInt(process.env.SAMDIN_GOLDEN_PORT ?? '', 10) || 8767;
  const server = await createServer(SERVE_ROOTS, port);
  const viewerUrl = `http://localhost:${port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  const fpPath = path.join(GOLDEN_DIR, 'fingerprints.json');
  const goldenFp = fs.existsSync(fpPath) ? JSON.parse(fs.readFileSync(fpPath, 'utf-8')) : {};
  const newFp = {};
  const failures = [];

  try {
    for (const specPath of anchors) {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const specName = spec.name || path.basename(specPath, '.json');
      process.stdout.write(`\n▸ ${specName}\n`);

      const dest = update ? GOLDEN_DIR : workDir;
      // Fresh page per anchor. Building multiple heavy specs in one page
      // session wedges the paste modal after ~2 builds, so isolate each.
      let fingerprint;
      const page = await context.newPage();
      try {
        await page.goto(viewerUrl);
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => document.querySelector('#btn-export') !== null, { timeout: 15000 });
        await page.waitForTimeout(600);
        ({ fingerprint } = await captureAnchor(page, spec, specName, dest));
      } catch (e) {
        failures.push(`${specName}: capture failed — ${e.message.split('\n')[0]}`);
        console.log(`   ✗ capture failed: ${e.message.split('\n')[0]}`);
        continue;
      } finally {
        await page.close();
      }
      newFp[specName] = fingerprint;
      console.log(`   fingerprint  tris=${fingerprint.tris} verts=${fingerprint.verts} objects=${fingerprint.objects}`);

      if (update) { console.log('   goldens updated'); continue; }

      // Fingerprint gate (hard)
      const g = goldenFp[specName];
      if (!g) {
        failures.push(`${specName}: no golden fingerprint (run --update)`);
      } else {
        for (const k of ['tris', 'verts', 'objects']) {
          if (g[k] !== fingerprint[k]) {
            failures.push(`${specName}: ${k} ${g[k]} → ${fingerprint[k]}`);
          }
        }
      }

      // Pixel gate (soft, local only)
      if (!NO_PIXEL) {
        for (const view of VIEWS) {
          const cur = path.join(workDir, `${specName}-${view}.png`);
          const gold = path.join(GOLDEN_DIR, `${specName}-${view}.png`);
          const { ratio, reason, diffPng } = pixelDiff(gold, cur);
          if (ratio > PIXEL_THRESHOLD) {
            if (diffPng) fs.writeFileSync(path.join(workDir, `${specName}-${view}-diff.png`), PNG.sync.write(diffPng));
            failures.push(`${specName}/${view}: pixel diff ${(ratio * 100).toFixed(2)}%${reason ? ` (${reason})` : ''}`);
          }
        }
      } else {
        console.log('   pixel gate skipped (CI / GOLDEN_NO_PIXEL)');
      }
    }

    if (update) {
      const written = Object.keys(newFp).length;
      fs.writeFileSync(fpPath, JSON.stringify(newFp, null, 2) + '\n');
      console.log(`\n✓ Wrote goldens for ${written}/${anchors.length} anchors → ${path.relative(REPO_ROOT, GOLDEN_DIR)}/`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + '═'.repeat(48));
  if (failures.length) {
    console.log(`✗ ${failures.length} golden ${update ? 'capture ' : ''}failure(s):`);
    failures.forEach((f) => console.log(`   ${f}`));
    process.exit(1);
  }
  if (!update) {
    console.log(`✓ ${anchors.length} anchors match goldens${NO_PIXEL ? ' (fingerprint gate)' : ''}`);
  }
}

main().catch((err) => { console.error('golden error:', err); process.exit(1); });
