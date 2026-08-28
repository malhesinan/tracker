/* ============================================================================
   PRESCRIPTION
   ----------------------------------------------------------------------------
   Prescriptions are structured data, never display strings. The UI derives
   every label from this shape:

     {
       id, exerciseId,
       displayName: null | "Wide-Grip Lat Pulldown",
       sets:   { min: 4, max: 4 },
       target: { type: 'reps'|'time'|'distance'|'calories',
                 unit: null|'seconds'|'minutes'|'m'|'km',
                 min: 6, max: 8 },
       load:   { type: 'weight'|'bodyweight'|'assisted'|'none', unit: 'kg'|'lb' },
       restSec: 150,
       tempo: null, rpe: null,
       equipmentOverride: null, cue: null, notes: null,
       image: null | { url, source, attribution, license }
     }

   Adding a new target type means adding one entry to TARGET_TYPES plus a
   matching field descriptor in logFields(). Nothing else needs to change.
   ========================================================================== */

import { uid, num, mmss } from './util.js';

export const TARGET_TYPES = {
  reps:     { key: 'reps',     label: 'Reps',     units: [null],                short: 'REPS' },
  time:     { key: 'time',     label: 'Time',     units: ['seconds', 'minutes'], short: 'TIME' },
  distance: { key: 'distance', label: 'Distance', units: ['m', 'km'],            short: 'DIST' },
  calories: { key: 'calories', label: 'Calories', units: [null],                short: 'CAL' }
};

export const LOAD_TYPES = {
  weight:     { key: 'weight',     label: 'External weight' },
  bodyweight: { key: 'bodyweight', label: 'Bodyweight' },
  assisted:   { key: 'assisted',   label: 'Assisted (machine)' },
  none:       { key: 'none',       label: 'No load' }
};

const UNIT_SHORT = { seconds: 's', minutes: 'min', m: 'm', km: 'km' };

/* -------------------------------------------------------------------------
   Smart defaults — suggestions only, everything stays editable afterwards.
   ---------------------------------------------------------------------- */
export function smartDefaults(exercise, units = 'kg') {
  const pattern = exercise.movementPattern || '';
  const cat = exercise.category;
  const primaryTarget = (exercise.prescriptionTypes && exercise.prescriptionTypes[0]) || 'reps';

  let sets = { min: 3, max: 3 };
  let target = { type: 'reps', unit: null, min: 8, max: 10 };
  let restSec = 90;

  const compound = ['Squat', 'Hinge', 'Horizontal Push', 'Vertical Push', 'Horizontal Pull', 'Vertical Pull', 'Full Body'].includes(pattern);
  const isolation = pattern === 'Isolation';

  if (cat === 'Cardio' || pattern === 'Cardio') {
    sets = { min: 1, max: 1 };
    if (primaryTarget === 'distance') target = { type: 'distance', unit: 'm', min: 1000, max: 1000 };
    else target = { type: 'time', unit: 'minutes', min: 20, max: 20 };
    restSec = 0;
  } else if (primaryTarget === 'time') {
    sets = { min: 3, max: 3 };
    target = { type: 'time', unit: 'seconds', min: 45, max: 45 };
    restSec = 60;
  } else if (compound) {
    sets = { min: 4, max: 4 };
    target = { type: 'reps', unit: null, min: 6, max: 8 };
    restSec = 150;
  } else if (isolation) {
    sets = { min: 3, max: 3 };
    target = { type: 'reps', unit: null, min: 10, max: 15 };
    restSec = 60;
  }

  return {
    id: uid('rx'),
    exerciseId: exercise.id,
    displayName: null,
    sets,
    target,
    load: { type: exercise.loadType || 'weight', unit: units },
    restSec,
    tempo: null,
    rpe: null,
    equipmentOverride: null,
    cue: null,
    notes: null,
    image: null
  };
}

/* -------------------------------------------------------------------------
   Display
   ---------------------------------------------------------------------- */

/** "4", "2–3" */
export function setsLabel(rx) {
  const { min, max } = rx.sets;
  return min === max ? String(min) : `${min}–${max}`;
}

/** "6–8", "20 min", "250 m", "45s" */
export function targetLabel(rx) {
  const t = rx.target;
  const range = t.min === t.max ? num(t.min) : `${num(t.min)}–${num(t.max)}`;
  if (t.type === 'reps') return range;
  if (t.type === 'calories') return `${range} cal`;
  const u = UNIT_SHORT[t.unit] || '';
  return t.unit === 'seconds' ? `${range}${u}` : `${range} ${u}`;
}

/** Full human line: "4 × 6–8", "3 × 45s", "20 min", "10 × 250 m" */
export function prescriptionLabel(rx) {
  const sets = setsLabel(rx);
  const target = targetLabel(rx);
  const single = rx.sets.min === 1 && rx.sets.max === 1;
  if (single && rx.target.type !== 'reps') return target;
  return `${sets} × ${target}`;
}

/** How many set rows to render by default (the top of a set range). */
export function plannedSetCount(rx) {
  return Math.max(1, rx.sets.max || rx.sets.min || 1);
}

/** Human sentence used in the exercise card header. */
export function targetTypeLabel(rx) {
  return TARGET_TYPES[rx.target.type] ? TARGET_TYPES[rx.target.type].short : 'TARGET';
}

/* -------------------------------------------------------------------------
   Logging fields — the logging UI is generated from this, so irrelevant
   fields are never shown.

   Returns an array of:
     { key, label, kind:'weight'|'reps'|'time'|'distance'|'calories',
       step, unit, mode:'number'|'clock' }
   ---------------------------------------------------------------------- */
export function logFields(rx, settings) {
  const fields = [];
  const step = settings && settings.weightStep ? settings.weightStep : 2.5;

  if (rx.load.type === 'weight') {
    fields.push({ key: 'weight', label: (rx.load.unit || 'kg').toUpperCase(), kind: 'weight', step, unit: rx.load.unit || 'kg', mode: 'number' });
  } else if (rx.load.type === 'assisted') {
    fields.push({ key: 'weight', label: 'ASSIST', kind: 'weight', step, unit: rx.load.unit || 'kg', mode: 'number' });
  }

  const t = rx.target;
  if (t.type === 'reps') {
    fields.push({ key: 'reps', label: 'REPS', kind: 'reps', step: (settings && settings.repStep) || 1, unit: null, mode: 'number' });
  } else if (t.type === 'time') {
    fields.push({ key: 'timeSec', label: 'TIME', kind: 'time', step: 5, unit: 'seconds', mode: 'clock' });
  } else if (t.type === 'distance') {
    fields.push({ key: 'distance', label: (t.unit || 'm').toUpperCase(), kind: 'distance', step: t.unit === 'km' ? 0.1 : 50, unit: t.unit || 'm', mode: 'number' });
    if (rx.load.type === 'none') {
      fields.push({ key: 'timeSec', label: 'TIME', kind: 'time', step: 5, unit: 'seconds', mode: 'clock' });
    }
  } else if (t.type === 'calories') {
    fields.push({ key: 'calories', label: 'CAL', kind: 'calories', step: 5, unit: null, mode: 'number' });
  }

  return fields;
}

/** Seed value for a fresh set row, taken from the prescription itself. */
export function defaultSetValues(rx) {
  const v = { weight: null, reps: null, timeSec: null, distance: null, calories: null };
  const t = rx.target;
  if (t.type === 'reps') v.reps = t.min;
  else if (t.type === 'time') v.timeSec = t.unit === 'minutes' ? t.min * 60 : t.min;
  else if (t.type === 'distance') v.distance = t.min;
  else if (t.type === 'calories') v.calories = t.min;
  return v;
}

/** One-line summary of a logged set: "80 kg × 8", "20:00", "250 m". */
export function setLabel(set, rx) {
  const parts = [];
  const unit = (rx && rx.load && rx.load.unit) || 'kg';
  if (set.weight !== null && set.weight !== undefined && set.weight !== '') {
    parts.push(`${num(set.weight)} ${rx && rx.load.type === 'assisted' ? '-' + unit : unit}`);
  }
  if (set.reps !== null && set.reps !== undefined && set.reps !== '') {
    parts.push(parts.length ? `× ${num(set.reps)}` : `${num(set.reps)} reps`);
  }
  if (set.timeSec) parts.push(mmss(set.timeSec));
  if (set.distance) parts.push(`${num(set.distance)} ${(rx && rx.target.unit) || 'm'}`);
  if (set.calories) parts.push(`${num(set.calories)} cal`);
  return parts.join(' ') || '—';
}

/** Does this set carry enough information to count as logged? */
export function setHasValue(set) {
  return ['weight', 'reps', 'timeSec', 'distance', 'calories']
    .some((k) => set[k] !== null && set[k] !== undefined && set[k] !== '' && Number(set[k]) !== 0);
}

/** Volume in kg (or lb) for a single set. Only weight × reps counts. */
export function setVolume(set) {
  const w = Number(set.weight);
  const r = Number(set.reps);
  if (!w || !r) return 0;
  return w * r;
}

/** Epley estimated 1RM. Returns 0 when it does not apply. */
export function estimated1RM(set) {
  const w = Number(set.weight);
  const r = Number(set.reps);
  if (!w || !r) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

/** Validate + normalise a prescription coming out of the builder form. */
export function normalisePrescription(rx) {
  const out = { ...rx };
  out.sets = {
    min: Math.max(1, Math.round(Number(rx.sets.min) || 1)),
    max: Math.max(1, Math.round(Number(rx.sets.max) || 1))
  };
  if (out.sets.max < out.sets.min) out.sets.max = out.sets.min;

  const t = { ...rx.target };
  t.min = Number(t.min) || 0;
  t.max = Number(t.max) || t.min;
  if (t.max < t.min) t.max = t.min;
  if (!TARGET_TYPES[t.type]) t.type = 'reps';
  if (t.type === 'reps' || t.type === 'calories') t.unit = null;
  out.target = t;

  out.restSec = Math.max(0, Math.round(Number(rx.restSec) || 0));
  if (!LOAD_TYPES[out.load.type]) out.load.type = 'weight';
  return out;
}
