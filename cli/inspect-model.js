#!/usr/bin/env node
/**
 * Samdin Inspector
 * Loads a spec, takes screenshots from multiple angles, with various modes
 *
 * Usage: node inspect-model.js <spec.json> [output-dir]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWER_DIR = path.resolve(__dirname, '..');

// Simple static file server
function createServer(dir, port) {
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
    '.woff2': 'font/woff2'
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(dir, req.url === '/' ? 'index.html' : req.url);
    filePath = filePath.split('?')[0];
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

function buildReviewTemplate(specName, modelInfo, summary) {
  return `# ${specName} Review

## Model Info
- Triangles: ${modelInfo.tris}
- Vertices: ${modelInfo.verts}
- Objects: ${modelInfo.objects}

## Screenshot Sets
- Normal views: ${summary.screenshots.filter((name) => name.includes('-wireframe-') === false && name.includes('-designgrid-') === false).length}
- Wireframe views: ${summary.screenshots.filter((name) => name.includes('-wireframe-')).length}
- Design-grid views: ${summary.screenshots.filter((name) => name.includes('-designgrid-')).length}

## Review Checklist
- Silhouette reads cleanly from threeQuarter, front, and top views.
- Primary traversal space is obvious and unobstructed.
- No major intersections or floating parts show up in wireframe.
- Material breakup/emissive accents support the form instead of flattening it.
- Scale reads consistently in design-grid screenshots.
- Camera presets show at least one strong hero angle without manual adjustment.

## Revision Notes
- Issue:
  Evidence:
  Proposed change:

- Issue:
  Evidence:
  Proposed change:
`;
}

async function inspectModel(specPath, outputDir) {
  console.log('Loading spec:', specPath);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
  const specName = spec.name || path.basename(specPath, '.json');

  if (!outputDir) {
    outputDir = '/tmp/samdin-inspect';
  }

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('Output directory:', outputDir);

  // Start local server
  const port = 8766;
  console.log(`Starting local server on port ${port}...`);
  const server = await createServer(VIEWER_DIR, port);
  const viewerUrl = `http://localhost:${port}`;

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', async (msg) => {
    const argValues = await Promise.all(
      msg.args().map(async (arg) => {
        try {
          const value = await arg.jsonValue();
          return typeof value === 'string' ? value : JSON.stringify(value);
        } catch {
          return '[unserializable]';
        }
      })
    );
    const text = argValues.length ? argValues.join(' ') : msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      console.log('Browser error:', text);
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
    await page.waitForTimeout(1000);

    // Load the spec via paste modal
    console.log('Loading spec via paste modal...');
    await page.click('#btn-paste-spec');
    await page.waitForSelector('#paste-modal:not(.hidden)', { timeout: 5000 });

    const specJson = JSON.stringify(spec, null, 2);
    await page.fill('#paste-textarea', specJson);
    await page.click('#btn-paste-build');

    // Wait for modal to close
    await page.waitForFunction(() => {
      const modal = document.querySelector('#paste-modal');
      return modal && modal.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Capture the camera view defined by the spec before overriding it with preset sweeps.
    const specCameraFilename = `${specName}-specCamera.png`;
    await page.screenshot({ path: path.join(outputDir, specCameraFilename) });
    console.log(`  Saved: ${specCameraFilename}`);

    // Camera presets to use
    const cameraPresets = ['threeQuarter', 'front', 'back', 'left', 'right', 'top', 'lowAngle', 'highAngle'];

    // Take screenshots from all camera angles (normal mode)
    console.log('\n--- Normal Mode Screenshots ---');
    for (const preset of cameraPresets) {
      await page.selectOption('#camera-select', preset);
      await page.waitForTimeout(600); // Wait for camera animation
      const filename = `${specName}-${preset}.png`;
      await page.screenshot({ path: path.join(outputDir, filename) });
      console.log(`  Saved: ${filename}`);
    }

    // Enable wireframe mode
    console.log('\n--- Wireframe Mode Screenshots ---');
    await page.click('#cam-wireframe');
    await page.waitForTimeout(300);

    for (const preset of cameraPresets) {
      await page.selectOption('#camera-select', preset);
      await page.waitForTimeout(600);
      const filename = `${specName}-wireframe-${preset}.png`;
      await page.screenshot({ path: path.join(outputDir, filename) });
      console.log(`  Saved: ${filename}`);
    }

    // Disable wireframe
    await page.click('#cam-wireframe');
    await page.waitForTimeout(300);

    // Enable design grid
    console.log('\n--- Design Grid Mode Screenshots ---');
    await page.click('#cam-design-grid');
    await page.waitForTimeout(300);

    await page.selectOption('#camera-select', 'threeQuarter');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outputDir, `${specName}-designgrid-threeQuarter.png`) });
    console.log(`  Saved: ${specName}-designgrid-threeQuarter.png`);

    await page.selectOption('#camera-select', 'top');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outputDir, `${specName}-designgrid-top.png`) });
    console.log(`  Saved: ${specName}-designgrid-top.png`);

    // Get model info
    console.log('\n--- Model Info ---');
    const modelInfo = await page.evaluate(() => {
      return {
        tris: document.querySelector('#info-tris')?.textContent,
        verts: document.querySelector('#info-verts')?.textContent,
        objects: document.querySelector('#info-objects')?.textContent
      };
    });
    console.log(`  Triangles: ${modelInfo.tris}`);
    console.log(`  Vertices: ${modelInfo.verts}`);
    console.log(`  Objects: ${modelInfo.objects}`);

    // Write a summary
    const summary = {
      specName,
      modelInfo,
      screenshots: fs.readdirSync(outputDir).filter(f => f.endsWith('.png')),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(
      path.join(outputDir, 'review-template.md'),
      buildReviewTemplate(specName, modelInfo, summary)
    );

    console.log(`\n✓ Inspection complete. Screenshots saved to: ${outputDir}`);
    console.log(`✓ Review template saved to: ${path.join(outputDir, 'review-template.md')}`);

  } catch (err) {
    console.error('Inspection failed:', err.message);
    await page.screenshot({ path: path.join(outputDir, 'error.png'), fullPage: true });
    console.log('Error screenshot saved');
    throw err;
  } finally {
    await browser.close();
    server.close();
  }
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Samdin Inspector');
  console.log('Usage: node inspect-model.js <spec.json> [output-dir]');
  console.log('');
  console.log('Takes screenshots of a model from multiple camera angles');
  console.log('with normal, wireframe, and design grid modes.');
  process.exit(0);
}

inspectModel(args[0], args[1]).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
