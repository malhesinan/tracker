/* ============================================================================
   EXERCISE IMAGES
   ----------------------------------------------------------------------------
   Demonstration images come from ExerciseDB's free tier, operated by AscendAPI:
   a public endpoint, no key, no sign-up. We fetch the catalogue once, match it
   against our own library by name and alias, and store only a map of

       our exercise id  ->  their media URL

   Nothing is rehosted. The URLs point at their CDN, and the service worker
   caches each image after it has been displayed once, so a workout you have
   opened before still shows its images with no signal.

   Every image carries the source and attribution recorded in IMAGE_SOURCE.
   The app is fully functional with this switched off: every image position
   falls back to a typographic placeholder.
   ========================================================================== */

import { IMAGE_SOURCE } from './config.js';
import { storage } from './storage.js';

let cache = null;      // { fetchedAt, count, map: { [exerciseId]: url } }
let inFlight = null;

/* ------------------------------------------------------------------ cache */
export function loadImageCache() {
  if (cache) return cache;
  cache = storage.loadImageCache();
  return cache;
}

export function imageCacheInfo() {
  const c = loadImageCache();
  if (!c) return { present: false, count: 0, remoteCount: 0, fetchedAt: null, unmatched: [] };
  return {
    present: true,
    count: c.count || Object.keys(c.map || {}).length,
    remoteCount: c.remoteCount || 0,
    recovered: c.recovered || 0,
    unmatched: c.unmatched || [],
    fetchedAt: c.fetchedAt
  };
}

export function clearImages() {
  cache = null;
  storage.clearImageCache();
}

/* ---------------------------------------------------------------- lookup */

/**
 * Resolve the image for an exercise, in priority order:
 *   1. a per-prescription override (programme level)
 *   2. an image saved on the exercise itself (yours, or a custom exercise)
 *   3. the downloaded ExerciseDB match
 * Returns { url, attribution, license, source } or null.
 */
export function imageFor(exercise, prescription, settings) {
  if (prescription && prescription.image && prescription.image.url) {
    return prescription.image;
  }
  if (exercise && exercise.image && exercise.image.url) {
    return exercise.image;
  }
  if (settings && settings.exerciseImages === false) return null;

  const c = loadImageCache();
  if (!c || !c.map || !exercise) return null;
  const url = c.map[exercise.id];
  if (!url) return null;
  return {
    url,
    source: IMAGE_SOURCE.endpoint,
    attribution: IMAGE_SOURCE.attribution,
    license: IMAGE_SOURCE.license
  };
}

/* ---------------------------------------------------------------- syncing */

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* Words that carry no matching signal, dropped in the fuzzy pass. */
const NOISE = new Set(['the', 'a', 'with', 'and', 'on', 'grip', 'wide', 'close', 'neutral', 'one', 'arm', 'single']);

const tokens = (s) => norm(s).split(' ').filter((w) => w && !NOISE.has(w));

/** Pull the media URL out of whatever shape the record has. */
function mediaUrl(record) {
  if (!record) return null;
  if (typeof record.gifUrl === 'string') return record.gifUrl;
  if (record.gifUrls) return record.gifUrls['360p'] || record.gifUrls['480p'] || Object.values(record.gifUrls)[0];
  if (record.imageUrls) return record.imageUrls['360p'] || record.imageUrls['480p'] || Object.values(record.imageUrls)[0];
  if (typeof record.imageUrl === 'string' && /^https?:/.test(record.imageUrl)) return record.imageUrl;
  return null;
}

/** The response envelope has changed shape before, so accept all of them. */
function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.exercises)) return payload.data.exercises;
  if (Array.isArray(payload.exercises)) return payload.exercises;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

/* Read a total count out of whatever metadata envelope came back. */
function totalFrom(payload) {
  const m = (payload && (payload.metadata || payload.meta)) || payload || {};
  const n = m.totalExercises || m.total || m.totalCount || m.count;
  return Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** A stable key for de-duplicating remote records across pages. */
const recordKey = (r) => String(r.exerciseId || r.id || r.name || '').toLowerCase();

/**
 * Pull the whole catalogue.
 *
 * The endpoint caps `limit` at a value it does not advertise, so we never
 * assume the page size we asked for is the page size we got: the first
 * response tells us the real one, and paging continues until a page comes
 * back empty or entirely made of records we have already seen. Stopping at
 * the first short page — which is what version 1.1.0 did — ends the download
 * after roughly a dozen exercises.
 */
async function fetchCatalogue(onProgress) {
  const seen = new Set();
  const remote = [];
  let pageSize = 0;
  let total = null;

  for (let page = 0; page < IMAGE_SOURCE.maxPages; page += 1) {
    const offset = page * (pageSize || IMAGE_SOURCE.pageSize);
    const url = `${IMAGE_SOURCE.endpoint}?limit=${IMAGE_SOURCE.pageSize}&offset=${offset}`;

    let payload;
    try {
      payload = await getJSON(url);
    } catch (err) {
      if (page === 0) throw err;     // nothing at all — surface it
      break;                          // partial catalogue is still worth keeping
    }

    const list = extractList(payload);
    if (!list.length) break;

    if (!pageSize) pageSize = list.length;      // the real page size, not the one we asked for
    await wait(IMAGE_SOURCE.requestSpacingMs);  // stay polite on a free endpoint
    total = total || totalFrom(payload);

    let fresh = 0;
    list.forEach((r) => {
      const key = recordKey(r);
      if (!key || seen.has(key)) return;
      seen.add(key);
      remote.push(r);
      fresh += 1;
    });

    if (onProgress) onProgress({ page: page + 1, fetched: remote.length });

    if (!fresh) break;                          // the endpoint is repeating itself
    if (total && remote.length >= total) break;
  }

  return remote;
}

/**
 * Ask the endpoint directly for one exercise. Used only for names the bulk
 * catalogue did not cover. Several query parameter names are in circulation,
 * so we try them in turn and stop at the first that answers.
 */
let searchParam = null;        // learned on the first successful search
let searchSupported = true;    // switched off after repeated empty answers

async function searchRemote(name) {
  if (!searchSupported) return [];
  const params = searchParam ? [searchParam] : ['search', 'q', 'name'];
  for (const key of params) {
    try {
      const payload = await getJSON(`${IMAGE_SOURCE.endpoint}?${key}=${encodeURIComponent(name)}&limit=5`);
      const list = extractList(payload);
      if (list.length) { searchParam = key; return list; }
    } catch (e) { /* try the next parameter name */ }
  }
  return [];
}

/**
 * Download the catalogue and build the id -> url map.
 * @param {Array} exercises  our own library
 * @param {Function} onProgress  called with ({ page, fetched })
 */
export async function syncImages(exercises, onProgress) {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const remote = await fetchCatalogue(onProgress);
    if (!remote.length) throw new Error('The image service returned no exercises.');

    /* Index the remote catalogue by normalised name. */
    const byName = new Map();
    const byToken = [];
    const addRecord = (r) => {
      const url = mediaUrl(r);
      if (!url || !r.name) return;
      const key = norm(r.name);
      if (!byName.has(key)) byName.set(key, url);
      byToken.push({ set: new Set(tokens(r.name)), url });
    };
    remote.forEach(addRecord);

    const match = (ex) => {
      for (const c of [ex.name, ...(ex.aliases || [])]) {
        const hit = byName.get(norm(c));
        if (hit) return hit;
      }
      /* Fuzzy: best token overlap, with at least two words in common. */
      const mine = new Set(tokens(ex.name));
      if (!mine.size) return null;
      let best = null;
      let bestScore = 0;
      let bestShared = 0;
      for (const cand of byToken) {
        let shared = 0;
        mine.forEach((t) => { if (cand.set.has(t)) shared += 1; });
        if (!shared) continue;
        const score = (2 * shared) / (mine.size + cand.set.size);
        if (score > bestScore) { bestScore = score; bestShared = shared; best = cand.url; }
      }
      const enough = bestScore >= 0.62 && (bestShared >= 2 || mine.size === 1);
      return enough ? best : null;
    };

    const map = {};
    const unmatched = [];
    exercises.forEach((ex) => {
      const hit = match(ex);
      if (hit) map[ex.id] = hit;
      else unmatched.push(ex);
    });

    /* Second pass: ask the endpoint by name for whatever is still missing.
       If the first handful of searches come back empty the endpoint does not
       support search, so we stop rather than firing a hundred dead requests. */
    let recovered = 0;
    let consecutiveEmpty = 0;
    searchParam = null;
    searchSupported = true;

    for (const ex of unmatched.slice(0, 80)) {
      if (!searchSupported) break;
      if (onProgress) onProgress({ page: null, fetched: remote.length, searching: ex.name });

      const results = await searchRemote(ex.name);
      await wait(IMAGE_SOURCE.requestSpacingMs);

      if (!results.length) {
        consecutiveEmpty += 1;
        if (consecutiveEmpty >= 5 && !searchParam) searchSupported = false;
        continue;
      }
      consecutiveEmpty = 0;
      results.forEach(addRecord);
      const hit = match(ex);
      if (hit) { map[ex.id] = hit; recovered += 1; }
    }

    const missed = exercises.filter((ex) => !map[ex.id]).map((ex) => ex.name);
    if (missed.length) console.info('[images] no match for:', missed);

    cache = {
      fetchedAt: Date.now(),
      source: IMAGE_SOURCE.name,
      count: Object.keys(map).length,
      remoteCount: remote.length,
      recovered,
      unmatched: missed,
      map
    };
    storage.saveImageCache(cache);
    return cache;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
