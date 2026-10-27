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


/* ---------------------------------------------------------------------------
   NOV-DEC PROGRAM — 8-week block, Friday 6 Nov to Thursday 31 Dec 2026
   Weeks run Friday to Thursday: Lower A (Fri), Upper A (Sat), optional
   conditioning (Sun), Lower B (Mon), Upper B (Tue), rest (Wed), Arms &
   Shoulders (Thu), plus two unscheduled full-body sessions for busy weeks.
   About 105 working sets a week.

   Ids are fixed, as for the Fat Loss Block, so every device seeds the same
   record and sync never sees a conflict.
   ------------------------------------------------------------------------ */
const NOV_DEC_DESCRIPTION = 'Fri 6 Nov – Thu 31 Dec 2026. Muscle gain in a calorie deficit, ~105 sets a week. Weeks run Friday to Thursday. '
  + 'Week 1: stop 3 reps short on everything to find working weights. Weeks 2–4: target RIR. '
  + 'Weeks 5–7: one extra set on Fri leg extension, Sat cable lateral raise, Mon lying leg curl, Tue pec deck, Thu hammer curl and rope pushdown. '
  + 'Week 8 (25–31 Dec): deload, half the sets at the same loads, no Cindy; take it early if top-set reps fall on 2+ main lifts two sessions running. '
  + 'Double progression: when every set hits the top of the range at the target RIR, add 2.5 kg (or the next dumbbell) and restart at the bottom of the range. '
  + 'Missed day: do it on the next free day (Sun or Wed) and keep the order. Busy week: train Full-Body A and B instead. '
  + 'Steps: 5,500/day weeks 1–4, 7,000/day weeks 5–8.';

const ND_WARM_UP = 'Warm-up (~10 min): 5 min rower or treadmill walk, 2–3 min movement prep, '
  + 'then ramp sets on the first lift only: 45% × 8, 65% × 5, 80% × 3, 90% × 1.';

function ndDay(key, name, subtitle, dayOfWeek, estMinutes, notes, exercises) {
  const d = day(name, subtitle, dayOfWeek, estMinutes, notes, exercises);
  d.id = `day_nd_${key}`;
  // Unscheduled fallback days stay disabled so the week reads as 7 days; they
  // can still be started from Train → Choose a workout.
  d.enabled = dayOfWeek !== null;
  d.exercises.forEach((r, i) => { r.id = `rx_nd_${key}_${i + 1}`; });
  return d;
}

const FALLBACK_NOTE = 'Only for a week when five sessions won\'t happen. Train A and B that week; same rep ranges and RIR as the main days. '
  + 'A fallback week in weeks 5–7 counts as the deload.';

export function buildNovDecProgram() {
  const now = Date.now();
  return {
    id: uid('prog'),
    seedId: 'nov-dec-program',
    name: 'Nov-Dec Program',
    description: NOV_DEC_DESCRIPTION,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    version: 1,
    days: [
      ndDay('lower_a', 'Lower A', 'Squat + hinge, heavy', 5, 65, ND_WARM_UP, [
        rx('back_squat', [3], reps(5, 8), 180, { name: 'Back Squat (or Smith Squat)', notes: '2 RIR.' }),
        rx('romanian_deadlift', [3], reps(8, 10), 150, { notes: '2 RIR.' }),
        rx('leg_press', [3], reps(10, 12), 120, { notes: '1–2 RIR. Quad volume without more load on the back.' }),
        rx('seated_leg_curl', [3], reps(10, 12), 90, { notes: '1 RIR.' }),
        rx('leg_extension', [2], reps(12, 15), 90, { notes: '0–1 RIR. Weeks 5–7: 3 sets.' }),
        rx('standing_calf_raise', [3], reps(8, 12), 90, { notes: '1 RIR. 1 s pause at the bottom.' }),
        rx('machine_ab_crunch', [3], reps(10, 15), 60, { name: 'Machine Ab Crunch (or Weighted Decline Crunch)', notes: '0–1 RIR. Add load when all 3 sets reach 15.' })
      ]),

      ndDay('upper_a', 'Upper A', 'Chest & back, heavy', 6, 75, ND_WARM_UP, [
        rx('incline_dumbbell_press', [3], reps(6, 8), 150, { notes: '2 RIR.' }),
        rx('chest_supported_row', [4], reps(6, 8), 150, { notes: '2 RIR.' }),
        rx('dumbbell_bench_press', [3], reps(8, 10), 120, { name: 'Flat Dumbbell or Machine Press', notes: '1–2 RIR.' }),
        rx('lat_pulldown', [3], reps(8, 10), 120, { name: 'Lat Pulldown — Wide Grip', notes: '1–2 RIR.' }),
        rx('cable_lateral_raise', [3], reps(12, 15), 60, { name: 'Cable Lateral Raise — One Arm', notes: '0–1 RIR. Weeks 5–7: 4 sets.' }),
        rx('overhead_cable_extension', [3], reps(10, 12), 75, { name: 'Overhead Cable Triceps Extension', notes: '0–1 RIR.' }),
        rx('incline_dumbbell_curl', [3], reps(10, 12), 75, { notes: '0–1 RIR.' })
      ]),

      ndDay('conditioning', 'Optional Conditioning', 'Hybrid Cindy or incline walk', 0, 40,
        'Optional. Pick one and log only that one. Skip Cindy in the deload week.', [
        rx('hybrid_cindy', [1], reps(10), 0, { load: 'none', name: 'Hybrid Cindy — rounds completed', notes: '20 min: alternate 1 min run and 1 min Cindy round (5 pull-ups, 10 push-ups, 15 air squats). Log full rounds completed out of 10. Stop every round 2+ reps short of failure so Tuesday\'s pulldowns don\'t suffer.' }),
        rx('incline_treadmill_walk', [1], mins(40), 0, { load: 'none', notes: 'Or this instead of Cindy: 5.5 km/h at 10–12% grade, conversational pace.' })
      ]),

      ndDay('lower_b', 'Lower B', 'Machines + single-leg', 1, 60, ND_WARM_UP, [
        rx('hack_squat', [3], reps(8, 12), 150, { name: 'Hack Squat (or Leg Press)', notes: '2 RIR.' }),
        rx('hip_thrust', [3], reps(8, 12), 120, { name: 'Hip Thrust (or 45° Back Extension)', notes: '1–2 RIR.' }),
        rx('bulgarian_split_squat', [2], reps(8, 12), 90, { notes: '1–2 RIR. Reps per leg.' }),
        rx('lying_leg_curl', [3], reps(10, 12), 90, { notes: '0–1 RIR. Weeks 5–7: 4 sets.' }),
        rx('seated_calf_raise', [3], reps(12, 15), 60, { notes: '0–1 RIR.' }),
        rx('cable_crunch', [3], reps(10, 15), 60, { notes: '0–1 RIR.' }),
        rx('farmers_carry', [3], metres(30), 90, { name: 'Farmer\'s Walk — Heavy Dumbbells', notes: 'Always last. Stop when posture slips.' })
      ]),

      ndDay('upper_b', 'Upper B', 'Back & chest, moderate', 2, 60, ND_WARM_UP, [
        rx('close_grip_pulldown', [4], reps(6, 10), 150, { name: 'Neutral-Grip Lat Pulldown (V-Handle)', notes: '2 RIR.' }),
        rx('machine_chest_press', [3], reps(8, 12), 120, { name: 'Machine Chest Press (or Dip)', notes: '1–2 RIR.' }),
        rx('seated_cable_row', [3], reps(10, 12), 90, { name: 'Seated Cable Row — Neutral Grip', notes: '1 RIR.' }),
        rx('pec_deck', [3], reps(12, 15), 60, { name: 'Pec Deck (or Cable Fly)', notes: '0–1 RIR. Weeks 5–7: 4 sets.' }),
        rx('dumbbell_lateral_raise', [3], reps(12, 15), 60, { notes: '0–1 RIR.' }),
        rx('face_pull', [3], reps(15, 20), 60, { notes: '0–1 RIR.' })
      ]),

      ndDay('rest', 'Rest', 'Steps only', 3, 0, 'Steps: 5,500 weeks 1–4, 7,000 weeks 5–8. A missed session moves here or to Sunday.', []),

      ndDay('arms_shoulders', 'Arms & Shoulders', 'Delts, biceps, triceps, core', 4, 65, ND_WARM_UP, [
        rx('machine_lateral_raise', [4], reps(12, 15), 60, { name: 'Machine Lateral Raise (or Cable Lean-Away)', notes: '0–1 RIR.' }),
        rx('reverse_pec_deck', [3], reps(15, 20), 60, { name: 'Reverse Fly — Machine or Cable', notes: '0–1 RIR.' }),
        rx('ez_bar_curl', [4], reps(8, 12), 0, { notes: 'Superset A1, 1 RIR. Go straight to the skull crusher.' }),
        rx('skull_crusher', [4], reps(8, 12), 90, { name: 'EZ-Bar Skull Crusher', notes: 'Superset A2, 1 RIR. Rest 90 s after the pair.' }),
        rx('hammer_curl', [3], reps(10, 12), 60, { notes: '0–1 RIR. Weeks 5–7: 4 sets.' }),
        rx('cable_pushdown', [3], reps(10, 15), 60, { name: 'Rope Pushdown', notes: '0–1 RIR. Weeks 5–7: 4 sets.' }),
        rx('dumbbell_side_bend', [3], reps(12, 15), 45, { name: 'Dumbbell Side Bend (or Weighted Side Plank)', notes: '1 RIR. Reps per side.' })
      ]),

      ndDay('fullbody_a', 'Full-Body A', 'Busy-week fallback', null, 45, FALLBACK_NOTE, [
        rx('back_squat', [3], reps(5, 8), 180, { name: 'Back Squat (or Smith Squat)', notes: '2 RIR.' }),
        rx('incline_dumbbell_press', [3], reps(6, 8), 150, { notes: '2 RIR.' }),
        rx('chest_supported_row', [3], reps(6, 8), 150, { notes: '2 RIR.' }),
        rx('cable_lateral_raise', [3], reps(12, 15), 60, { name: 'Cable Lateral Raise — One Arm', notes: '0–1 RIR.' })
      ]),

      ndDay('fullbody_b', 'Full-Body B', 'Busy-week fallback', null, 45, FALLBACK_NOTE, [
        rx('romanian_deadlift', [3], reps(8, 10), 150, { notes: '2 RIR.' }),
        rx('close_grip_pulldown', [3], reps(6, 10), 150, { name: 'Neutral-Grip Lat Pulldown (V-Handle)', notes: '2 RIR.' }),
        rx('machine_chest_press', [3], reps(8, 12), 120, { name: 'Machine Chest Press (or Dip)', notes: '1–2 RIR.' }),
        rx('ez_bar_curl', [2], reps(8, 12), 0, { notes: 'Superset A1, 1 RIR. Go straight to the skull crusher.' }),
        rx('skull_crusher', [2], reps(8, 12), 90, { name: 'EZ-Bar Skull Crusher', notes: 'Superset A2, 1 RIR. Rest 90 s after the pair.' })
      ])
    ]
  };
}

/** Everything the app seeds on first run, keyed by a stable seedId. */
export const SEED_BUILDERS = [
  { seedId: 'fat-loss-block', build: buildSeedProgram },
  { seedId: 'pt-program', build: buildPTProgram },
  { seedId: 'nov-dec-program', build: buildNovDecProgram }
];
