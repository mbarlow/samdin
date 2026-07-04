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
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
const anchors = files.filter((f) => f.startsWith('quality-bar-')).sort();
const rest = files.filter((f) => !f.startsWith('quality-bar-')).sort();
const list = [...anchors, ...rest];
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(list, null, 0) + '\n');
console.log(`specs/index.json: ${list.length} specs (${anchors.length} anchors)`);
