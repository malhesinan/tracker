/* ============================================================================
   SIGN-IN SCREEN
   ----------------------------------------------------------------------------
   The gate when cloud sync is configured: email + password once per device,
   then the device stays signed in until Sign out. Replaces the passcode.
   ========================================================================== */

import { el, haptic } from '../util.js';
import { signIn } from '../cloud.js';

let node = null;

export function showSignIn(onSignedIn) {
  if (node) return;

  const email = el('input', {
    class: 'input', type: 'email', autocomplete: 'username', inputmode: 'email',
    autocapitalize: 'off', spellcheck: 'false', placeholder: 'Email', 'aria-label': 'Email'
  });
  const password = el('input', {
    class: 'input', type: 'password', autocomplete: 'current-password',
    placeholder: 'Password', 'aria-label': 'Password'
  });
  const err = el('div', { class: 'signin-err', role: 'alert' });
  const btn = el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit', text: 'SIGN IN' });

  const form = el('form', { class: 'signin-form', novalidate: true }, [email, password, btn, err]);

  node = el('div', { class: 'lock signin', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sign in' }, [
    el('div', { class: 'lock-top' }, [
      el('img', { class: 'lock-logo', src: './icons/icon-192.png', alt: '', width: '64', height: '64' }),
      el('div', { class: 'lock-mark', text: 'WORKOUT TRACKER' }),
      el('div', { class: 'lock-sub', text: 'Sign in' }),
      form,
      el('div', { class: 'signin-hint', text:
        'Once per device. Your workouts are saved on this device and backed up to your account.' })
    ])
  ]);
  document.body.appendChild(node);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const address = email.value.trim();
    if (!address) { email.focus(); return; }
    if (!password.value) { password.focus(); return; }
    if (!navigator.onLine) {
      err.textContent = 'No connection. Signing in needs the internet once — after that the app works offline.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'SIGNING IN…';
    let syncError = null;
    try {
      await signIn(address, password.value);
    } catch (e2) {
      if (!e2.signedIn) {
        err.textContent = e2.message || 'Sign-in failed';
        node.classList.add('error');
        haptic([40, 60, 40]);
        setTimeout(() => node && node.classList.remove('error'), 420);
        btn.disabled = false;
        btn.textContent = 'SIGN IN';
        return;
      }
      syncError = e2;   // signed in, but the first sync failed — it retries on its own
    }

    haptic(14);
    node.style.transition = 'opacity .25s ease';
    node.style.opacity = '0';
    setTimeout(() => {
      teardown();
      onSignedIn({ syncError });
    }, 240);
  });

  setTimeout(() => email.focus(), 300);
}

function teardown() {
  if (node) node.remove();
  node = null;
}

export const isSignInShown = () => Boolean(node);
