/* ============================================================================
   APP — bootstrap, routing and the bottom navigation.
   ========================================================================== */

import { el } from './util.js';
import { storage } from './storage.js';
import { initStore, getActiveSession, getSettings } from './store.js';
import { icon, closeAllSheets } from './ui/components.js';
import { showLock } from './ui/lock.js';
import { renderTrain } from './ui/train.js';
import { renderWorkout } from './ui/workout.js';
import { renderProgramList, renderProgramDetail, renderDayEditor, renderLibrary } from './ui/program.js';
import { renderHistory, renderSessionDetail, renderExerciseDetail } from './ui/history.js';
import { renderMore } from './ui/more.js';
import { resync } from './ui/resttimer.js';

const TABS = [
  { key: 'train', label: 'Train', icon: 'train', root: { tab: 'train', name: 'today' } },
  { key: 'program', label: 'Program', icon: 'program', root: { tab: 'program', name: 'programList' } },
  { key: 'history', label: 'History', icon: 'history', root: { tab: 'history', name: 'historyList' } },
  { key: 'more', label: 'More', icon: 'more', root: { tab: 'more', name: 'settings' } }
];

let route = { tab: 'train', name: 'today' };
let leaveHooks = [];
let viewRoot = null;
let navRoot = null;

const ctx = {
  go(next) {
    runLeaveHooks();
    closeAllSheets();
    route = next;
    render();
    window.scrollTo(0, 0);
  },
  rerender() { render(); },
  onLeave(fn) { leaveHooks.push(fn); },
  lock() {
    runLeaveHooks();
    closeAllSheets();
    showLock(() => render());
  }
};

function runLeaveHooks() {
  leaveHooks.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  leaveHooks = [];
}

/* ------------------------------------------------------------------ render */
function render() {
  if (!viewRoot) return;
  runLeaveHooks();
  viewRoot.innerHTML = '';

  switch (route.name) {
    case 'today':          renderTrain(viewRoot, ctx); break;
    case 'workout':        renderWorkout(viewRoot, ctx, route); break;
    case 'programList':    renderProgramList(viewRoot, ctx, route); break;
    case 'programDetail':  renderProgramDetail(viewRoot, ctx, route); break;
    case 'dayEditor':      renderDayEditor(viewRoot, ctx, route); break;
    case 'library':        renderLibrary(viewRoot, ctx); break;
    case 'historyList':    renderHistory(viewRoot, ctx); break;
    case 'sessionDetail':  renderSessionDetail(viewRoot, ctx, route); break;
    case 'exerciseDetail': renderExerciseDetail(viewRoot, ctx, route); break;
    case 'settings':       renderMore(viewRoot, ctx); break;
    default:               renderTrain(viewRoot, ctx);
  }
  paintNav();
}

function paintNav() {
  if (!navRoot) return;
  Array.from(navRoot.children).forEach((b) => {
    if (b.dataset.tab === route.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function buildNav() {
  navRoot = el('nav', { class: 'nav', 'aria-label': 'Primary' });
  TABS.forEach((t) => {
    const b = el('button', { type: 'button' }, [icon(t.icon), el('span', { text: t.label.toUpperCase() })]);
    b.dataset.tab = t.key;
    b.addEventListener('click', () => {
      if (t.key === 'train') {
        const live = getActiveSession();
        if (live && route.name !== 'today') {
          ctx.go({ tab: 'train', name: 'workout', sessionId: live.id });
          return;
        }
      }
      ctx.go({ ...t.root });
    });
    navRoot.appendChild(b);
  });
  document.body.appendChild(navRoot);
}

/* -------------------------------------------------------------------- boot */
function boot() {
  initStore();
  viewRoot = document.getElementById('app');
  buildNav();

  const start = () => {
    const live = getActiveSession();
    route = live ? { tab: 'train', name: 'workout', sessionId: live.id } : { tab: 'train', name: 'today' };
    render();
  };

  if (storage.getUnlock()) start();
  else showLock(start);

  /* Keep the wall-clock timer honest after the app returns from background. */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resync();
      if (route.name === 'workout') render();
    }
  });

  window.addEventListener('online', () => { /* nothing to sync yet — offline first */ });

  /* Keep the screen awake during a workout where supported. */
  let wakeLock = null;
  const requestWake = async () => {
    try {
      if (!getSettings().keepAwake) return;
      if ('wakeLock' in navigator && route.name === 'workout' && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { /* not supported */ }
  };
  document.addEventListener('visibilitychange', requestWake);
  setInterval(requestWake, 30000);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => { /* offline install optional */ });
    });
  }
}

document.addEventListener('DOMContentLoaded', boot);
