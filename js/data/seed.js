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

export function buildSeedProgram() {
  const now = Date.now();
  return {
    id: uid('prog'),
    name: 'Fat Loss Block',
    description: 'Four lifting days plus one conditioning day. Upper/lower split.',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
    days: [
      day('Lower A', 'Squat-led · heaviest session', 0, 75,
        'Eight-minute warm-up. Ramp on the squat only: empty bar × 10, 50% × 5, 75% × 3.', [
          rx('back_squat', [4], reps(6, 8), 150, { cue: 'Brace before you unrack. Two seconds down.' }),
          rx('leg_press', [4], reps(10, 12), 120, { cue: 'Feet mid-platform. Lower back stays on the pad.' }),
          rx('seated_leg_curl', [3], reps(12, 15), 75, { cue: 'Squeeze at the bottom, three seconds back.' }),
          rx('walking_lunge', [2], reps(12), 90, { cue: 'Per leg. Long stride, push through the front heel.' }),
          rx('standing_calf_raise', [3], reps(12, 15), 60),
          rx('hanging_knee_raise', [3], reps(12, 15), 60, { load: 'bodyweight' }),
          rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none', cue: '5.5 km/h at 10–12%. Hands off the rails.' })
        ]),

      day('Upper A', 'Horizontal press and pull', 1, 70,
        'Warm the shoulders properly: band pull-aparts and dislocates before you touch the bar.', [
          rx('barbell_bench_press', [4], reps(6, 8), 150, { cue: 'Shoulder blades back and down. Bar to the lower chest.' }),
          rx('chest_supported_row', [4], reps(8, 10), 120, { cue: 'Chest stays on the pad. Pull to the lower ribs.' }),
          rx('lat_pulldown', [3], reps(10, 12), 90, { cue: 'Drive the elbows down and back.' }),
          rx('seated_dumbbell_press', [3], reps(10, 12), 90),
          rx('dumbbell_lateral_raise', [3], reps(12, 15), 60, { cue: 'Light and slow. Stop at shoulder height.' }),
          rx('cable_pushdown', [3], reps(12, 15), 60),
          rx('machine_ab_crunch', [3], reps(15), 60),
          rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none', cue: 'Same protocol as every lifting day.' })
        ]),

      day('Cardio', 'No lifting · keep it easy', 2, 45,
        'Log only the one you did. You should be able to hold a conversation throughout.', [
          rx('incline_treadmill_walk', [1], mins(45), 0, { load: 'none', name: 'Incline Walk — default', cue: '5.5 km/h at 12%.' }),
          rx('rowing_machine', [10], metres(250), 90, { load: 'none', name: 'Rowing Intervals — alternative', cue: 'Only if you skip the walk.' })
        ]),

      day('Lower B', 'Machine-led · easier on the back', 3, 75,
        'Exercises 2 and 3 carry all your hip-hinge work. Do not skip them.', [
          rx('hack_squat', [4], reps(8, 10), 150, { cue: 'Deep but controlled. Leg press if no hack squat.' }),
          rx('back_extension', [3], reps(12, 15), 120, { load: 'bodyweight', cue: 'Hold a plate once bodyweight is easy.' }),
          rx('cable_pull_through', [3], reps(12, 15), 90, { cue: 'Hips back, then snap forward. Your main hinge.' }),
          rx('reverse_lunge', [3], reps(10), 90, { cue: 'Per leg. Step backwards, rear knee lightly down.' }),
          rx('leg_extension', [3], reps(12, 15), 75, { cue: 'One-second pause at the top.' }),
          rx('seated_calf_raise', [3], reps(15, 20), 60),
          rx('cable_crunch', [3], reps(15), 60, { cue: 'Curl the spine down. Do not pull with the arms.' }),
          rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none' })
        ]),

      day('Upper B', 'Vertical push + pull', 4, 70,
        'The overhead press is the least forgiving lift here if you go into it cold.', [
          rx('overhead_press', [4], reps(6, 8), 150, { cue: 'Glutes tight, ribs down. Head through at the top.' }),
          rx('lat_pulldown', [4], reps(8, 10), 120, { name: 'Lat Pulldown — Wide Grip', cue: 'Wider than Monday. Full stretch at the top.' }),
          rx('incline_dumbbell_press', [3], reps(10, 12), 90, { cue: 'Bench at 30°, no steeper.' }),
          rx('seated_cable_row', [3], reps(10, 12), 90, { cue: 'Chest up, no rocking. Pull to the navel.' }),
          rx('rear_delt_fly', [3], reps(15, 20), 60, { cue: 'Light. The best thing here for a desk job.' }),
          rx('dumbbell_curl', [3], reps(10, 12), 60),
          rx('hanging_knee_raise', [3], reps(12, 15), 60, { load: 'bodyweight' }),
          rx('incline_treadmill_walk', [1], mins(20), 0, { load: 'none' })
        ])
    ]
  };
}
