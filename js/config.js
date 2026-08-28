/* ============================================================================
   CONFIG
   Single place for app-level constants. Nothing here reaches into the DOM.
   ========================================================================== */

export const APP = {
  name: 'REDLINE',
  tagline: 'Training OS',
  version: '1.0.0',
  schemaVersion: 3
};

/* The lock-screen passcode.
   NOTE: this is a privacy screen, not security. Everything runs in the browser,
   so anyone with the device and developer tools can read the data regardless.
   It stops someone picking up an unlocked phone and poking around. */
export const PASSCODE = '9977';

export const STORAGE_KEYS = {
  programs: 'redline.programs',
  exercises: 'redline.exercises',
  sessions: 'redline.sessions',
  settings: 'redline.settings',
  meta: 'redline.meta',
  backup: 'redline.backup',
  unlock: 'redline.unlock'
};

export const DEFAULT_SETTINGS = {
  units: 'kg',                 // kg | lb
  weightStep: 2.5,             // stepper increment
  repStep: 1,
  distanceUnit: 'm',           // m | km
  restAutoStart: true,
  restSound: true,
  restVibrate: true,
  keepAwake: true,
  weekStartsOn: 0,             // 0 = Sunday
  confirmDeletes: true,
  rememberUnlock: false,       // stay unlocked on this device
  firstRun: true
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
