/**
 * cmdk.js — command palette
 *
 * Pulls commands from the live DOM at open time, so anything you add to
 * #spec-select / #lighting-select / #panel section headers shows up
 * automatically. Each command either .click()s a real button, sets a
 * <select> value + dispatches change, or runs a tiny inline action.
 *
 * No knowledge of window.app — everything routes through the DOM.
 */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const palette = $('#cmdk');
const input   = $('#cmdk-input');
const results = $('#cmdk-results');

if (!palette || !input || !results) {
  console.warn('[cmdk] missing DOM, skipping init');
} else {
  init();
}

let commands = [];
let filtered = [];
let cursor   = 0;

function init() {
  // Open / close
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const cmdK  = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (cmdK) { e.preventDefault(); open(); return; }
    if (e.key === 'Escape' && !palette.classList.contains('hidden')) {
      e.preventDefault(); close();
    }
  });

  $('#qb-cmdk')?.addEventListener('click', open);
  $('.cmdk-backdrop', palette)?.addEventListener('click', close);

  // Filtering
  input.addEventListener('input', () => {
    cursor = 0;
    render();
  });

  // Keyboard nav inside palette
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.min(cursor + 1, filtered.length - 1);
      render(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
      render(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCurrent();
    }
  });
}

function open() {
  commands = collectCommands();
  filtered = commands.slice();
  cursor = 0;
  input.value = '';
  palette.classList.remove('hidden');
  render();
  // focus on next frame so the open animation doesn't eat the focus
  requestAnimationFrame(() => input.focus());
}

function close() {
  palette.classList.add('hidden');
}

function runCurrent() {
  const cmd = filtered[cursor];
  if (!cmd) return;
  close();
  // run after close so any toast/modal the action opens isn't underneath us
  setTimeout(() => {
    try { cmd.run(); } catch (err) { console.error('[cmdk]', cmd.id, err); }
  }, 50);
}

/* ---------- collection ---------- */

function collectCommands() {
  const out = [];
  const add = (cat, label, run, hint = '') => out.push({ id: `${cat}:${label}`, cat, label, run, hint });

  // Forward a click on a real button (if present)
  const click = (sel) => () => $(sel)?.click();
  // Set a <select> value and fire change
  const setSelect = (sel, value) => () => {
    const el = $(sel);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // Toggle a checkbox
  const toggleCheck = (sel) => () => {
    const el = $(sel);
    if (!el) return;
    el.checked = !el.checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // --- Model ---
  add('Model', 'Load GLTF / GLB',     click('#btn-load'),         '⎌ open');
  add('Model', 'Load Spec JSON',      click('#btn-load-spec'),    '⎌ open');
  add('Model', 'Paste Spec',          click('#btn-paste-spec'),   '⌘V');
  add('Model', 'Open Spec Editor',    click('#btn-open-editor'));
  add('Model', 'Build current spec',  click('#btn-build'),        '⏎');
  add('Model', 'Export GLTF',         click('#btn-export'),       '⌘E');
  add('Model', 'Save Spec',           click('#btn-save-spec'));
  add('Model', 'Flip Normals',        click('#btn-flip-normals'));

  // --- View ---
  add('View', 'Fit to View',          click('#btn-fit'),          'F');
  add('View', 'Screenshot',           click('#btn-screenshot'),   '⌘S');
  add('View', 'Toggle Wireframe',     toggleCheck('#cam-wireframe'));
  add('View', 'Toggle Grid',          toggleCheck('#cam-design-grid'));
  add('View', 'Toggle Auto-Rotate',   toggleCheck('#cam-autorotate'));
  add('View', 'Camera: Orbit',        setSelect('#camera-mode', 'orbit'));
  add('View', 'Camera: First-Person', setSelect('#camera-mode', 'firstPerson'));

  // Camera presets — pull live from #camera-select
  $$('#camera-select option').forEach(opt => {
    const v = opt.value || opt.textContent.trim();
    if (!v) return;
    add('View', `View: ${labelize(opt.textContent || v)}`, setSelect('#camera-select', v));
  });

  // --- Quality ---
  ['draft', 'standard', 'high'].forEach(q => {
    add('Quality', `Quality: ${labelize(q)}`, setSelect('#quality-tier', q));
  });

  // --- Specs (built-in) ---
  $$('#spec-select option').forEach(opt => {
    const v = opt.value || opt.textContent.trim();
    if (!v || v.startsWith('Built-in')) return;
    add('Specs', `Build: ${opt.textContent}`, () => {
      setSelect('#spec-select', v)();
      // small delay so the spec-change handler runs first
      setTimeout(() => $('#btn-build')?.click(), 30);
    });
  });

  // --- Lighting presets ---
  $$('#lighting-select option').forEach(opt => {
    const v = opt.value || opt.textContent.trim();
    if (!v) return;
    add('Lighting', `Lighting: ${opt.textContent}`, setSelect('#lighting-select', v));
  });

  // --- Panels (open any collapsed section) ---
  $$('#panel section').forEach(sec => {
    const h = sec.querySelector('h2');
    if (!h) return;
    const name = h.textContent.trim();
    add('Panels', `Open panel: ${labelize(name)}`, () => {
      sec.classList.remove('collapsed');
      sec.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      h.classList.add('flash');
      setTimeout(() => h.classList.remove('flash'), 700);
    });
  });

  // --- System ---
  add('System', 'Show Keyboard Shortcuts', () => {
    document.dispatchEvent(new CustomEvent('kbd:open'));
  }, '?');
  add('System', 'Toggle HUD / FOCUS mode', () => {
    document.dispatchEvent(new CustomEvent('hud:toggle'));
  }, '`');

  return out;
}

function labelize(s) {
  return String(s)
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* ---------- rendering ---------- */

function render(scrollOnly = false) {
  const q = input.value.trim().toLowerCase();
  filtered = q
    ? commands.filter(c => fuzzyMatch(c, q))
    : commands.slice();

  if (cursor >= filtered.length) cursor = Math.max(0, filtered.length - 1);

  if (!filtered.length) {
    results.innerHTML = `<div class="cmdk-empty">No commands match “${escape(q)}”.</div>`;
    return;
  }

  // Group by category
  const byCat = new Map();
  filtered.forEach((c, i) => {
    if (!byCat.has(c.cat)) byCat.set(c.cat, []);
    byCat.get(c.cat).push({ ...c, idx: i });
  });

  let html = '';
  byCat.forEach((items, cat) => {
    html += `<div class="cmdk-group-head">${cat}</div>`;
    items.forEach(c => {
      const active = c.idx === cursor;
      const sub = c.cat;
      html += `
        <div class="cmdk-item${active ? ' active' : ''}" data-idx="${c.idx}">
          <span class="ci-icon">${iconFor(c.cat)}</span>
          <span class="ci-main">
            <span class="ci-title">${highlight(c.label, q)}</span>
            <span class="ci-sub">${escape(sub)}</span>
          </span>
          ${c.hint ? `<span class="ci-kbd">${escape(c.hint)}</span>` : ''}
        </div>`;
    });
  });
  results.innerHTML = html;

  // Wire row clicks
  $$('.cmdk-item', results).forEach(row => {
    row.addEventListener('mouseenter', () => {
      cursor = Number(row.dataset.idx);
      $$('.cmdk-item.active', results).forEach(r => r.classList.remove('active'));
      row.classList.add('active');
    });
    row.addEventListener('click', () => {
      cursor = Number(row.dataset.idx);
      runCurrent();
    });
  });

  if (scrollOnly) {
    const active = $('.cmdk-row.active', results);
    active?.scrollIntoView?.({ block: 'nearest' });
  }
}

function fuzzyMatch(c, q) {
  const hay = (c.cat + ' ' + c.label).toLowerCase();
  // simple subsequence match
  let i = 0;
  for (const ch of q) {
    i = hay.indexOf(ch, i);
    if (i === -1) return false;
    i++;
  }
  return true;
}

function highlight(label, q) {
  if (!q) return escape(label);
  const lower = label.toLowerCase();
  let out = '';
  let i = 0;
  for (const ch of label) {
    const isMatch = q.indexOf(lower[i]) !== -1;
    out += isMatch ? `<b>${escape(ch)}</b>` : escape(ch);
    i++;
  }
  return out;
}

function iconFor(cat) {
  // simple monoline glyph per category
  const ICONS = {
    Model:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>',
    View:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    Quality:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    Specs:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
    Lighting: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3a7 7 0 00-4-12z"/></svg>',
    Panels:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    System:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01A1.65 1.65 0 009 3.09V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  };
  return ICONS[cat] || ICONS.System;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
