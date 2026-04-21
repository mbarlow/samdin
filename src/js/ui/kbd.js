/**
 * kbd.js — keyboard shortcut overlay
 *
 * Renders a static reference of every shortcut bound in the app.
 * Listens for "?" to toggle, ESC to dismiss, and the custom
 * "kbd:open" event dispatched by cmdk.js (System: Show Shortcuts).
 *
 * Source of truth for shortcuts is the SHORTCUTS array below.
 * If you add new hotkeys in viewer.js / builder.js, mirror them here.
 */

const overlay = document.getElementById('kbd-overlay');
const grid    = document.getElementById('kbd-grid');

const SHORTCUTS = [
  {
    group: 'View',
    items: [
      ['F',           'Fit to view'],
      ['` (tilde)',   'Toggle HUD / FOCUS mode'],
      ['⌘ K / Ctrl K', 'Open command palette'],
      ['?',           'Show / hide this overlay'],
      ['Esc',         'Close palette / overlay'],
    ],
  },
  {
    group: 'Selection & Edit',
    items: [
      ['Click',       'Select part'],
      ['G',           'Move selected'],
      ['R',           'Rotate selected'],
      ['S',           'Scale selected'],
      ['X',           'Delete selected'],
      ['Shift + D',   'Duplicate selected'],
      ['Ctrl + Z',    'Undo'],
    ],
  },
  {
    group: 'Camera (Orbit)',
    items: [
      ['Drag',        'Orbit'],
      ['Shift + Drag','Pan'],
      ['Wheel',       'Zoom'],
      ['1–6',         'Camera presets'],
    ],
  },
  {
    group: 'Camera (First-Person)',
    items: [
      ['W A S D',     'Move'],
      ['Space',       'Up'],
      ['Shift',       'Down (or sprint)'],
      ['Mouse',       'Look (click to capture)'],
      ['Esc',         'Release pointer'],
    ],
  },
  {
    group: 'Capture',
    items: [
      ['Screenshot button', 'PNG of current view'],
      ['Polaroid click',    'Expand photo'],
      ['Export Photos',     'Download all as ZIP'],
    ],
  },
];

if (!overlay || !grid) {
  console.warn('[kbd] missing DOM, skipping init');
} else {
  init();
}

function init() {
  render();

  document.addEventListener('keydown', (e) => {
    // ignore when typing in an input
    const inField = e.target.matches?.('input, textarea, [contenteditable="true"]');
    if (e.key === '?' && !inField) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      e.preventDefault();
      close();
    }
  });

  document.getElementById('qb-kbd')?.addEventListener('click', toggle);
  document.getElementById('sb-kbd-btn')?.addEventListener('click', toggle);
  overlay.querySelector('.kbd-backdrop')?.addEventListener('click', close);

  // Cross-module hook from cmdk
  document.addEventListener('kbd:open', open);
}

function open()   { overlay.classList.remove('hidden'); }
function close()  { overlay.classList.add('hidden'); }
function toggle() { overlay.classList.toggle('hidden'); }

function render() {
  let html = '';
  SHORTCUTS.forEach(g => {
    html += `<div class="kbd-section"><h3>${escape(g.group)}</h3>`;
    g.items.forEach(([key, label]) => {
      html += `<div class="kbd-row">
        <span class="kbd-label">${escape(label)}</span>
        <span class="kbd-keys">${formatKey(key)}</span>
      </div>`;
    });
    html += `</div>`;
  });
  grid.innerHTML = html;
}

function formatKey(k) {
  // Split on " + " into key tokens, with the literal "+" rendered as a faded plus sign.
  // Each token may itself be "A / B" alternates.
  const tokens = String(k).split(/\s*\+\s*/);
  const parts = [];
  tokens.forEach((part, i) => {
    if (i > 0) parts.push(`<span class="k plus">+</span>`);
    const alts = part.split(/\s*\/\s*/);
    alts.forEach((alt, j) => {
      if (j > 0) parts.push(`<span class="k plus">/</span>`);
      parts.push(`<span class="k">${escape(alt.trim())}</span>`);
    });
  });
  return parts.join('');
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
