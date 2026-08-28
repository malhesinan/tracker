/* ============================================================================
   LOCK SCREEN
   ----------------------------------------------------------------------------
   A privacy gate, not encryption: the data lives in this browser either way.
   It stops someone picking up an unlocked phone and reading the log.
   ========================================================================== */

import { el, haptic } from '../util.js';
import { PASSCODE } from '../config.js';
import { storage } from '../storage.js';
import { getSettings } from '../store.js';

let node = null;
let entered = '';
let keyHandler = null;

export function showLock(onUnlock) {
  if (node) return;
  entered = '';

  const dots = el('div', { class: 'dots' }, [0, 1, 2, 3].map(() => el('i', {})));
  const err = el('div', { class: 'lock-err', role: 'alert', text: '' });

  const top = el('div', { class: 'lock-top' }, [
    el('div', { class: 'lock-mark' }, [
      el('span', { text: 'RED' }),
      el('b', { text: 'LINE' })
    ]),
    el('div', { class: 'lock-sub', text: 'Enter passcode' }),
    dots,
    err
  ]);

  const pad = el('div', { class: 'keypad' });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((d) => pad.appendChild(keyBtn(d)));
  pad.appendChild(el('div', { class: 'key blank' }));
  pad.appendChild(keyBtn('0'));
  const del = el('button', { class: 'key fn', type: 'button', text: 'DEL', 'aria-label': 'Delete last digit' });
  del.addEventListener('click', () => { press('del'); });
  pad.appendChild(del);

  node = el('div', { class: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Passcode' }, [top, pad]);
  document.body.appendChild(node);

  function keyBtn(d) {
    const b = el('button', { class: 'key', type: 'button', text: d, 'aria-label': `Digit ${d}` });
    b.addEventListener('click', () => press(d));
    return b;
  }

  function paint() {
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('filled', i < entered.length));
  }

  function press(d) {
    if (d === 'del') {
      entered = entered.slice(0, -1);
      err.textContent = '';
      paint();
      return;
    }
    if (entered.length >= 4) return;
    entered += d;
    haptic(6);
    paint();
    if (entered.length === 4) setTimeout(check, 120);
  }

  function check() {
    if (entered === PASSCODE) {
      storage.setUnlock(true, !!getSettings().rememberUnlock);
      haptic(14);
      node.style.transition = 'opacity .25s ease';
      node.style.opacity = '0';
      setTimeout(() => {
        teardown();
        onUnlock();
      }, 240);
    } else {
      err.textContent = 'Wrong passcode';
      node.classList.add('error');
      haptic([40, 60, 40]);
      setTimeout(() => {
        node.classList.remove('error');
        entered = '';
        paint();
      }, 420);
    }
  }

  keyHandler = (e) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  window.addEventListener('keydown', keyHandler);
  paint();
}

function teardown() {
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = null;
  if (node) node.remove();
  node = null;
}

export function isLocked() {
  return !!node;
}
