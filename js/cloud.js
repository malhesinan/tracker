/* ============================================================================
   CLOUD — sign-in and two-way sync with Supabase.
   ----------------------------------------------------------------------------
   The device stays the source of truth while offline: every screen keeps
   reading and writing localStorage through storage.js. This module copies
   changes up to the `records` table and brings other devices' changes down.

   Each programme, custom exercise and session is one row holding the record
   as JSON; the settings live in one 'profile' row. For every record we keep
   the hash of the version last agreed with the server. A record whose hash
   has moved since is "dirty": it is pushed, and a remote change to it is
   ignored until then (the device you are holding wins).

   Plain fetch against Supabase's REST endpoints — no SDK, no build step.
   ========================================================================== */

import { CLOUD } from './config.js';
import { storage, onStorageChange } from './storage.js';
import { reloadFromStorage } from './store.js';

const KINDS = ['program', 'exercise', 'session', 'profile'];
const PROFILE_ID = 'main';
const PAGE = 1000;
const PUSH_BATCH = 200;
const PULL_OVERLAP_MS = 60000;   // re-read a minute back so no commit is missed

export const cloudConfigured = () => Boolean(CLOUD.url && CLOUD.anonKey);

/* ------------------------------------------------------------------ status */
const status = { syncing: false, lastSyncAt: null, error: null };
const listeners = new Set();

export function cloudStatus() {
  const auth = storage.loadAuth();
  const sync = storage.loadSyncState();
  return {
    configured: cloudConfigured(),
    signedIn: Boolean(auth),
    email: auth ? auth.email : null,
    syncing: status.syncing,
    lastSyncAt: status.lastSyncAt || (sync && sync.lastSyncAt) || null,
    error: status.error
  };
}

export function onCloudStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(patch) {
  Object.assign(status, patch);
  const snapshot = cloudStatus();
  listeners.forEach((fn) => { try { fn(snapshot); } catch (e) { /* ignore */ } });
}

/* ---------------------------------------------------------------- hashing */
/** JSON with sorted keys, so the same record always hashes the same. */
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** cyrb53 — small, fast, good enough to spot a changed record. */
function hash(value) {
  const str = canonical(value);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* ------------------------------------------------------------- local data */
function profileFromLocal() {
  const settings = { ...storage.loadSettings() };
  CLOUD.deviceOnlySettings.forEach((k) => { delete settings[k]; });
  const seeded = (storage.loadMeta().seeded || []).slice().sort();
  return { settings, seeded };
}

/** Everything that syncs, as kind → Map(id → record). */
function localSnapshot() {
  const byId = (list) => new Map((list || []).filter((x) => x && x.id).map((x) => [x.id, x]));
  return {
    program: byId(storage.loadPrograms()),
    exercise: byId(storage.loadExercises()),
    session: byId(storage.loadSessions()),
    profile: new Map([[PROFILE_ID, profileFromLocal()]])
  };
}

/** Write a snapshot back to storage without triggering another sync. */
function writeSnapshot(snap) {
  storage.quietly(() => {
    storage.savePrograms(Array.from(snap.program.values()));
    storage.saveExercises(Array.from(snap.exercise.values()));
    storage.saveSessions(Array.from(snap.session.values()));

    const profile = snap.profile.get(PROFILE_ID);
    if (profile) {
      const current = storage.loadSettings();
      const keep = {};
      CLOUD.deviceOnlySettings.forEach((k) => { if (k in current) keep[k] = current[k]; });
      storage.saveSettings({ ...current, ...(profile.settings || {}), ...keep });
      const meta = storage.loadMeta();
      const seeded = new Set([...(meta.seeded || []), ...(profile.seeded || [])]);
      storage.saveMeta({ ...meta, seeded: Array.from(seeded) });
    }
  });
}

const keyOf = (kind, id) => `${kind}:${id}`;

/* ------------------------------------------------------------------- auth */
class CloudError extends Error {
  constructor(message, httpStatus) { super(message); this.httpStatus = httpStatus; }
}

async function authRequest(path, body, accessToken) {
  const headers = { apikey: CLOUD.anonKey, 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${CLOUD.url}/auth/v1/${path}`, {
    method: 'POST', headers, body: JSON.stringify(body || {})
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CloudError(json.error_description || json.msg || json.message || `Sign-in failed (${res.status})`, res.status);
  }
  return json;
}

function saveTokens(json) {
  const auth = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    userId: json.user && json.user.id,
    email: json.user && json.user.email
  };
  storage.saveAuth(auth);
  return auth;
}

export async function signIn(email, password) {
  if (!cloudConfigured()) throw new CloudError('Cloud sync is not configured.');
  const previous = storage.loadAuth();
  const json = await authRequest('token?grant_type=password', { email, password });
  const auth = saveTokens(json);
  // A different account must not inherit this device's sync bookkeeping.
  const sync = storage.loadSyncState();
  if (!sync || sync.userId !== auth.userId || (previous && previous.userId !== auth.userId)) {
    storage.saveSyncState(null);
  }
  setStatus({ error: null });
  return syncNow();
}

/** Sign out. Data on this device is kept; it just stops syncing. */
export async function signOut() {
  const auth = storage.loadAuth();
  storage.saveAuth(null);
  storage.saveSyncState(null);
  setStatus({ error: null, lastSyncAt: null });
  if (auth && navigator.onLine) {
    try { await authRequest('logout', {}, auth.accessToken); } catch (e) { /* token already gone */ }
  }
}

async function validAuth() {
  let auth = storage.loadAuth();
  if (!auth) throw new CloudError('Not signed in.');
  if (Date.now() > auth.expiresAt - 60000) {
    try {
      auth = saveTokens(await authRequest('token?grant_type=refresh_token', { refresh_token: auth.refreshToken }));
    } catch (e) {
      if (e.httpStatus === 400 || e.httpStatus === 401) {
        storage.saveAuth(null);
        throw new CloudError('Signed out — please sign in again.', 401);
      }
      throw e;
    }
  }
  return auth;
}

/* --------------------------------------------------------------- REST api */
async function rest(method, query, body, extraHeaders = {}) {
  const auth = await validAuth();
  const res = await fetch(`${CLOUD.url}/rest/v1/${CLOUD.table}?${query}`, {
    method,
    headers: {
      apikey: CLOUD.anonKey,
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) storage.saveAuth({ ...auth, expiresAt: 0 });  // refresh next time
    throw new CloudError(json.message || `Cloud request failed (${res.status})`, res.status);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

/** Rows changed since `since` (ISO string) — or every row when since is null. */
async function fetchRows(since) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = `select=kind,id,data,deleted,updated_at&order=updated_at.asc,kind.asc,id.asc&limit=${PAGE}&offset=${offset}`;
    if (since) q += `&updated_at=gt.${encodeURIComponent(since)}`;
    const page = await rest('GET', q);
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function upsertRows(rows) {
  for (let i = 0; i < rows.length; i += PUSH_BATCH) {
    await rest('POST', 'on_conflict=user_id,kind,id', rows.slice(i, i + PUSH_BATCH), {
      Prefer: 'resolution=merge-duplicates,return=minimal'
    });
  }
}

const latest = (rows, fallback) => rows.reduce((max, r) => (!max || r.updated_at > max ? r.updated_at : max), fallback);

/* ------------------------------------------------------------------- sync */
/**
 * The first sync on a device decides how local and cloud data meet:
 *  - empty cloud      → upload everything on this device
 *  - fresh device     → take the cloud copy as is
 *  - both have data   → keep both; where the same record differs, this device wins
 */
async function firstSync(auth) {
  const rows = await fetchRows(null);
  const live = rows.filter((r) => !r.deleted && r.kind !== 'profile');
  const local = localSnapshot();
  const synced = {};

  const freshDevice = local.session.size === 0 && local.exercise.size === 0;

  if (live.length && freshDevice) {
    KINDS.forEach((k) => { if (k !== 'profile') local[k].clear(); });
  }

  if (live.length) {
    const remoteSeeds = new Set(rows.filter((r) => r.kind === 'program' && !r.deleted && r.data && r.data.seedId)
      .map((r) => r.data.seedId));
    const usedPrograms = new Set(Array.from(local.session.values()).map((s) => s.programId));
    // A seed programme this device created on its own duplicates the cloud's copy.
    Array.from(local.program.values()).forEach((p) => {
      if (p.seedId && remoteSeeds.has(p.seedId) && !rows.some((r) => r.kind === 'program' && r.id === p.id)
        && !usedPrograms.has(p.id)) {
        local.program.delete(p.id);
      }
    });

    rows.forEach((r) => {
      if (!KINDS.includes(r.kind)) return;
      if (r.deleted) return;   // never drop local data on a first sync
      const mine = local[r.kind].get(r.id);
      if (!mine || freshDevice || r.kind === 'profile') {
        if (r.kind === 'profile') {
          const profile = profileFromLocal();
          const merged = {
            settings: freshDevice ? { ...profile.settings, ...(r.data.settings || {}) } : profile.settings,
            seeded: Array.from(new Set([...(profile.seeded || []), ...((r.data && r.data.seeded) || [])])).sort()
          };
          local.profile.set(PROFILE_ID, merged);
          synced[keyOf(r.kind, r.id)] = hash(r.data);
        } else {
          local[r.kind].set(r.id, r.data);
          synced[keyOf(r.kind, r.id)] = hash(r.data);
        }
      } else if (hash(mine) === hash(r.data)) {
        synced[keyOf(r.kind, r.id)] = hash(r.data);
      }
      // otherwise left unsynced → this device's version is pushed below
    });
    writeSnapshot(local);
  }

  storage.saveSyncState({ userId: auth.userId, synced, lastPull: latest(rows, null), lastSyncAt: null });
  return Boolean(live.length);
}

/** Bring down rows changed elsewhere. Returns true if local data changed. */
async function pull(sync) {
  const since = sync.lastPull ? new Date(new Date(sync.lastPull).getTime() - PULL_OVERLAP_MS).toISOString() : null;
  const rows = await fetchRows(since);
  if (!rows.length) return false;

  const local = localSnapshot();
  let changed = false;

  rows.forEach((r) => {
    if (!KINDS.includes(r.kind)) return;
    const key = keyOf(r.kind, r.id);
    const mine = local[r.kind].get(r.id);
    const mineHash = mine ? hash(mine) : null;
    const dirty = mineHash !== (sync.synced[key] || null);

    if (r.deleted) {
      if (!dirty && mine) { local[r.kind].delete(r.id); changed = true; }
      if (!dirty || !mine) delete sync.synced[key];
      return;
    }
    const remoteHash = hash(r.data);
    if (mineHash === remoteHash) { sync.synced[key] = remoteHash; return; }
    if (dirty) return;                      // local edit pending — it wins
    if (r.kind === 'profile') {
      local.profile.set(PROFILE_ID, r.data);
    } else {
      local[r.kind].set(r.id, r.data);
    }
    sync.synced[key] = remoteHash;
    changed = true;
  });

  sync.lastPull = latest(rows, sync.lastPull);
  // A merged profile (device-only settings, seeds) that ends up differing from
  // the remote one simply reads as dirty and is pushed straight after.
  if (changed) writeSnapshot(local);
  return changed;
}

/** Send up every record that changed or disappeared since it last synced. */
async function push(auth, sync) {
  const local = localSnapshot();
  const rows = [];
  const hashes = {};

  KINDS.forEach((kind) => {
    local[kind].forEach((record, id) => {
      const key = keyOf(kind, id);
      const h = hash(record);
      if (sync.synced[key] !== h) {
        rows.push({ user_id: auth.userId, kind, id, data: record, deleted: false });
        hashes[key] = h;
      }
    });
  });
  Object.keys(sync.synced).forEach((key) => {
    const i = key.indexOf(':');
    const kind = key.slice(0, i);
    const id = key.slice(i + 1);
    if (kind === 'profile' || !local[kind] || local[kind].has(id)) return;
    rows.push({ user_id: auth.userId, kind, id, data: null, deleted: true });
    hashes[key] = null;
  });

  if (!rows.length) return 0;
  await upsertRows(rows);
  Object.entries(hashes).forEach(([key, h]) => {
    if (h === null) delete sync.synced[key];
    else sync.synced[key] = h;
  });
  return rows.length;
}

/* ------------------------------------------------------------- scheduling */
let running = null;
let again = false;
let timer = null;
let canApplyRemote = () => true;
let onRemoteData = () => {};

/**
 * Pull then push. Only one sync runs at a time; a request during a sync
 * queues exactly one more. Resolves to { pushed, pulled } or rejects.
 */
export function syncNow() {
  if (running) { again = true; return running; }
  running = (async () => {
    let result = { pushed: 0, pulled: false };
    try {
      if (!cloudConfigured() || !storage.loadAuth()) return result;
      if (!navigator.onLine) { setStatus({ error: 'Offline — changes will sync when you reconnect.' }); return result; }
      setStatus({ syncing: true, error: null });

      const auth = await validAuth();
      let sync = storage.loadSyncState();
      if (!sync || sync.userId !== auth.userId) {
        result.pulled = await firstSync(auth);
        sync = storage.loadSyncState();
      } else if (canApplyRemote()) {
        result.pulled = await pull(sync);
      }
      result.pushed = await push(auth, sync);
      sync.lastSyncAt = Date.now();
      storage.saveSyncState(sync);
      setStatus({ syncing: false, lastSyncAt: sync.lastSyncAt, error: null });
      if (result.pulled) { reloadFromStorage(); onRemoteData(); }
      return result;
    } catch (e) {
      console.warn('[cloud] sync failed', e);
      setStatus({ syncing: false, error: e.message || 'Sync failed' });
      throw e;
    } finally {
      running = null;
      if (again) { again = false; scheduleSync(0); }
    }
  })();
  return running;
}

export function scheduleSync(delay = CLOUD.syncDelayMs) {
  if (!cloudConfigured() || !storage.loadAuth()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { syncNow().catch(() => { /* surfaced through status */ }); }, delay);
}

/**
 * Start listening for local changes. `canApply` tells the module whether it is
 * safe to swap in data from other devices right now (not mid-workout);
 * `onRemoteData` runs after such data has been loaded into the store.
 */
export function initCloud({ canApply, onRemoteData: onData } = {}) {
  if (canApply) canApplyRemote = canApply;
  if (onData) onRemoteData = onData;
  onStorageChange((kind) => {
    if (kind === 'reset') storage.saveSyncState(null);   // next sync reloads from the cloud
    scheduleSync();
  });
  if (!cloudConfigured()) return;
  window.addEventListener('online', () => scheduleSync(0));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(500); });
  setInterval(() => scheduleSync(0), 5 * 60 * 1000);
  scheduleSync(0);
}
