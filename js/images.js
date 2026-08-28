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
  if (!c) return { present: false, count: 0, fetchedAt: null };
  return { present: true, count: c.count || Object.keys(c.map || {}).length, fetchedAt: c.fetchedAt };
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

/**
 * Download the catalogue and build the id -> url map.
 * @param {Array} exercises  our own library
 * @param {Function} onProgress  called with ({ page, fetched })
 */
export async function syncImages(exercises, onProgress) {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const remote = [];
    for (let page = 0; page < IMAGE_SOURCE.maxPages; page += 1) {
      const url = `${IMAGE_SOURCE.endpoint}?limit=${IMAGE_SOURCE.pageSize}&offset=${page * IMAGE_SOURCE.pageSize}`;
      let payload;
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        payload = await res.json();
      } catch (err) {
        if (page === 0) throw err;      // nothing downloaded at all — report it
        break;                          // partial catalogue is still useful
      }
      const list = extractList(payload);
      if (!list.length) break;
      remote.push(...list);
      if (onProgress) onProgress({ page: page + 1, fetched: remote.length });
      if (list.length < IMAGE_SOURCE.pageSize) break;
    }

    if (!remote.length) throw new Error('The image service returned no exercises.');

    /* Index the remote catalogue by normalised name. */
    const byName = new Map();
    const byToken = [];
    remote.forEach((r) => {
      const url = mediaUrl(r);
      if (!url || !r.name) return;
      const key = norm(r.name);
      if (!byName.has(key)) byName.set(key, url);
      byToken.push({ set: new Set(tokens(r.name)), url });
    });

    /* Match our library against it. */
    const map = {};
    exercises.forEach((ex) => {
      const candidates = [ex.name, ...(ex.aliases || [])];

      for (const c of candidates) {
        const hit = byName.get(norm(c));
        if (hit) { map[ex.id] = hit; return; }
      }

      /* Fuzzy pass: best token overlap, needs a clear majority to count. */
      const mine = new Set(tokens(ex.name));
      if (!mine.size) return;
      let best = null;
      let bestScore = 0;
      for (const cand of byToken) {
        let shared = 0;
        mine.forEach((t) => { if (cand.set.has(t)) shared += 1; });
        if (!shared) continue;
        const score = (2 * shared) / (mine.size + cand.set.size);
        if (score > bestScore) { bestScore = score; best = cand.url; }
      }
      if (best && bestScore >= 0.8) map[ex.id] = best;
    });

    cache = {
      fetchedAt: Date.now(),
      source: IMAGE_SOURCE.name,
      count: Object.keys(map).length,
      remoteCount: remote.length,
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
