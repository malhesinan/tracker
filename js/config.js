/* ============================================================================
   CONFIG
   Single place for app-level constants. Nothing here reaches into the DOM.
   ========================================================================== */

export const APP = {
  name: 'Workout Tracker',
  shortName: 'Workout',
  tagline: 'Training log',
  version: '1.1.1',
  schemaVersion: 4
};

/* The lock-screen passcode.
   NOTE: this is a privacy screen, not security. Everything runs in the browser,
   so anyone with the device and developer tools can read the data regardless.
   It stops someone picking up an unlocked phone and poking around. */
export const PASSCODE = '9977';

const PREFIX = 'wt.';

export const STORAGE_KEYS = {
  programs:   PREFIX + 'programs',
  exercises:  PREFIX + 'exercises',
  sessions:   PREFIX + 'sessions',
  settings:   PREFIX + 'settings',
  meta:       PREFIX + 'meta',
  backup:     PREFIX + 'backup',
  unlock:     PREFIX + 'unlock',
  imageCache: PREFIX + 'imagecache'
};

/* Keys used by version 1.0 (app name "REDLINE"). Migrated once, then ignored. */
export const LEGACY_KEYS = {
  programs:  'redline.programs',
  exercises: 'redline.exercises',
  sessions:  'redline.sessions',
  settings:  'redline.settings',
  meta:      'redline.meta',
  backup:    'redline.backup',
  unlock:    'redline.unlock'
};

/* ---------------------------------------------------------------------------
   Exercise images — ExerciseDB free tier, operated by AscendAPI.
   No API key, no sign-up. Images are served from their CDN and cached by the
   service worker after first view. The app works fully without any of this.
   ------------------------------------------------------------------------ */
export const IMAGE_SOURCE = {
  name: 'ExerciseDB (AscendAPI)',
  endpoint: 'https://oss.exercisedb.dev/api/v1/exercises',
  homepage: 'https://ascendapi.com',
  attribution: 'ExerciseDB by AscendAPI',
  license: 'Free tier — see ascendapi.com terms',
  pageSize: 100,
  maxPages: 60,
  requestSpacingMs: 80
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
  exerciseImages: true,        // fetch demonstration images from ExerciseDB
  firstRun: true
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
