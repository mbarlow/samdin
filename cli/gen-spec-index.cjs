#!/usr/bin/env node
/**
 * Write specs/index.json — the manifest the viewer fetches to populate its
 * built-in dropdown from the real specs on disk (anchors first). Run after
 * adding or renaming a spec: `make spec-index`. Stdlib-only.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const dir = path.join(REPO, 'specs');
// Specs live in anchors/ (quality-bar), examples/, and fixtures/ (#42);
// entries are paths relative to specs/ so the viewer can fetch them directly.
const files = [];
for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    for (const f of fs.readdirSync(path.join(dir, entry.name))) {
      if (f.endsWith('.json')) files.push(`${entry.name}/${f}`);
    }
  } else if (entry.name.endsWith('.json') && entry.name !== 'index.json') {
    files.push(entry.name);
  }
}
const anchors = files.filter((f) => f.startsWith('anchors/')).sort();
const rest = files.filter((f) => !f.startsWith('anchors/')).sort();
const list = [...anchors, ...rest];
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(list, null, 0) + '\n');
console.log(`specs/index.json: ${list.length} specs (${anchors.length} anchors)`);
