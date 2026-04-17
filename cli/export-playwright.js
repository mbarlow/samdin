#!/usr/bin/env node
/**
 * Samdin Playwright Exporter
 * Automates the viewer to export specs as GLB with materials preserved
 *
 * Usage: node export-playwright.js <spec.json> [output.glb]
 *
 * Runs a local server for the viewer, loads the spec, and exports to GLB
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVE_ROOTS = [
  path.join(REPO_ROOT, 'src'),
  REPO_ROOT
];

// Simple static file server — walks SERVE_ROOTS in order so /index.html and
// /js/* come from src/ while /specs/*, /prefabs/*, /media/* fall back to repo root.
function createServer(roots, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4'
  };

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
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function exportSpec(specPath, outputPath) {
  console.log('Loading spec:', specPath);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
  const specName = spec.name || path.basename(specPath, '.json');

  if (!outputPath) {
    outputPath = specPath.replace('.json', '.glb');
  }

  // Start local server
  const port = 8765;
  console.log(`Starting local server on port ${port}...`);
  const server = await createServer(SERVE_ROOTS, port);
  const viewerUrl = `http://localhost:${port}`;

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true
  });
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });

  try {
    console.log('Opening viewer:', viewerUrl);
    await page.goto(viewerUrl);
    await page.waitForLoadState('networkidle');

    // Wait for app to initialize
    console.log('Waiting for app to initialize...');
    await page.waitForFunction(() => {
      return document.querySelector('#btn-export') !== null;
    }, { timeout: 10000 });

    // Give the app time to fully load
    await page.waitForTimeout(1000);

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/samdin-viewer.png', fullPage: true });
    console.log('Screenshot saved to /tmp/samdin-viewer.png');

    // Click the "Paste Spec" button to open the modal
    console.log('Opening paste spec modal...');
    await page.click('#btn-paste-spec');
    await page.waitForSelector('#paste-modal:not(.hidden)', { timeout: 5000 });

    // Paste the spec JSON
    console.log('Pasting spec JSON...');
    const specJson = JSON.stringify(spec, null, 2);
    await page.fill('#paste-textarea', specJson);

    // Click "Build" in the modal
    console.log('Building model...');
    await page.click('#btn-paste-build');

    // Wait for modal to close (hidden class means it's closed)
    await page.waitForFunction(() => {
      const modal = document.querySelector('#paste-modal');
      return modal && modal.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.waitForTimeout(2000); // Give time for the model to render

    // Take screenshot after build
    await page.screenshot({ path: '/tmp/samdin-built.png', fullPage: true });
    console.log('Built screenshot saved to /tmp/samdin-built.png');

    // Set up download handler before triggering export
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    // Click the export button
    console.log('Triggering export...');
    await page.click('#btn-export');

    // Wait for download
    console.log('Waiting for download...');
    const download = await downloadPromise;
    const downloadPath = await download.path();

    // Copy to desired output path
    fs.copyFileSync(downloadPath, outputPath);
    const stats = fs.statSync(outputPath);
    console.log(`Exported: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  } catch (err) {
    console.error('Export failed:', err.message);

    // Take error screenshot
    await page.screenshot({ path: '/tmp/samdin-error.png', fullPage: true });
    console.log('Error screenshot saved to /tmp/samdin-error.png');

    throw err;
  } finally {
    await browser.close();
    server.close();
    console.log('Done');
  }
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Samdin Playwright Exporter');
  console.log('Usage: node export-playwright.js <spec.json> [output.glb]');
  console.log('');
  console.log('Exports Samdin specs to GLB with materials preserved');
  console.log('Requires: npm install playwright');
  process.exit(0);
}

exportSpec(args[0], args[1]).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
