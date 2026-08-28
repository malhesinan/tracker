/* ============================================================================
   REST TIMER
   ----------------------------------------------------------------------------
   Docks above the bottom navigation. Survives screen changes, keeps time from
   wall-clock timestamps (so it stays accurate if Safari throttles the tab) and
   never uses a browser dialog.
   ========================================================================== */

import { el, mmssPadded, haptic } from '../util.js';
import { icon } from './components.js';
import { getSettings } from '../store.js';

let dock = null;
let ui = {};
let state = {
  running: false,
  paused: false,
  totalMs: 0,
  remainingMs: 0,
  endsAt: 0,
  finished: false,
  label: ''
};
let tick = null;
let audioCtx = null;

function build() {
  ui.clock = el('div', { class: 'clock num', text: '0:00' });
  ui.label = el('div', { class: 'rest-label', text: 'REST' });
  ui.pause = el('button', { class: 'btn btn-sm', type: 'button', text: 'PAUSE' });
  ui.plus30 = el('button', { class: 'btn btn-sm', type: 'button', text: '+30' });
  ui.plus60 = el('button', { class: 'btn btn-sm', type: 'button', text: '+60' });
  ui.skip = el('button', { class: 'btn btn-sm btn-primary', type: 'button', text: 'SKIP' });
  ui.fill = el('i', { style: 'width:100%' });

  ui.pause.addEventListener('click', () => (state.paused ? resume() : pause()));
  ui.plus30.addEventListener('click', () => extend(30));
  ui.plus60.addEventListener('click', () => extend(60));
  ui.skip.addEventListener('click', () => stop());

  dock = el('div', { class: 'rest-dock', role: 'timer', 'aria-live': 'off' }, [
    el('div', { class: 'rest-top' }, [
      el('div', {}, [ui.label, ui.clock]),
      el('div', { class: 'grow' }),
      el('div', { class: 'rest-actions' }, [ui.plus30, ui.plus60, ui.pause, ui.skip])
    ]),
    el('div', { class: 'bar rest-bar' }, [ui.fill])
  ]);
  document.body.appendChild(dock);
}

function render() {
  if (!dock) return;
  const secs = state.remainingMs / 1000;
  ui.clock.textContent = mmssPadded(secs);
  ui.pause.textContent = state.paused ? 'RESUME' : 'PAUSE';
  const pct = state.totalMs ? Math.max(0, state.remainingMs / state.totalMs) * 100 : 0;
  ui.fill.style.width = `${pct}%`;
  dock.classList.toggle('done', state.finished);
  ui.label.textContent = state.finished ? 'REST COMPLETE' : (state.paused ? 'REST — PAUSED' : 'REST');
  ui.skip.textContent = state.finished ? 'DONE' : 'SKIP';
}

function loop() {
  if (!state.running || state.paused) return;
  state.remainingMs = Math.max(0, state.endsAt - Date.now());
  if (state.remainingMs <= 0 && !state.finished) finish();
  render();
}

function finish() {
  state.finished = true;
  state.running = false;
  clearInterval(tick);
  tick = null;
  const settings = getSettings();
  if (settings.restVibrate) haptic([90, 60, 90]);
  if (settings.restSound) beep();
  render();
  // The dock stays up so the finish is visible; it clears itself shortly after.
  setTimeout(() => { if (state.finished) stop(); }, 12000);
}

function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [0, 0.18].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch (e) { /* audio unavailable — vibration and the visual state still fire */ }
}

/* ------------------------------------------------------------------ API */
export function startRest(seconds, label = 'REST') {
  if (!seconds || seconds <= 0) return;
  if (!dock) build();
  state = {
    running: true,
    paused: false,
    totalMs: seconds * 1000,
    remainingMs: seconds * 1000,
    endsAt: Date.now() + seconds * 1000,
    finished: false,
    label
  };
  clearInterval(tick);
  tick = setInterval(loop, 200);
  dock.classList.add('up');
  document.body.classList.add('resting');
  render();
}

export function pause() {
  if (!state.running || state.paused) return;
  state.paused = true;
  state.remainingMs = Math.max(0, state.endsAt - Date.now());
  render();
}

export function resume() {
  if (!state.running || !state.paused) return;
  state.paused = false;
  state.endsAt = Date.now() + state.remainingMs;
  render();
}

export function extend(seconds) {
  if (!dock) return;
  if (!state.running && !state.finished) return;
  if (state.finished) {
    startRest(seconds);
    return;
  }
  state.totalMs += seconds * 1000;
  state.endsAt += seconds * 1000;
  state.remainingMs = Math.max(0, state.endsAt - Date.now());
  haptic(8);
  render();
}

export function stop() {
  clearInterval(tick);
  tick = null;
  state.running = false;
  state.finished = false;
  if (dock) {
    dock.classList.remove('up', 'done');
  }
  document.body.classList.remove('resting');
}

export const isResting = () => state.running || state.finished;

/** Re-sync after the app returns from the background. */
export function resync() {
  if (state.running && !state.paused) loop();
}
