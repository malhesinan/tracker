/* ============================================================================
   STORE
   ----------------------------------------------------------------------------
   Single source of truth. Screens read from here, call a mutation, and
   re-render on the change event. All persistence is delegated to storage.js.
   ========================================================================== */

import { storage } from './storage.js';
import { BUILTIN_EXERCISES } from './data/exercises.js';
import { SEED_BUILDERS } from './data/seed.js';
import { uid, clone } from './util.js';
import { plannedSetCount, defaultSetValues, setHasValue, setVolume, estimated1RM } from './prescription.js';
import { APP } from './config.js';

const listeners = new Set();

const state = {
  programs: [],
  customExercises: [],   // custom exercises + edited copies of built-ins
  sessions: [],
  settings: {},
  meta: {},
  exerciseIndex: new Map()
};

/* ---------------------------------------------------------------- lifecycle */
export function initStore() {
  state.programs = storage.loadPrograms();
  state.customExercises = storage.loadExercises();
  state.sessions = storage.loadSessions();
  state.settings = storage.loadSettings();
  state.meta = storage.loadMeta();

  if (!state.meta.schemaVersion) {
    state.meta = { schemaVersion: APP.schemaVersion, createdAt: Date.now(), seeded: [] };
  }
  applySeeds();
  if (state.settings.firstRun) {
    state.settings.firstRun = false;
    storage.saveSettings(state.settings);
  }
  rebuildExerciseIndex();
  return state;
}

/**
 * Add any built-in programme that has never been seeded on this device.
 * Each carries a stable seedId recorded in meta.seeded, so a programme you
 * delete stays deleted rather than reappearing on the next launch.
 */
function applySeeds() {
  const seeded = Array.isArray(state.meta.seeded) ? state.meta.seeded : [];
  let added = 0;

  SEED_BUILDERS.forEach(({ seedId, build }) => {
    if (seeded.includes(seedId)) return;
    if (state.programs.some((p) => p.seedId === seedId)) { seeded.push(seedId); return; }
    const program = build();
    // The first programme on a blank device becomes the active one.
    if (!state.programs.some((p) => p.status === 'active')) program.status = 'active';
    else if (program.status === 'active') program.status = 'draft';
    state.programs.push(program);
    seeded.push(seedId);
    added += 1;
  });

  state.meta = { ...state.meta, schemaVersion: APP.schemaVersion, seeded };
  storage.saveMeta(state.meta);
  if (added) storage.savePrograms(state.programs);
}

export function reloadFromStorage() {
  state.programs = storage.loadPrograms();
  state.customExercises = storage.loadExercises();
  state.sessions = storage.loadSessions();
  state.settings = storage.loadSettings();
  state.meta = storage.loadMeta();
  rebuildExerciseIndex();
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  listeners.forEach((fn) => fn(state));
}

export const getState = () => state;
export const getSettings = () => state.settings;

export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  storage.saveSettings(state.settings);
  emit();
}

/* --------------------------------------------------------- exercise library */
function rebuildExerciseIndex() {
  const map = new Map();
  BUILTIN_EXERCISES.forEach((e) => map.set(e.id, e));
  state.customExercises.forEach((e) => map.set(e.id, { ...map.get(e.id), ...e }));
  state.exerciseIndex = map;
}

export function allExercises() {
  return Array.from(state.exerciseIndex.values())
    .filter((e) => !e.deleted)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getExercise(id) {
  return state.exerciseIndex.get(id) || {
    id,
    name: 'Unknown exercise',
    aliases: [],
    category: 'Other',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: '—',
    movementPattern: '',
    loadType: 'weight',
    prescriptionTypes: ['reps'],
    image: { url: null, source: null, attribution: null, license: null },
    description: '',
    coachingCues: [],
    missing: true
  };
}

export function saveExercise(exercise) {
  const existing = state.customExercises.findIndex((e) => e.id === exercise.id);
  const record = { ...exercise, builtin: false, updatedAt: Date.now() };
  if (existing >= 0) state.customExercises[existing] = record;
  else state.customExercises.push(record);
  storage.saveExercises(state.customExercises);
  rebuildExerciseIndex();
  emit();
  return record;
}

export function createExercise(fields) {
  const base = {
    id: uid('ex'),
    name: 'New exercise',
    aliases: [],
    category: 'Chest',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: 'Other',
    movementPattern: '',
    loadType: 'weight',
    prescriptionTypes: ['reps'],
    image: { url: null, source: null, attribution: null, license: null },
    description: '',
    coachingCues: [],
    source: 'custom',
    builtin: false,
    createdAt: Date.now()
  };
  return saveExercise({ ...base, ...fields });
}

export function deleteCustomExercise(id) {
  const ex = getExercise(id);
  if (ex.builtin) {
    // Built-ins are never removed; the edit layer is dropped instead.
    state.customExercises = state.customExercises.filter((e) => e.id !== id);
  } else {
    state.customExercises = state.customExercises.filter((e) => e.id !== id);
  }
  storage.saveExercises(state.customExercises);
  rebuildExerciseIndex();
  emit();
}

/** Search across name, aliases, category, equipment and muscles. */
export function searchExercises(query, category) {
  const q = String(query || '').trim().toLowerCase();
  let list = allExercises();
  if (category) list = list.filter((e) => e.category === category);
  if (!q) return list;

  const score = (e) => {
    const name = e.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    if ((e.aliases || []).some((a) => a.toLowerCase().includes(q))) return 3;
    if (e.equipment && e.equipment.toLowerCase().includes(q)) return 4;
    if (e.category.toLowerCase().includes(q)) return 5;
    if ([...(e.primaryMuscles || []), ...(e.secondaryMuscles || [])].some((m) => m.toLowerCase().includes(q))) return 6;
    if ((e.movementPattern || '').toLowerCase().includes(q)) return 7;
    return 99;
  };
  return list.map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.e.name.localeCompare(b.e.name))
    .map((x) => x.e);
}

/** Most recently used exercises, newest first. */
export function recentExerciseIds(limit = 6) {
  const seen = [];
  const sessions = [...state.sessions].sort((a, b) => b.startedAt - a.startedAt);
  for (const s of sessions) {
    for (const log of s.logs || []) {
      if (!seen.includes(log.exerciseId)) seen.push(log.exerciseId);
      if (seen.length >= limit) return seen;
    }
  }
  return seen;
}

/* ------------------------------------------------------------------ programs */
export const getPrograms = () => state.programs;
export const getProgram = (id) => state.programs.find((p) => p.id === id) || null;
export const getActiveProgram = () => state.programs.find((p) => p.status === 'active') || null;

function persistPrograms() {
  storage.savePrograms(state.programs);
  emit();
}

function touch(program) {
  program.updatedAt = Date.now();
  program.version = (program.version || 1) + 1;
}

export function createProgram(name) {
  const now = Date.now();
  const program = {
    id: uid('prog'),
    name: name || 'New Programme',
    description: '',
    status: state.programs.some((p) => p.status === 'active') ? 'draft' : 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
    days: []
  };
  state.programs.push(program);
  persistPrograms();
  return program;
}

export function updateProgram(id, patch) {
  const p = getProgram(id);
  if (!p) return null;
  Object.assign(p, patch);
  touch(p);
  persistPrograms();
  return p;
}

export function duplicateProgram(id) {
  const p = getProgram(id);
  if (!p) return null;
  const copy = clone(p);
  copy.id = uid('prog');
  copy.name = `${p.name} copy`;
  copy.status = 'draft';
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.version = 1;
  copy.days.forEach((d) => {
    d.id = uid('day');
    d.exercises.forEach((rx) => { rx.id = uid('rx'); });
  });
  state.programs.push(copy);
  persistPrograms();
  return copy;
}

export function activateProgram(id) {
  state.programs.forEach((p) => {
    if (p.id === id) p.status = 'active';
    else if (p.status === 'active') p.status = 'draft';
  });
  persistPrograms();
}

export function archiveProgram(id) {
  const p = getProgram(id);
  if (!p) return;
  p.status = p.status === 'archived' ? 'draft' : 'archived';
  persistPrograms();
}

export function deleteProgram(id) {
  storage.makeBackup('before-delete-program');
  state.programs = state.programs.filter((p) => p.id !== id);
  persistPrograms();
}

/* ----------------------------------------------------------------- days */
export function getDay(programId, dayId) {
  const p = getProgram(programId);
  if (!p) return null;
  return p.days.find((d) => d.id === dayId) || null;
}

export function addDay(programId, fields = {}) {
  const p = getProgram(programId);
  if (!p) return null;
  const day = {
    id: uid('day'),
    name: fields.name || 'New Day',
    subtitle: fields.subtitle || '',
    dayOfWeek: fields.dayOfWeek === undefined ? null : fields.dayOfWeek,
    enabled: true,
    estMinutes: fields.estMinutes || 60,
    notes: fields.notes || '',
    exercises: []
  };
  p.days.push(day);
  touch(p);
  persistPrograms();
  return day;
}

export function updateDay(programId, dayId, patch) {
  const d = getDay(programId, dayId);
  if (!d) return null;
  Object.assign(d, patch);
  touch(getProgram(programId));
  persistPrograms();
  return d;
}

export function deleteDay(programId, dayId) {
  const p = getProgram(programId);
  if (!p) return;
  p.days = p.days.filter((d) => d.id !== dayId);
  touch(p);
  persistPrograms();
}

export function moveDay(programId, dayId, direction) {
  const p = getProgram(programId);
  if (!p) return;
  const i = p.days.findIndex((d) => d.id === dayId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= p.days.length) return;
  [p.days[i], p.days[j]] = [p.days[j], p.days[i]];
  touch(p);
  persistPrograms();
}

/* ------------------------------------------------------- prescriptions */
export function addPrescription(programId, dayId, rx) {
  const d = getDay(programId, dayId);
  if (!d) return null;
  d.exercises.push(rx);
  touch(getProgram(programId));
  persistPrograms();
  return rx;
}

export function updatePrescription(programId, dayId, rxId, patch) {
  const d = getDay(programId, dayId);
  if (!d) return null;
  const i = d.exercises.findIndex((x) => x.id === rxId);
  if (i < 0) return null;
  d.exercises[i] = { ...d.exercises[i], ...patch, id: rxId };
  touch(getProgram(programId));
  persistPrograms();
  return d.exercises[i];
}

export function removePrescription(programId, dayId, rxId) {
  const d = getDay(programId, dayId);
  if (!d) return;
  d.exercises = d.exercises.filter((x) => x.id !== rxId);
  touch(getProgram(programId));
  persistPrograms();
}

export function movePrescription(programId, dayId, rxId, direction) {
  const d = getDay(programId, dayId);
  if (!d) return;
  const i = d.exercises.findIndex((x) => x.id === rxId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= d.exercises.length) return;
  [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]];
  touch(getProgram(programId));
  persistPrograms();
}

/* --------------------------------------------------------------- sessions */
export const getSessions = () => state.sessions;

export function getSession(id) {
  return state.sessions.find((s) => s.id === id) || null;
}

export function getActiveSession() {
  return state.sessions.find((s) => s.status === 'active') || null;
}

export function completedSessions() {
  return state.sessions.filter((s) => s.status === 'completed').sort((a, b) => b.startedAt - a.startedAt);
}

function persistSessions() {
  storage.saveSessions(state.sessions);
  emit();
}

/** Persist without notifying — used while typing into a set field. */
function persistSessionsQuiet() {
  storage.saveSessions(state.sessions);
}

/** Today's scheduled day from the active programme (null on a rest day). */
export function todaysDay(date = new Date()) {
  const program = getActiveProgram();
  if (!program) return null;
  const dow = date.getDay();
  return program.days.find((d) => d.enabled !== false && d.dayOfWeek === dow) || null;
}

/** The session logged today for a given day, if any. */
export function todaysSession(dayId) {
  const today = new Date();
  return state.sessions.find((s) => {
    const d = new Date(s.startedAt);
    return s.dayId === dayId
      && d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();
  }) || null;
}

/**
 * Start a session. The prescription is deep-copied into the session, so later
 * edits to the programme never rewrite history.
 */
export function startSession(programId, dayId) {
  const program = getProgram(programId);
  const day = getDay(programId, dayId);
  if (!program || !day) return null;

  const session = {
    id: uid('sess'),
    programId: program.id,
    programName: program.name,
    programVersion: program.version || 1,
    dayId: day.id,
    dayName: day.name,
    daySubtitle: day.subtitle || '',
    dayNotes: day.notes || '',
    startedAt: Date.now(),
    endedAt: null,
    status: 'active',
    notes: '',
    rpe: null,
    energy: null,
    logs: day.exercises.map((rx) => {
      const ex = getExercise(rx.exerciseId);
      const snapshot = clone(rx);
      return {
        id: uid('log'),
        exerciseId: rx.exerciseId,
        name: rx.displayName || ex.name,
        category: ex.category,
        equipment: rx.equipmentOverride || ex.equipment,
        prescription: snapshot,          // ← historical snapshot
        sets: buildSets(snapshot),
        notes: '',
        skipped: false
      };
    })
  };
  state.sessions.push(session);
  persistSessions();
  return session;
}

function buildSets(rx) {
  const n = plannedSetCount(rx);
  const seed = defaultSetValues(rx);
  return Array.from({ length: n }, () => ({
    id: uid('set'),
    weight: null,
    reps: seed.reps,
    timeSec: seed.timeSec,
    distance: seed.distance,
    calories: seed.calories,
    done: false,
    doneAt: null,
    prs: []
  }));
}

export function findLog(sessionId, logId) {
  const s = getSession(sessionId);
  if (!s) return null;
  return s.logs.find((l) => l.id === logId) || null;
}

/** Update one field of a set. quiet = no re-render (used while typing). */
export function updateSet(sessionId, logId, setId, patch, quiet = false) {
  const log = findLog(sessionId, logId);
  if (!log) return null;
  const set = log.sets.find((x) => x.id === setId);
  if (!set) return null;
  Object.assign(set, patch);
  if (quiet) persistSessionsQuiet();
  else persistSessions();
  return set;
}

export function toggleSetDone(sessionId, logId, setId) {
  const log = findLog(sessionId, logId);
  if (!log) return null;
  const set = log.sets.find((x) => x.id === setId);
  if (!set) return null;

  if (set.done) {
    set.done = false;
    set.doneAt = null;
    set.prs = [];
  } else {
    set.done = true;
    set.doneAt = Date.now();
    set.prs = detectPRs(log.exerciseId, set, sessionId);
  }
  persistSessions();
  return set;
}

export function addSet(sessionId, logId) {
  const log = findLog(sessionId, logId);
  if (!log) return null;
  const last = log.sets[log.sets.length - 1];
  const seed = defaultSetValues(log.prescription);
  const set = {
    id: uid('set'),
    weight: last ? last.weight : null,
    reps: last ? last.reps : seed.reps,
    timeSec: last ? last.timeSec : seed.timeSec,
    distance: last ? last.distance : seed.distance,
    calories: last ? last.calories : seed.calories,
    done: false,
    doneAt: null,
    prs: []
  };
  log.sets.push(set);
  persistSessions();
  return set;
}

export function removeSet(sessionId, logId, setId) {
  const log = findLog(sessionId, logId);
  if (!log || log.sets.length <= 1) return;
  log.sets = log.sets.filter((s) => s.id !== setId);
  persistSessions();
}

export function updateSession(sessionId, patch) {
  const s = getSession(sessionId);
  if (!s) return null;
  Object.assign(s, patch);
  persistSessions();
  return s;
}

export function updateLog(sessionId, logId, patch) {
  const log = findLog(sessionId, logId);
  if (!log) return null;
  Object.assign(log, patch);
  persistSessions();
  return log;
}

/** Copy the previous session's actual numbers into the planned fields. */
export function copyLastSession(sessionId, logId) {
  const log = findLog(sessionId, logId);
  if (!log) return 0;
  const prev = previousPerformance(log.exerciseId, sessionId);
  if (!prev || !prev.sets.length) return 0;

  let copied = 0;
  prev.sets.forEach((p, i) => {
    let target = log.sets[i];
    if (!target) {
      target = addSetSilent(log);
    }
    if (target.done) return;                    // never touch a completed set
    target.weight = p.weight;
    target.reps = p.reps;
    target.timeSec = p.timeSec;
    target.distance = p.distance;
    target.calories = p.calories;
    copied += 1;
  });
  persistSessions();
  return copied;
}

function addSetSilent(log) {
  const set = {
    id: uid('set'), weight: null, reps: null, timeSec: null,
    distance: null, calories: null, done: false, doneAt: null, prs: []
  };
  log.sets.push(set);
  return set;
}

export function finishSession(sessionId, extra = {}) {
  const s = getSession(sessionId);
  if (!s) return null;
  // Drop trailing sets that were never touched, so summaries stay honest.
  s.logs.forEach((log) => {
    const kept = log.sets.filter((set) => set.done || setHasValue(set));
    log.sets = kept.length ? kept : log.sets.slice(0, 1);
    log.completed = log.sets.some((x) => x.done);
  });
  s.status = 'completed';
  s.endedAt = Date.now();
  Object.assign(s, extra);
  persistSessions();
  return s;
}

export function discardSession(sessionId) {
  storage.makeBackup('before-discard-session');
  state.sessions = state.sessions.filter((s) => s.id !== sessionId);
  persistSessions();
}

export function deleteSession(sessionId) {
  storage.makeBackup('before-delete-session');
  state.sessions = state.sessions.filter((s) => s.id !== sessionId);
  persistSessions();
}

/** Start an unscheduled session from any day of any programme. */
export function startAdHoc(programId, dayId) {
  return startSession(programId, dayId);
}

/* -------------------------------------------------------- previous & PRs */

/** The most recent completed sets for an exercise, excluding a session id. */
export function previousPerformance(exerciseId, excludeSessionId) {
  const sessions = state.sessions
    .filter((s) => s.id !== excludeSessionId && (s.status === 'completed' || s.status === 'active'))
    .sort((a, b) => b.startedAt - a.startedAt);

  for (const s of sessions) {
    for (const log of s.logs || []) {
      if (log.exerciseId !== exerciseId) continue;
      const done = (log.sets || []).filter((x) => x.done);
      if (done.length) {
        return { sessionId: s.id, date: s.startedAt, sets: done, prescription: log.prescription };
      }
    }
  }
  return null;
}

/** Every completed set of an exercise across history, newest session first. */
export function exerciseHistory(exerciseId) {
  const out = [];
  const sessions = [...state.sessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const s of sessions) {
    for (const log of s.logs || []) {
      if (log.exerciseId !== exerciseId) continue;
      const sets = (log.sets || []).filter((x) => x.done);
      if (sets.length) {
        out.push({
          sessionId: s.id,
          sessionName: s.dayName,
          date: s.startedAt,
          sets,
          prescription: log.prescription,
          notes: log.notes
        });
      }
    }
  }
  return out;
}

/** Best-ever numbers for an exercise, optionally ignoring one session. */
export function exerciseBests(exerciseId, excludeSessionId) {
  const bests = { weight: 0, reps: 0, e1rm: 0, volume: 0, time: 0, distance: 0, repsAtWeight: new Map() };
  for (const s of state.sessions) {
    if (s.id === excludeSessionId) continue;
    if (s.status !== 'completed' && s.status !== 'active') continue;
    for (const log of s.logs || []) {
      if (log.exerciseId !== exerciseId) continue;
      let sessionVolume = 0;
      for (const set of log.sets || []) {
        if (!set.done) continue;
        const w = Number(set.weight) || 0;
        const r = Number(set.reps) || 0;
        if (w > bests.weight) bests.weight = w;
        if (r > bests.reps) bests.reps = r;
        const e = estimated1RM(set);
        if (e > bests.e1rm) bests.e1rm = e;
        if (set.timeSec > bests.time) bests.time = set.timeSec;
        if (Number(set.distance) > bests.distance) bests.distance = Number(set.distance);
        if (w > 0) {
          const prevReps = bests.repsAtWeight.get(w) || 0;
          if (r > prevReps) bests.repsAtWeight.set(w, r);
        }
        sessionVolume += setVolume(set);
      }
      if (sessionVolume > bests.volume) bests.volume = sessionVolume;
    }
  }
  return bests;
}

/**
 * PR detection for a set that has just been completed.
 * Returns an array of short labels, e.g. ['WEIGHT', 'E1RM'].
 */
export function detectPRs(exerciseId, set, currentSessionId) {
  const prs = [];
  const w = Number(set.weight) || 0;
  const r = Number(set.reps) || 0;
  const historyExists = exerciseHistory(exerciseId).length > 0;
  if (!historyExists) return prs;                   // first ever session sets the baseline

  const bests = exerciseBests(exerciseId, currentSessionId);

  if (w > 0 && w > bests.weight) prs.push('WEIGHT');
  if (w > 0 && r > 0) {
    const bestAtWeight = bests.repsAtWeight.get(w) || 0;
    if (w === bests.weight && r > bestAtWeight) prs.push('REPS');
    const e = estimated1RM(set);
    if (e > bests.e1rm * 1.001) prs.push('E1RM');
  }
  if (!w && r > 0 && r > bests.reps) prs.push('REPS');
  if (!w && set.timeSec && set.timeSec > bests.time) prs.push('TIME');
  if (set.distance && Number(set.distance) > bests.distance) prs.push('DISTANCE');

  return Array.from(new Set(prs));
}
