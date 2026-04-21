/**
 * hud.js — HUD chrome wiring
 *
 * Purely additive to main.js. Does three things:
 *   1. Forwards clicks from .qb-btn[data-forward=...] to the real
 *      control buttons inside #panel (so main.js wiring is untouched).
 *   2. Mirrors #info-tris / #info-verts / #info-objects into the
 *      bottom-center status bar using a MutationObserver (no hooks
 *      into main.js).
 *   3. Runs an rAF loop to show FPS in the status bar.
 *   4. HUD edge toggle: sets [data-hud] on #app to hide/show clusters.
 *   5. Keeps #hud-spec-name in sync with window.app.viewer.currentModel.
 */

// ── 1. Quickbar forwarders ─────────────────────────────────────────
document.querySelectorAll('.qb-btn[data-forward]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const sel = btn.getAttribute('data-forward');
    const target = document.querySelector(sel);
    if (target) target.click();
  });
});

// Cmd-K / kbd quickbar buttons dispatch the same global events those
// modules listen for.
document.getElementById('qb-cmdk')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('samdin:open-cmdk'));
});
document.getElementById('qb-kbd')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('samdin:open-kbd'));
});
document.getElementById('sb-kbd-btn')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('samdin:open-kbd'));
});

// ── 2. Mirror model stats into status bar ──────────────────────────
const mirror = (fromId, toId) => {
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);
  if (!from || !to) return;
  const sync = () => { to.textContent = from.textContent; };
  sync();
  new MutationObserver(sync).observe(from, { childList: true, characterData: true, subtree: true });
};
mirror('info-tris', 'sb-tris');
mirror('info-verts', 'sb-verts');
mirror('info-objects', 'sb-objects');

// ── 3. FPS meter ───────────────────────────────────────────────────
(function fpsLoop() {
  const fpsEl = document.getElementById('sb-fps');
  const wrap = document.getElementById('sb-fps-wrap');
  if (!fpsEl || !wrap) return;
  let frames = 0, last = performance.now();
  function tick(now) {
    frames++;
    if (now - last >= 500) {
      const fps = Math.round(frames * 1000 / (now - last));
      fpsEl.textContent = fps;
      wrap.classList.toggle('warn', fps < 45 && fps >= 24);
      wrap.classList.toggle('bad',  fps < 24);
      frames = 0; last = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ── 4. HUD edge toggle (HUD / FOCUS) ───────────────────────────────
const app = document.getElementById('app');
document.querySelectorAll('.edge-btn[data-hud-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.hudMode;
    app.dataset.hud = mode;
    document.querySelectorAll('.edge-btn').forEach(b => {
      const active = b.dataset.hudMode === mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
  });
});

// Backtick also toggles HUD visibility (Blender-ish)
window.addEventListener('keydown', (e) => {
  if (e.key === '`' && !e.target.matches('input, textarea, select')) {
    const current = app.dataset.hud || 'visible';
    const next = current === 'visible' ? 'hidden' : 'visible';
    document.querySelector(`.edge-btn[data-hud-mode="${next}"]`)?.click();
  }
});

// ── 5. Spec name in brand cluster ──────────────────────────────────
const specNameEl = document.getElementById('hud-spec-name');
if (specNameEl) {
  setInterval(() => {
    const spec = window.app?.viewer?.currentModel?.userData?.spec;
    const name = spec?.name || null;
    specNameEl.textContent = name ? name : '— no model —';
  }, 750);
}
