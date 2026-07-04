#!/usr/bin/env node
/**
 * Score history for samdin specs — the gauge for "is the art actually
 * getting better". Append-only log written by the samdin-critic agent after
 * each review; `show` prints the latest score per spec with the delta from
 * its previous review, so improvement (or regression) is legible over time.
 *
 * Stdlib-only (no deps) so it matches validate-spec.cjs / gen-spec-index.cjs
 * and can run in CI without an install.
 *
 * Usage:
 *   node cli/scoreboard.cjs                          # show the board
 *   node cli/scoreboard.cjs show [--spec <name>]     # full history for one spec
 *   node cli/scoreboard.cjs record <name> <score> <verdict> \
 *        [--dims concept=NN,proportion=NN,feature=NN,silhouette=NN,construction=NN,material=NN] \
 *        [--note "<one line>"]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const BOARD = path.join(REPO, 'reviews', 'scoreboard.json');
const DIM_KEYS = ['concept', 'proportion', 'feature', 'silhouette', 'construction', 'material'];

function load() {
  try {
    return JSON.parse(fs.readFileSync(BOARD, 'utf8'));
  } catch {
    return { entries: [] };
  }
}
function save(board) {
  fs.writeFileSync(BOARD, JSON.stringify(board, null, 2) + '\n');
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function verdictFor(score, dims) {
  if (score < 50 || (dims && Object.values(dims).some((v) => v < 40))) return 'reject';
  if (score < 65) return 'rework';
  if (score < 80) return 'revise';
  return 'ship';
}
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dims') flags.dims = argv[++i];
    else if (argv[i] === '--note') flags.note = argv[++i];
    else if (argv[i] === '--spec') flags.spec = argv[++i];
  }
  return flags;
}
function parseDims(s) {
  if (!s) return null;
  const dims = {};
  for (const pair of s.split(',')) {
    const [k, v] = pair.split('=');
    const key = (k || '').trim();
    if (DIM_KEYS.includes(key)) dims[key] = Number.parseInt(v, 10);
  }
  return Object.keys(dims).length ? dims : null;
}

function record(argv) {
  const [name, scoreStr, verdictArg] = argv;
  const flags = parseFlags(argv.slice(3));
  if (!name || scoreStr === undefined) {
    console.error('Usage: scoreboard.cjs record <name> <score> [verdict] [--dims ...] [--note ...]');
    process.exit(1);
  }
  const score = Number.parseInt(scoreStr, 10);
  if (Number.isNaN(score) || score < 0 || score > 100) {
    console.error(`Bad score: ${scoreStr} (expected 0–100)`);
    process.exit(1);
  }
  const dims = parseDims(flags.dims);
  const verdict = verdictArg && !verdictArg.startsWith('--') ? verdictArg : verdictFor(score, dims);
  const board = load();
  const entry = { spec: name, date: today(), score, verdict };
  if (dims) entry.dims = dims;
  if (flags.note) entry.note = flags.note;
  board.entries.push(entry);
  save(board);
  console.log(`recorded  ${name}  ${score}/100  ${verdict}${dims ? '  [dims]' : ''}`);
}

function latestPrev(entries, spec) {
  const hist = entries.filter((e) => e.spec === spec).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { latest: hist[hist.length - 1], prev: hist[hist.length - 2], count: hist.length };
}

function showBoard(board) {
  const specs = [...new Set(board.entries.map((e) => e.spec))];
  if (!specs.length) {
    console.log('No reviews recorded yet. Run the samdin-critic on a spec.');
    return;
  }
  const rows = specs.map((spec) => {
    const { latest, prev, count } = latestPrev(board.entries, spec);
    const delta = prev ? latest.score - prev.score : null;
    const arrow = delta === null ? '  ·' : delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : ' 0';
    return { spec, score: latest.score, verdict: latest.verdict, delta: arrow, date: latest.date, count };
  }).sort((a, b) => b.score - a.score);

  const w = Math.max(...rows.map((r) => r.spec.length), 6);
  console.log(`\n  Samdin score board — graded from the render against each spec's target\n`);
  console.log(`  ${'spec'.padEnd(w)}  score  Δ     verdict   reviews  last`);
  console.log(`  ${'─'.repeat(w)}  ─────  ────  ────────  ───────  ──────────`);
  for (const r of rows) {
    console.log(
      `  ${r.spec.padEnd(w)}  ${String(r.score).padStart(3)}    ${r.delta.padStart(4)}  ${r.verdict.padEnd(8)}  ${String(r.count).padStart(5)}    ${r.date}`
    );
  }
  const avg = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const shipping = rows.filter((r) => r.verdict === 'ship').length;
  console.log(`\n  ${rows.length} specs · avg ${avg}/100 · ${shipping} shipping\n`);
}

function showSpec(board, spec) {
  const hist = board.entries.filter((e) => e.spec === spec).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!hist.length) {
    console.log(`No history for "${spec}".`);
    return;
  }
  console.log(`\n  ${spec} — review history\n`);
  for (const e of hist) {
    const d = e.dims ? '  (' + DIM_KEYS.filter((k) => e.dims[k] != null).map((k) => `${k[0]}:${e.dims[k]}`).join(' ') + ')' : '';
    console.log(`  ${e.date}  ${String(e.score).padStart(3)}/100  ${e.verdict.padEnd(7)}${d}`);
    if (e.note) console.log(`             ${e.note}`);
  }
  console.log();
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const board = load();
  if (cmd === 'record') return record(rest);
  const flags = parseFlags(process.argv.slice(2));
  if (flags.spec) return showSpec(board, flags.spec);
  return showBoard(board);
}
main();
