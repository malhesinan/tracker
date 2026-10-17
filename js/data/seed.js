/* ============================================================================
   SEED PROGRAMME
   ----------------------------------------------------------------------------
   A first-run programme so the app is useful before anything is built by hand.
   Everything here is ordinary data: rename it, edit it or delete it in the
   Program tab and nothing in the app cares.
   ========================================================================== */

import { uid } from '../util.js';

/* rx(exerciseId, sets, target, rest, extras) — compact prescription builder */
function rx(exerciseId, sets, target, restSec, extra = {}) {
  return {
    id: uid('rx'),
    exerciseId,
    displayName: extra.name || null,
    sets: { min: sets[0], max: sets[1] === undefined ? sets[0] : sets[1] },
    target,
    load: { type: extra.load || 'weight', unit: 'kg' },
    restSec,
    tempo: extra.tempo || null,
    rpe: extra.rpe || null,
    equipmentOverride: null,
    cue: extra.cue || null,
    notes: extra.notes || null,
    image: null
  };
}

const reps = (min, max) => ({ type: 'reps', unit: null, min, max: max === undefined ? min : max });
const mins = (min, max) => ({ type: 'time', unit: 'minutes', min, max: max === undefined ? min : max });
const metres = (min, max) => ({ type: 'distance', unit: 'm', min, max: max === undefined ? min : max });

function day(name, subtitle, dayOfWeek, estMinutes, notes, exercises) {
  return {
    id: uid('day'),
    name,
    subtitle,
    dayOfWeek,
    enabled: true,
    estMinutes,
    notes,
    exercises
  };
}

/* ---------------------------------------------------------------------------
   FAT LOSS BLOCK — 4-day upper/lower + optional cardio
   Saturday Upper A, Sunday Lower A, Tuesday Upper B, Wednesday Lower B.
   Monday and Thursday optional outdoor cardio, Friday full rest.

   Ids are fixed rather than random, so two devices that each apply the
   revision produce the same record and sync never sees a conflict.
   ------------------------------------------------------------------------ */
export const UPPER_LOWER_REVISION = 2;

const UPPER_LOWER_DESCRIPTION = 'Fat loss with muscle retention/building (calorie deficit). '
  + 'RIR = reps in reserve: how many more clean reps you could have done when you end the set. '
  + 'Double progression: keep the weight until the top of the rep range is hit on all sets, then increase load. '
  + 'Keep Lower A and Lower B 72 hours apart; never more than 2 lifting days in a row. '
  + 'Daily steps: 8,000–10,000.';

const WARM_UP = 'Warm-up: 5 min treadmill or rower, band pull-aparts plus day-specific movement prep, '
  + 'then 4 ramp-up sets on the first heavy lift only.';

function fixedDay(key, name, subtitle, dayOfWeek, estMinutes, notes, exercises) {
  const d = day(name, subtitle, dayOfWeek, estMinutes, notes, exercises);
  d.id = `day_ul_${key}`;
  d.exercises.forEach((r, i) => { r.id = `rx_ul_${key}_${i + 1}`; });
  return d;
}

const LIFTING_DAYS = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];

const postLiftWalk = () => rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none', notes: 'Post-lift, zone 2, 8–12% grade.' });

/**
 * The days of the upper/lower programme. Pass the current days to keep the
 * ids of Upper A, Lower A, Upper B and Lower B, so logged sessions stay
 * linked to the day they were done on.
 */
export function buildUpperLowerDays(existingDays = []) {
  const days = [
    fixedDay('upper_a', 'Upper A', 'Heavy horizontal press and row', 6, 75, WARM_UP, [
      rx('incline_dumbbell_press', [3], reps(6, 8), 150, { notes: 'Heavy, 2–3 RIR.' }),
      rx('chest_supported_row', [3], reps(6, 8), 150, { name: 'Chest-Supported Row — Overhand', notes: 'Heavy, 2–3 RIR.' }),
      rx('dumbbell_bench_press', [3], reps(10, 12), 90, { name: 'Flat Dumbbell or Machine Press', notes: '1–2 RIR.' }),
      rx('lat_pulldown', [3], reps(10, 12), 90, { name: 'Lat Pulldown — Wide Overhand', notes: '1–2 RIR.' }),
      rx('dumbbell_lateral_raise', [3], reps(12, 15), 60, { notes: '0–1 RIR.' }),
      rx('overhead_cable_extension', [3], reps(10, 12), 0, { name: 'Overhead Cable Triceps Extension', notes: 'Superset A. Go straight to the incline curl.' }),
      rx('incline_dumbbell_curl', [3], reps(8, 12), 60, { notes: 'Superset A. Rest after the pair.' }),
      postLiftWalk()
    ]),

    fixedDay('lower_a', 'Lower A', 'Squat focus', 0, 65, WARM_UP, [
      rx('back_squat', [3], reps(5, 8), 180, { name: 'Squat', notes: 'Stop 1–2 reps short of failure.' }),
      rx('romanian_deadlift', [3], reps(8, 10), 150, { notes: 'Stop 1–2 reps short of failure.' }),
      rx('leg_press', [2], reps(12, 15), 90, { notes: '1–2 RIR.' }),
      rx('lying_leg_curl', [3], reps(10, 12), 75, { name: 'Lying or Seated Leg Curl', notes: '1–2 RIR.' }),
      rx('standing_calf_raise', [3], reps(8, 12), 60, { notes: '1s pause at the bottom.' }),
      rx('hanging_leg_raise', [3], reps(10, 20), 60, { load: 'bodyweight', notes: 'Every set to failure.' }),
      rx('farmers_carry', [3], metres(30, 40), 90, { name: 'Farmer\'s Walk', notes: 'Always last. Heaviest dumbbells you can carry upright for the full distance; move up one size when all 3 trips feel controlled.' })
    ]),

    fixedDay('cardio_mon', 'Optional Cardio', 'Outdoor · brisk walk or cycling', 1, 45, 'Conversational pace.', [
      rx('indoor_walk', [1], mins(40, 45), 0, { load: 'none', name: 'Brisk Walk (~6 km/h) or Cycling', notes: 'Outdoors, conversational pace.' })
    ]),

    fixedDay('upper_b', 'Upper B', 'Vertical pull and shoulders', 2, 80, WARM_UP, [
      rx('lat_pulldown', [3], reps(6, 8), 150, { name: 'Weighted Pull-Up or Lat Pulldown', notes: 'Heavy, 2–3 RIR.' }),
      rx('seated_dumbbell_press', [3], reps(8, 10), 120, { name: 'Seated Shoulder Press', notes: '1–2 RIR.' }),
      rx('dip_chest', [3], reps(10, 12), 90, { name: 'Cable Decline Press or Dip', notes: '1–2 RIR.' }),
      rx('single_arm_cable_row', [2], reps(10, 12), 75, { name: 'Single-Arm Cable Row — Neutral', notes: 'Per arm; rest after both sides.' }),
      rx('cable_lateral_raise', [3], reps(15, 20), 60, { name: 'Cable Lateral Raise — One Arm', notes: '0–1 RIR.' }),
      rx('reverse_pec_deck', [3], reps(15, 20), 60, { name: 'Reverse Fly — Cable or Machine', notes: '0–1 RIR.' }),
      rx('hammer_curl', [3], reps(10, 12), 0, { notes: 'Superset B. Go straight to the rope pushdown.' }),
      rx('cable_pushdown', [3], reps(12, 15), 60, { name: 'Rope Pushdown', notes: 'Superset B. Rest after the pair.' }),
      postLiftWalk()
    ]),

    fixedDay('lower_b', 'Lower B', 'Hip and single-leg focus', 3, 60, WARM_UP, [
      rx('bulgarian_split_squat', [3], reps(8, 12), 120, { name: 'Bulgarian Split Squat or Hack Squat', notes: '1–2 RIR; per leg if unilateral.' }),
      rx('hip_thrust', [3], reps(10, 12), 90, { name: 'Hip Thrust or 45° Back Extension', notes: '1–2 RIR.' }),
      rx('leg_extension', [3], reps(12, 15), 60, { notes: '0–1 RIR.' }),
      rx('seated_leg_curl', [3], reps(12, 15), 60, { notes: '0–1 RIR.' }),
      rx('seated_calf_raise', [3], reps(12, 15), 60),
      rx('cable_crunch', [3], reps(10, 15), 60)
    ]),

    fixedDay('cardio_thu', 'Optional Cardio', 'Outdoor · brisk walk or cycling', 4, 45, 'Conversational pace.', [
      rx('indoor_walk', [1], mins(40, 45), 0, { load: 'none', name: 'Brisk Walk (~6 km/h) or Cycling', notes: 'Outdoors, conversational pace.' })
    ]),

    fixedDay('rest', 'Full Rest', 'Steps only', 5, 0, '8,000–10,000 steps.', [])
  ];

  days.forEach((d) => {
    if (!LIFTING_DAYS.includes(d.name)) return;
    const old = existingDays.find((o) => o.name === d.name && o.id);
    if (old) d.id = old.id;
  });
  return days;
}

/** Apply the current upper/lower layout to a programme, in place. */
export function applyUpperLowerRevision(program) {
  program.name = 'Fat Loss Block';
  program.description = UPPER_LOWER_DESCRIPTION;
  program.days = buildUpperLowerDays(program.days || []);
  program.seedRevision = UPPER_LOWER_REVISION;
  return program;
}

export function buildSeedProgram() {
  const now = Date.now();
  return applyUpperLowerRevision({
    id: uid('prog'),
    seedId: 'fat-loss-block',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
    days: []
  });
}


/* ---------------------------------------------------------------------------
   PT PROGRAM
   Six training days from the PT plan: Push / Pull / Legs / Upper / Lower,
   Wednesday off with a step target, Thursday standalone cardio.
   ------------------------------------------------------------------------ */
export function buildPTProgram() {
  const now = Date.now();
  return {
    id: uid('prog'),
    seedId: 'pt-program',
    name: 'PT Program',
    description: 'Push / Pull / Legs / Upper / Lower across Friday to Tuesday, with two off days.',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    version: 1,
    days: [
      day('Push', 'Chest, shoulders and triceps', 5, 70, '', [
        rx('incline_dumbbell_press', [3], reps(6, 8), 150, { cue: 'Bench at 30°. Heaviest pressing of the day.' }),
        rx('dumbbell_bench_press', [3], reps(10, 12), 120, { name: 'Flat Dumbbell or Machine Press' }),
        rx('cable_fly', [2], reps(12, 15), 90, { name: 'Cable Fly — Low to High', cue: 'Drive from low to high, finish with the hands together at chin height.' }),
        rx('overhead_cable_extension', [3], reps(10, 12), 90),
        rx('cable_pushdown', [2], reps(12, 15), 60, { name: 'Rope Pushdown' }),
        rx('dumbbell_lateral_raise', [3], reps(12, 15), 60),
        rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none' })
      ]),

      day('Pull', 'Back and biceps', 6, 70, '', [
        rx('lat_pulldown', [3], reps(6, 8), 150, { name: 'Lat Pulldown or Weighted Pull-Up' }),
        rx('chest_supported_row', [3], reps(8, 10), 120, { name: 'Chest-Supported Row — Overhand' }),
        rx('single_arm_cable_row', [2], reps(10, 12), 90, { name: 'Single-Arm Cable Row — Neutral' }),
        rx('straight_arm_pulldown', [2], reps(12, 15), 90, { name: 'Cable Pullover' }),
        rx('face_pull', [3], reps(15, 20), 60),
        rx('incline_dumbbell_curl', [3], reps(8, 12), 60),
        rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none' })
      ]),

      day('Legs', 'Heavy', 0, 75, '', [
        rx('back_squat', [3], reps(5, 8), 180, { cue: 'Heaviest sets of the week. Ramp up properly.' }),
        rx('romanian_deadlift', [3], reps(8, 10), 150, { cue: 'Push the hips back, bar against the legs.' }),
        rx('leg_press', [3], reps(12, 15), 120),
        rx('lying_leg_curl', [3], reps(10, 12), 90, { name: 'Lying or Seated Leg Curl' }),
        rx('standing_calf_raise', [4], reps(8, 12), 60),
        rx('hanging_leg_raise', [3], reps(10, 20), 60, { load: 'bodyweight', cue: 'Every set to failure.' })
      ]),

      day('Upper', 'Moderate', 1, 70, '', [
        rx('seated_dumbbell_press', [3], reps(8, 10), 120, { name: 'Seated Shoulder Press' }),
        rx('dip_chest', [3], reps(10, 12), 90, { name: 'Cable Decline Press or Dip' }),
        rx('machine_row', [3], reps(10, 12), 90, { name: 'Row Machine — Neutral Grip' }),
        rx('lat_pulldown', [2], reps(12, 15), 90, { name: 'Lat Pulldown — Wide Overhand' }),
        rx('cable_lateral_raise', [3], reps(15, 20), 60, { name: 'Cable Lateral Raise — One Arm' }),
        rx('hammer_curl', [2], reps(10, 12), 60),
        rx('cable_pushdown', [2], reps(12, 15), 60, { name: 'Reverse-Grip Pushdown' }),
        rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none' })
      ]),

      day('Lower + Rear Delts', 'Quads, hamstrings, calves and rear delts', 2, 70, '', [
        rx('bulgarian_split_squat', [3], reps(8, 12), 120, { name: 'Bulgarian Split Squat or Hack Squat' }),
        rx('hip_thrust', [3], reps(10, 12), 120, { name: 'Hip Thrust or 45° Back Extension' }),
        rx('leg_extension', [3], reps(12, 15), 75),
        rx('seated_leg_curl', [2], reps(12, 15), 75),
        rx('seated_calf_raise', [3, 4], reps(12, 15), 60),
        rx('reverse_pec_deck', [3], reps(15, 20), 60, { name: 'Reverse Fly — Cable or Machine' }),
        rx('cable_crunch', [3], reps(10, 15), 60)
      ]),

      day('Off', 'Steps only', 3, 0, '8,000–10,000 steps.', []),

      day('Off — Cardio Only', 'Standalone conditioning', 4, 40, 'Zone 2 the whole way. You should be able to hold a conversation.', [
        rx('incline_treadmill_walk', [1], mins(40), 0, { load: 'none', cue: '8–12% grade, zone 2. Standalone session, no lifting.' })
      ])
    ]
  };
}

/** Everything the app seeds on first run, keyed by a stable seedId. */
export const SEED_BUILDERS = [
  { seedId: 'fat-loss-block', build: buildSeedProgram },
  { seedId: 'pt-program', build: buildPTProgram }
];
