/* ============================================================================
   STORAGE
   ----------------------------------------------------------------------------
   Every read and write goes through this module. The UI never touches
   localStorage directly, so the adapter below can be replaced with IndexedDB
   or a cloud backend without changing a single screen.
   ========================================================================== */

import { STORAGE_KEYS, LEGACY_KEYS, DEFAULT_SETTINGS, APP } from './config.js';

/* --- adapter ------------------------------------------------------------- */
const memory = new Map();
let usingMemory = false;

function probe() {
  try {
    const k = '__wt_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}
usingMemory = !probe();

const adapter = {
  get(key) {
    if (usingMemory) return memory.has(key) ? memory.get(key) : null;
    return localStorage.getItem(key);
  },
  set(key, value) {
    if (usingMemory) { memory.set(key, value); return; }
    localStorage.setItem(key, value);
  },
  remove(key) {
    if (usingMemory) { memory.delete(key); return; }
    localStorage.removeItem(key);
  }
};

export const storageIsPersistent = () => !usingMemory;

/* --- one-time migration from the 1.0 key prefix ------------------------- */
function migrateLegacyKeys() {
  try {
    if (adapter.get(STORAGE_KEYS.meta)) return;          // already on the new keys
    let moved = 0;
    Object.keys(LEGACY_KEYS).forEach((name) => {
      const old = adapter.get(LEGACY_KEYS[name]);
      if (old !== null && old !== undefined) {
        adapter.set(STORAGE_KEYS[name], old);
        moved += 1;
      }
    });
    if (moved) console.info(`[storage] migrated ${moved} keys from the previous app name`);
  } catch (e) {
    console.warn('[storage] migration skipped', e);
  }
}
migrateLegacyKeys();

/* --- json helpers -------------------------------------------------------- */
function read(key, fallback) {
  try {
    const raw = adapter.get(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    console.warn('[storage] unreadable key, using fallback:', key, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    adapter.set(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[storage] write failed:', key, e);
    return false;
  }
}

/* --- public API ---------------------------------------------------------- */
export const storage = {
  loadPrograms()            { return read(STORAGE_KEYS.programs, []); },
  savePrograms(programs)    { return write(STORAGE_KEYS.programs, programs); },

  /** Custom + edited exercises only. Built-ins live in code. */
  loadExercises()           { return read(STORAGE_KEYS.exercises, []); },
  saveExercises(exercises)  { return write(STORAGE_KEYS.exercises, exercises); },

  loadSessions()            { return read(STORAGE_KEYS.sessions, []); },
  saveSessions(sessions)    { return write(STORAGE_KEYS.sessions, sessions); },

  loadSettings()            { return { ...DEFAULT_SETTINGS, ...read(STORAGE_KEYS.settings, {}) }; },
  saveSettings(settings)    { return write(STORAGE_KEYS.settings, settings); },

  loadMeta()                { return read(STORAGE_KEYS.meta, { schemaVersion: APP.schemaVersion, createdAt: Date.now(), seeded: [] }); },
  saveMeta(meta)            { return write(STORAGE_KEYS.meta, meta); },

  loadImageCache()          { return read(STORAGE_KEYS.imageCache, null); },
  saveImageCache(cache)     { return write(STORAGE_KEYS.imageCache, cache); },
  clearImageCache()         { adapter.remove(STORAGE_KEYS.imageCache); },

  /* Unlock state. sessionStorage by default so the passcode is asked again on
     a fresh launch; localStorage only if the user opts in. */
  getUnlock() {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.unlock) === '1'
        || adapter.get(STORAGE_KEYS.unlock) === '1';
    } catch (e) { return false; }
  },
  setUnlock(value, remember) {
    try {
      if (value) sessionStorage.setItem(STORAGE_KEYS.unlock, '1');
      else sessionStorage.removeItem(STORAGE_KEYS.unlock);
    } catch (e) { /* private mode */ }
    if (remember && value) adapter.set(STORAGE_KEYS.unlock, '1');
    if (!remember || !value) adapter.remove(STORAGE_KEYS.unlock);
  },

  /* --- safety net ------------------------------------------------------- */
  /** Snapshot everything before a destructive operation. */
  makeBackup(reason) {
    const payload = {
      reason,
      takenAt: Date.now(),
      data: storage.exportAll()
    };
    return write(STORAGE_KEYS.backup, payload);
  },
  loadBackup()  { return read(STORAGE_KEYS.backup, null); },
  clearBackup() { adapter.remove(STORAGE_KEYS.backup); },

  /* --- export / import -------------------------------------------------- */
  exportAll() {
    return {
      app: 'Workout Tracker',
      schemaVersion: APP.schemaVersion,
      exportedAt: new Date().toISOString(),
      programs: storage.loadPrograms(),
      exercises: storage.loadExercises(),
      sessions: storage.loadSessions(),
      settings: storage.loadSettings(),
      meta: storage.loadMeta()
    };
  },

  /**
   * Validate an imported payload before anything is written.
   * Returns { ok, errors[], warnings[], counts{} } — never mutates storage.
   */
  validateImport(payload) {
    const errors = [];
    const warnings = [];

    if (!payload || typeof payload !== 'object') {
      return { ok: false, errors: ['The file is not valid JSON object data.'], warnings, counts: {} };
    }
    if (payload.app && payload.app !== 'Workout Tracker' && payload.app !== 'REDLINE') {
      warnings.push(`File reports app "${payload.app}". Importing anyway.`);
    }
    const arrays = ['programs', 'exercises', 'sessions'];
    for (const key of arrays) {
      if (payload[key] !== undefined && !Array.isArray(payload[key])) {
        errors.push(`"${key}" must be a list.`);
      }
    }
    if (payload.settings !== undefined && (typeof payload.settings !== 'object' || Array.isArray(payload.settings))) {
      errors.push('"settings" must be an object.');
    }
    if (!payload.programs && !payload.sessions && !payload.exercises) {
      errors.push('Nothing to import: no programmes, sessions or exercises found.');
    }

    (payload.programs || []).forEach((p, i) => {
      if (!p.id || !p.name) errors.push(`Programme ${i + 1} is missing an id or name.`);
      if (p.days && !Array.isArray(p.days)) errors.push(`Programme "${p.name || i + 1}" has invalid days.`);
    });

    (payload.sessions || []).forEach((s, i) => {
      if (!s.id || !s.startedAt) errors.push(`Session ${i + 1} is missing an id or start time.`);
      if (s.logs && !Array.isArray(s.logs)) errors.push(`Session ${i + 1} has invalid logs.`);
    });

    if (payload.schemaVersion && payload.schemaVersion > APP.schemaVersion) {
      warnings.push('This file was exported by a newer version of the app. Some fields may be ignored.');
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      counts: {
        programs: (payload.programs || []).length,
        exercises: (payload.exercises || []).length,
        sessions: (payload.sessions || []).length
      }
    };
  },

  /** Replace everything. Caller must have validated first. Backs up automatically. */
  applyImport(payload) {
    storage.makeBackup('before-import');
    if (payload.programs) storage.savePrograms(payload.programs);
    if (payload.exercises) storage.saveExercises(payload.exercises);
    if (payload.sessions) storage.saveSessions(payload.sessions);
    if (payload.settings) storage.saveSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
    storage.saveMeta({ ...storage.loadMeta(), importedAt: Date.now(), schemaVersion: APP.schemaVersion });
    return true;
  },

  /** Merge import: keeps existing records, adds anything with a new id. */
  applyMerge(payload) {
    storage.makeBackup('before-merge');
    const mergeById = (existing, incoming) => {
      const map = new Map(existing.map((x) => [x.id, x]));
      (incoming || []).forEach((x) => { if (x && x.id && !map.has(x.id)) map.set(x.id, x); });
      return Array.from(map.values());
    };
    storage.savePrograms(mergeById(storage.loadPrograms(), payload.programs));
    storage.saveExercises(mergeById(storage.loadExercises(), payload.exercises));
    storage.saveSessions(mergeById(storage.loadSessions(), payload.sessions));
    return true;
  },

  /** Wipe everything (a backup is written first). */
  resetAll() {
    storage.makeBackup('before-reset');
    adapter.remove(STORAGE_KEYS.programs);
    adapter.remove(STORAGE_KEYS.exercises);
    adapter.remove(STORAGE_KEYS.sessions);
    adapter.remove(STORAGE_KEYS.settings);
    adapter.remove(STORAGE_KEYS.meta);
    adapter.remove(STORAGE_KEYS.imageCache);
  }
};
