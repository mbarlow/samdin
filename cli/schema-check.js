#!/usr/bin/env node
/**
 * Validate specs against schema/samdin-spec.schema.json (JSON Schema draft-07).
 *
 * This is the STRUCTURAL layer — required fields, enums (preset/tonemapping/
 * type names), and value shapes. Per-type param counts, parent resolution, CSG
 * wiring, and the quality lints stay in validate-spec.cjs, which is stdlib-only
 * so it can gate CI with no install. Schema-check needs ajv, so it lives here in
 * cli/ and runs via `make schema-check`.
 *
 * Usage: node cli/schema-check.js <spec.json> [more...]  (or specs/*.json)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schema', 'samdin-spec.schema.json');

function main() {
  const files = process.argv.slice(2).filter((a) => path.basename(a) !== 'index.json' && fs.existsSync(a) && fs.statSync(a).isFile());
  if (!files.length) {
    console.log('Usage: node cli/schema-check.js <spec.json> [more...]');
    process.exit(1);
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  let failed = 0;
  for (const file of files) {
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.log(`✗ ${path.basename(file)} — invalid JSON: ${e.message}`);
      failed++;
      continue;
    }
    if (validate(spec)) {
      console.log(`✓ ${path.basename(file)}`);
    } else {
      failed++;
      console.log(`✗ ${path.basename(file)}`);
      for (const err of validate.errors) {
        console.log(`    ${err.instancePath || '/'} ${err.message}`);
      }
    }
  }

  console.log(`\n${files.length - failed}/${files.length} specs conform to the schema`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
