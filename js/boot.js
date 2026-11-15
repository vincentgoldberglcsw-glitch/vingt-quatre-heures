// The loading screen.
//
// The world is built in stages. Between stages the page is handed back to the browser for one frame, so the bar moves, the
// stage name changes and nothing looks frozen. The moving parts of the screen itself are CSS transforms, which the browser
// keeps animating on its own thread even while a stage is busy building.
const $ = id => document.getElementById(id);
const root = $('load'), bar = $('ldBar'), pct = $('ldPct'), stage = $('ldStage');
const log = []; let last = performance.now(), cur = 'ENGINE', p = 0;
const set = v => { p = Math.max(p, Math.min(1, v)); if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`; if (pct) pct.textContent = String(Math.round(p * 100)).padStart(2, '0'); };
// one frame, or 60 ms if the tab is hidden and frames are not being drawn
const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 60); });

export const BOOT = {
  log,
  async step(label, v) { const now = performance.now(); log.push([cur, Math.round(now - last)]); cur = label; last = now; if (stage) stage.textContent = label; set(v); await nextFrame(); },
  note(label) { if (stage) stage.textContent = label; },
  async finish() {
    log.push([cur, Math.round(performance.now() - last)]); set(1); if (stage) stage.textContent = 'READY'; await nextFrame();
    if (root) { root.classList.add('out'); setTimeout(() => root.remove(), 1100); }
    // keep the engine, the game and the map data for next time (and for driving with no connection)
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  },
  fail(e) { if (stage) { stage.textContent = 'COULD NOT START: ' + (e && e.message || e); stage.style.color = '#ff5a3a'; } console.error(e); },
};
addEventListener('error', e => { if (root && root.isConnected) BOOT.fail(e.error || e.message); });
addEventListener('unhandledrejection', e => { if (root && root.isConnected) BOOT.fail(e.reason); });
