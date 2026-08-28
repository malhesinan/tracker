/* ============================================================================
   EXERCISE LIBRARY
   ----------------------------------------------------------------------------
   Stored as compact tuples and expanded at load time into the full exercise
   record described in the data model. This keeps the shipped file small while
   every exercise still exposes the complete metadata shape:

     { id, name, aliases[], category, primaryMuscles[], secondaryMuscles[],
       equipment, movementPattern, prescriptionTypes[], loadType,
       image{url,source,attribution,license}, description, coachingCues[],
       source, builtin }

   Tuple order:
     0 id
     1 name
     2 category
     3 equipment
     4 primary muscles      (comma separated)
     5 secondary muscles    (comma separated, "" for none)
     6 movement pattern
     7 load type            weight | bodyweight | assisted | none
     8 target types         comma separated: reps | time | distance | calories
     9 aliases              (comma separated, "" for none)
    10 coaching cue         (single line, may be "")
   ========================================================================== */

const T = [
  // ── CHEST ────────────────────────────────────────────────────────────────
  ['barbell_bench_press','Barbell Bench Press','Chest','Barbell','Chest','Triceps,Front Delts','Horizontal Push','weight','reps','Bench Press,BB Bench,Flat Bench','Shoulder blades back and down. Bar to the lower chest, elbows near 45°.'],
  ['incline_barbell_press','Incline Barbell Press','Chest','Barbell','Upper Chest','Front Delts,Triceps','Horizontal Push','weight','reps','Incline Bench','Bench at 30°. Any steeper and it becomes a shoulder press.'],
  ['dumbbell_bench_press','Dumbbell Bench Press','Chest','Dumbbell','Chest','Triceps,Front Delts','Horizontal Push','weight','reps','DB Bench,Flat DB Press','Lower until the elbows are just past the torso. Do not clash the bells at the top.'],
  ['incline_dumbbell_press','Incline Dumbbell Press','Chest','Dumbbell','Upper Chest','Front Delts,Triceps','Horizontal Push','weight','reps','Incline DB Press','Bench at 30°, no steeper. Press slightly back over the eyes.'],
  ['dumbbell_floor_press','Dumbbell Floor Press','Chest','Dumbbell','Chest','Triceps','Horizontal Push','weight','reps','Floor Press','Pause when the triceps touch the floor. Elbows at 45°.'],
  ['machine_chest_press','Machine Chest Press','Chest','Machine','Chest','Triceps,Front Delts','Horizontal Push','weight','reps','Seated Chest Press','Set the handles level with the mid chest before you sit down.'],
  ['pec_deck','Pec Deck','Chest','Machine','Chest','Front Delts','Horizontal Push','weight','reps','Machine Fly,Butterfly','Soft elbows. Squeeze for a beat at the point of most tension.'],
  ['cable_fly','Cable Fly','Chest','Cable','Chest','Front Delts','Horizontal Push','weight','reps','Cable Crossover,Standing Fly','Slight forward lean. Think about hugging, not pushing.'],
  ['dumbbell_fly','Dumbbell Fly','Chest','Dumbbell','Chest','Front Delts','Horizontal Push','weight','reps','DB Fly','Wide arc, soft elbows, stop the stretch before the shoulder complains.'],
  ['push_up','Push-Up','Chest','Bodyweight','Chest','Triceps,Core','Horizontal Push','bodyweight','reps,time','Pushup,Press-Up','Ribs down and glutes tight. The body moves as one plank.'],
  ['dip_chest','Chest Dip','Chest','Bodyweight','Chest','Triceps,Front Delts','Horizontal Push','bodyweight','reps','Dips','Lean the torso forward to keep the load on the chest.'],
  ['dumbbell_pullover','Dumbbell Pullover','Chest','Dumbbell','Chest','Lats,Triceps','Vertical Pull','weight','reps','Pullover','Move only at the shoulder. Feel the stretch across the ribcage.'],

  // ── BACK ─────────────────────────────────────────────────────────────────
  ['lat_pulldown','Lat Pulldown','Back','Cable','Lats','Biceps,Mid Back','Vertical Pull','weight','reps','Pulldown,Wide Pulldown','Drive the elbows down and back rather than pulling with the hands.'],
  ['close_grip_pulldown','Close-Grip Pulldown','Back','Cable','Lats','Biceps','Vertical Pull','weight','reps','Neutral Grip Pulldown','Chest tall, pull the handle to the collarbone.'],
  ['pull_up','Pull-Up','Back','Bodyweight','Lats','Biceps,Mid Back','Vertical Pull','bodyweight','reps','Pullup','Start from a dead hang. Lead with the chest, not the chin.'],
  ['chin_up','Chin-Up','Back','Bodyweight','Lats','Biceps','Vertical Pull','bodyweight','reps','Chinup,Underhand Pull-Up','Supinated grip. Best pull-up variation for the biceps.'],
  ['assisted_pull_up','Assisted Pull-Up','Back','Machine','Lats','Biceps','Vertical Pull','assisted','reps','Machine Pull-Up','Log the assistance weight. Less assistance is progress.'],
  ['barbell_row','Barbell Row','Back','Barbell','Mid Back','Lats,Biceps,Lower Back','Horizontal Pull','weight','reps','Bent-Over Row,BB Row','Flat back at about 45°. Pull to the belly button, no torso heave.'],
  ['pendlay_row','Pendlay Row','Back','Barbell','Mid Back','Lats,Biceps','Horizontal Pull','weight','reps','Dead-Stop Row','Bar resets on the floor every rep. Torso stays parallel.'],
  ['chest_supported_row','Chest-Supported Row','Back','Machine','Mid Back','Lats,Biceps,Rear Delts','Horizontal Pull','weight','reps','Seal Row,CSR','Chest stays on the pad. Pull to the lower ribs and hold the squeeze.'],
  ['seated_cable_row','Seated Cable Row','Back','Cable','Mid Back','Lats,Biceps','Horizontal Pull','weight','reps','Cable Row','Chest up, no rocking. Pull to the navel.'],
  ['one_arm_dumbbell_row','One-Arm Dumbbell Row','Back','Dumbbell','Lats','Mid Back,Biceps','Horizontal Pull','weight','reps','DB Row,Single Arm Row','Hand on the bench, pull to the hip and keep the shoulders square.'],
  ['t_bar_row','T-Bar Row','Back','Barbell','Mid Back','Lats,Biceps','Horizontal Pull','weight','reps','Landmine Row','Short range at the top is fine. Do not round the lower back.'],
  ['single_arm_cable_row','Single-Arm Cable Row','Back','Cable','Lats','Mid Back,Biceps','Horizontal Pull','weight','reps','One Arm Cable Row','Neutral grip. Let the shoulder travel forward at the stretch, then pull to the hip.'],
  ['machine_row','Machine Row','Back','Machine','Mid Back','Lats,Biceps','Horizontal Pull','weight','reps','Seated Machine Row,Hammer Strength Row','Chest against the pad. Neutral grip keeps the elbows tight to the body.'],
  ['straight_arm_pulldown','Straight-Arm Pulldown','Back','Cable','Lats','Triceps,Core','Vertical Pull','weight','reps','Lat Pushdown','Arms stay long. Sweep the bar to the thighs.'],
  ['deadlift','Deadlift','Back','Barbell','Lower Back','Glutes,Hamstrings,Traps','Hinge','weight','reps','Conventional Deadlift','Bar against the shins, lats tight, push the floor away.'],
  ['trap_bar_deadlift','Trap-Bar Deadlift','Back','Barbell','Glutes','Quads,Lower Back,Traps','Hinge','weight','reps','Hex Bar Deadlift','More forgiving on the back than the straight bar.'],
  ['back_extension','45° Back Extension','Back','Bodyweight','Lower Back','Glutes,Hamstrings','Hinge','bodyweight','reps','Hyperextension,Roman Chair','Hinge at the hips, squeeze the glutes at the top. Hold a plate once easy.'],
  ['shrug','Barbell Shrug','Back','Barbell','Traps','Forearms','Vertical Pull','weight','reps','Shrugs','Straight up, not in a circle. Pause at the top.'],

  // ── SHOULDERS ────────────────────────────────────────────────────────────
  ['overhead_press','Standing Overhead Press','Shoulders','Barbell','Front Delts','Triceps,Side Delts,Core','Vertical Push','weight','reps','OHP,Military Press,Strict Press','Glutes tight, ribs down. Head moves through at the top.'],
  ['seated_dumbbell_press','Seated Dumbbell Press','Shoulders','Dumbbell','Front Delts','Triceps,Side Delts','Vertical Push','weight','reps','DB Shoulder Press','Back supported. Press to lockout without arching off the bench.'],
  ['arnold_press','Arnold Press','Shoulders','Dumbbell','Front Delts','Side Delts,Triceps','Vertical Push','weight','reps','','Rotate as you press. Slow on the way down.'],
  ['machine_shoulder_press','Machine Shoulder Press','Shoulders','Machine','Front Delts','Triceps','Vertical Push','weight','reps','','Set the seat so the handles start at ear height.'],
  ['dumbbell_lateral_raise','Dumbbell Lateral Raise','Shoulders','Dumbbell','Side Delts','Traps','Isolation','weight','reps','Lateral Raise,Side Raise','Light and slow. Lead with the elbow, stop at shoulder height.'],
  ['cable_lateral_raise','Cable Lateral Raise','Shoulders','Cable','Side Delts','Traps','Isolation','weight','reps','','One arm at a time. Constant tension through the whole range.'],
  ['rear_delt_fly','Dumbbell Rear Delt Fly','Shoulders','Dumbbell','Rear Delts','Mid Back','Isolation','weight','reps','Reverse Fly,Bent-Over Fly','Chest supported, light weight. The best thing here for a desk job.'],
  ['reverse_pec_deck','Reverse Pec Deck','Shoulders','Machine','Rear Delts','Mid Back','Isolation','weight','reps','Machine Rear Delt','Wide grip, elbows soft, drive back with the rear delts.'],
  ['face_pull','Face Pull','Shoulders','Cable','Rear Delts','Mid Back,Traps','Horizontal Pull','weight','reps','Rope Face Pull','Rope to the forehead, elbows high, external rotation at the end.'],
  ['upright_row','Cable Upright Row','Shoulders','Cable','Side Delts','Traps,Biceps','Vertical Pull','weight','reps','','Wide grip, elbows lead, stop at chest height.'],
  ['front_raise','Dumbbell Front Raise','Shoulders','Dumbbell','Front Delts','Chest','Isolation','weight','reps','','Rarely needed if you press. Keep it light.'],

  // ── BICEPS ───────────────────────────────────────────────────────────────
  ['dumbbell_curl','Dumbbell Curl','Biceps','Dumbbell','Biceps','Forearms','Isolation','weight','reps','DB Curl,Bicep Curl','No swinging. Control the lowering.'],
  ['barbell_curl','Barbell Curl','Biceps','Barbell','Biceps','Forearms','Isolation','weight','reps','BB Curl','Elbows pinned at the sides. The bar travels, the elbows do not.'],
  ['ez_bar_curl','EZ-Bar Curl','Biceps','Barbell','Biceps','Forearms','Isolation','weight','reps','','Kinder on the wrists than the straight bar.'],
  ['incline_dumbbell_curl','Incline Dumbbell Curl','Biceps','Dumbbell','Biceps','Forearms','Isolation','weight','reps','','Arms hang behind the body for a longer stretch.'],
  ['hammer_curl','Hammer Curl','Biceps','Dumbbell','Biceps','Forearms,Brachialis','Isolation','weight','reps','Neutral Curl','Neutral grip throughout. Builds arm thickness.'],
  ['preacher_curl','Preacher Curl','Biceps','Machine','Biceps','Forearms','Isolation','weight','reps','','Do not bounce out of the bottom.'],
  ['cable_curl','Cable Curl','Biceps','Cable','Biceps','Forearms','Isolation','weight','reps','','Constant tension. Good last exercise of an arm day.'],
  ['concentration_curl','Concentration Curl','Biceps','Dumbbell','Biceps','Forearms','Isolation','weight','reps','','Elbow braced on the inner thigh. Peak contraction work.'],

  // ── TRICEPS ──────────────────────────────────────────────────────────────
  ['cable_pushdown','Cable Triceps Pushdown','Triceps','Cable','Triceps','','Isolation','weight','reps','Pushdown,Rope Pushdown','Elbows pinned to your sides throughout.'],
  ['overhead_cable_extension','Overhead Cable Extension','Triceps','Cable','Triceps','','Isolation','weight','reps','Overhead Rope Extension','Long-head work. Keep the ribs down.'],
  ['skull_crusher','Skull Crusher','Triceps','Barbell','Triceps','','Isolation','weight','reps','Lying Triceps Extension','Bar to the forehead or just behind it. Elbows stay pointed up.'],
  ['dumbbell_overhead_extension','Dumbbell Overhead Extension','Triceps','Dumbbell','Triceps','','Isolation','weight','reps','','One bell, both hands. Full stretch at the bottom.'],
  ['close_grip_bench','Close-Grip Bench Press','Triceps','Barbell','Triceps','Chest,Front Delts','Horizontal Push','weight','reps','CGBP','Hands shoulder width. Elbows tucked.'],
  ['triceps_dip','Triceps Dip','Triceps','Bodyweight','Triceps','Chest,Front Delts','Vertical Push','bodyweight','reps','Bench Dip,Parallel Bar Dip','Torso upright to keep the load on the triceps.'],
  ['kickback','Cable Kickback','Triceps','Cable','Triceps','','Isolation','weight','reps','','Upper arm stays parallel to the floor.'],

  // ── LEGS ─────────────────────────────────────────────────────────────────
  ['back_squat','Barbell Back Squat','Legs','Barbell','Quads','Glutes,Core,Lower Back','Squat','weight','reps','Squat,BB Squat','Bar on the rear shoulders. Brace before you unrack. Two seconds down.'],
  ['front_squat','Front Squat','Legs','Barbell','Quads','Core,Glutes','Squat','weight','reps','','Elbows high. The moment they drop the bar follows.'],
  ['hack_squat','Hack Squat','Legs','Machine','Quads','Glutes','Squat','weight','reps','Machine Hack Squat','Feet shoulder width on the platform. Deep but controlled.'],
  ['leg_press','Leg Press','Legs','Machine','Quads','Glutes,Hamstrings','Squat','weight','reps','45 Degree Leg Press','Feet mid-platform. The lower back stays on the pad.'],
  ['goblet_squat','Goblet Squat','Legs','Dumbbell','Quads','Glutes,Core','Squat','weight','reps','','Bell at the chest, elbows inside the knees at the bottom.'],
  ['smith_squat','Smith Machine Squat','Legs','Machine','Quads','Glutes','Squat','weight','reps','','Feet slightly forward of the bar path.'],
  ['walking_lunge','Walking Lunge','Legs','Dumbbell','Quads','Glutes,Hamstrings','Lunge','weight','reps','Lunge','Long stride, push through the front heel.'],
  ['reverse_lunge','Dumbbell Reverse Lunge','Legs','Dumbbell','Quads','Glutes,Hamstrings','Lunge','weight','reps','Step-Back Lunge','Step backwards, rear knee lightly down. Easier on the knees.'],
  ['bulgarian_split_squat','Bulgarian Split Squat','Legs','Dumbbell','Quads','Glutes,Hamstrings','Lunge','weight','reps','Rear-Foot Elevated Split Squat,RFESS','Rear foot on the bench. Torso slightly forward for more glute.'],
  ['step_up','Step-Up','Legs','Dumbbell','Quads','Glutes','Lunge','weight','reps','','Do not push off the trailing leg.'],
  ['romanian_deadlift','Romanian Deadlift','Legs','Barbell','Hamstrings','Glutes,Lower Back','Hinge','weight','reps','RDL','Push the hips back, bar stays against the legs.'],
  ['dumbbell_rdl','Dumbbell Romanian Deadlift','Legs','Dumbbell','Hamstrings','Glutes,Lower Back','Hinge','weight','reps','DB RDL','Hinge at the hips. Feel the stretch, then stand tall.'],
  ['seated_leg_curl','Seated Leg Curl','Legs','Machine','Hamstrings','Calves','Isolation','weight','reps','','Squeeze at the bottom, three seconds back.'],
  ['lying_leg_curl','Lying Leg Curl','Legs','Machine','Hamstrings','Calves','Isolation','weight','reps','','Hips stay down on the pad.'],
  ['leg_extension','Leg Extension','Legs','Machine','Quads','','Isolation','weight','reps','','One-second pause at the top. Slow on the way down.'],
  ['cable_pull_through','Cable Pull-Through','Legs','Cable','Glutes','Hamstrings,Lower Back','Hinge','weight','reps','Pull-Through','Face away from the stack. Push the hips back, then snap forward.'],
  ['adductor_machine','Adductor Machine','Legs','Machine','Adductors','','Isolation','weight','reps','Inner Thigh Machine','Control the return; do not let the pads slam.'],
  ['abductor_machine','Abductor Machine','Legs','Machine','Glutes','','Isolation','weight','reps','Outer Thigh Machine','Slight forward lean hits the glute medius harder.'],
  ['sumo_squat','Sumo Squat','Legs','Dumbbell','Quads','Glutes,Adductors','Squat','weight','reps','','Wide stance, toes out, knees track over the toes.'],

  // ── GLUTES ───────────────────────────────────────────────────────────────
  ['hip_thrust','Barbell Hip Thrust','Glutes','Barbell','Glutes','Hamstrings','Hinge','weight','reps','','Chin tucked, ribs down. Squeeze for a beat at the top.'],
  ['glute_bridge','Glute Bridge','Glutes','Bodyweight','Glutes','Hamstrings','Hinge','bodyweight','reps,time','','Drive through the heels, not the toes.'],
  ['cable_kickback','Cable Glute Kickback','Glutes','Cable','Glutes','Hamstrings','Isolation','weight','reps','','Move at the hip only. No lower-back arch.'],
  ['glute_bridge_march','Glute Bridge March','Glutes','Bodyweight','Glutes','Core','Hinge','bodyweight','reps,time','','Hips stay level as the knee comes up.'],

  // ── CALVES ───────────────────────────────────────────────────────────────
  ['standing_calf_raise','Standing Calf Raise','Calves','Machine','Calves','','Isolation','weight','reps','','Full stretch, two-second pause at the top.'],
  ['seated_calf_raise','Seated Calf Raise','Calves','Machine','Calves','','Isolation','weight','reps','','Works a different part of the calf than the standing version.'],
  ['leg_press_calf_raise','Leg Press Calf Raise','Calves','Machine','Calves','','Isolation','weight','reps','','Only the ankles move. Keep the knees soft, not locked.'],

  // ── CORE ─────────────────────────────────────────────────────────────────
  ['cable_crunch','Cable Crunch','Core','Cable','Abs','','Isolation','weight','reps','Kneeling Crunch','Curl the spine down. Do not pull with the arms.'],
  ['machine_ab_crunch','Machine Ab Crunch','Core','Machine','Abs','','Isolation','weight','reps','Ab Machine','Curl the spine, do not hinge at the hips.'],
  ['hanging_knee_raise','Hanging Knee Raise','Core','Bodyweight','Abs','Hip Flexors','Isolation','bodyweight','reps','','No swinging. Curl the pelvis up.'],
  ['hanging_leg_raise','Hanging Leg Raise','Core','Bodyweight','Abs','Hip Flexors','Isolation','bodyweight','reps','','Legs straight. Stop the moment you start to swing.'],
  ['plank','Plank','Core','Bodyweight','Abs','Core','Isolation','bodyweight','time','Front Plank','Ribs down, glutes tight. End the set when the hips sag, not when the timer does.'],
  ['side_plank','Side Plank','Core','Bodyweight','Obliques','Core','Isolation','bodyweight','time','','Stack the hips. Push the floor away from the bottom shoulder.'],
  ['dead_bug','Dead Bug','Core','Bodyweight','Abs','Core','Isolation','bodyweight','reps','','Lower back stays flat on the floor throughout.'],
  ['hollow_hold','Hollow Hold','Core','Bodyweight','Abs','Hip Flexors','Isolation','bodyweight','time','','Lower back pressed down. Lower the arms and legs only as far as you can hold it.'],
  ['ab_wheel','Ab Wheel Rollout','Core','Other','Abs','Lats,Core','Isolation','bodyweight','reps','Rollout','Ribs down. Go only as far as you can return from.'],
  ['russian_twist','Russian Twist','Core','Dumbbell','Obliques','Abs','Isolation','weight','reps','','Rotate through the ribcage, not the arms.'],
  ['pallof_press','Pallof Press','Core','Cable','Obliques','Abs','Isolation','weight','reps,time','Anti-Rotation Press','Resist the rotation. Nothing should move but the arms.'],
  ['crunch','Crunch','Core','Bodyweight','Abs','','Isolation','bodyweight','reps','Sit-Up','Curl, do not yank the neck.'],

  // ── CARDIO ───────────────────────────────────────────────────────────────
  ['incline_treadmill_walk','Incline Treadmill Walk','Cardio','Machine','Cardiovascular','Calves,Glutes','Cardio','none','time,distance','Treadmill Walk,Incline Walk','5.5 km/h at 10–12%. Hands off the rails.'],
  ['treadmill_run','Treadmill Run','Cardio','Machine','Cardiovascular','','Cardio','none','time,distance','Running','Land under the hips, not out in front.'],
  ['stair_climber','Stair Climber','Cardio','Machine','Cardiovascular','Glutes,Quads','Cardio','none','time','StairMaster,Stairs','Stand tall. Do not lean on the handles.'],
  ['stationary_bike','Stationary Bike','Cardio','Machine','Cardiovascular','Quads','Cardio','none','time,distance','Bike,Cycling','Gentlest on the joints. Set the saddle to hip height.'],
  ['rowing_machine','Rowing Machine','Cardio','Machine','Cardiovascular','Mid Back,Legs','Cardio','none','time,distance','Rower,Erg','Legs, then hips, then arms. Reverse it on the return.'],
  ['elliptical','Elliptical','Cardio','Machine','Cardiovascular','','Cardio','none','time,distance','Cross Trainer','Keep the resistance high enough that you are not coasting.'],
  ['assault_bike','Air Bike','Cardio','Machine','Cardiovascular','','Cardio','none','time,calories','Assault Bike,Echo Bike','Brutal for intervals. Pace the first round.'],
  ['jump_rope','Jump Rope','Cardio','Other','Cardiovascular','Calves','Cardio','none','time,reps','Skipping','Small jumps, wrists do the work.'],
  ['sled_push','Sled Push','Cardio','Other','Quads','Glutes,Calves','Cardio','weight','distance','Prowler Push','Low body angle, short fast steps.'],
  ['farmers_carry','Farmer\'s Carry','Full Body','Dumbbell','Forearms','Traps,Core','Carry','weight','distance,time','Loaded Carry','Shoulders back, ribs down, walk normally.'],
  ['indoor_walk','Indoor Walk','Cardio','Bodyweight','Cardiovascular','','Cardio','none','time,distance','Walking','Conversational pace the whole way.'],

  // ── FULL BODY ────────────────────────────────────────────────────────────
  ['clean_and_press','Clean and Press','Full Body','Barbell','Full Body','Shoulders,Legs,Back','Full Body','weight','reps','','Technique first. Stop the set the moment the bar path degrades.'],
  ['kettlebell_swing','Kettlebell Swing','Full Body','Kettlebell','Glutes','Hamstrings,Core,Shoulders','Hinge','weight','reps,time','KB Swing','A hinge, not a squat. The arms are ropes.'],
  ['thruster','Thruster','Full Body','Barbell','Quads','Shoulders,Triceps','Full Body','weight','reps','','Use the leg drive to start the press.'],
  ['burpee','Burpee','Full Body','Bodyweight','Full Body','Chest,Quads','Full Body','bodyweight','reps,time','','Chest to the floor, full stand at the top.'],
  ['mountain_climber','Mountain Climber','Full Body','Bodyweight','Core','Shoulders,Hip Flexors','Full Body','bodyweight','time,reps','','Hips stay low. Do not bounce.'],
  ['battle_ropes','Battle Ropes','Full Body','Other','Shoulders','Core,Cardiovascular','Full Body','none','time','','Athletic stance, breathe on a rhythm.'],
  ['box_jump','Box Jump','Full Body','Other','Quads','Glutes,Calves','Full Body','bodyweight','reps','','Step down every rep. Never rebound off a high box.']
];

const MUSCLE_SPLIT = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

/** Expand one tuple into a full exercise record. */
function expand(t) {
  return {
    id: t[0],
    name: t[1],
    aliases: MUSCLE_SPLIT(t[9]),
    category: t[2],
    primaryMuscles: MUSCLE_SPLIT(t[4]),
    secondaryMuscles: MUSCLE_SPLIT(t[5]),
    equipment: t[3],
    movementPattern: t[6],
    loadType: t[7],
    prescriptionTypes: MUSCLE_SPLIT(t[8]),
    image: { url: null, source: null, attribution: null, license: null },
    description: '',
    coachingCues: t[10] ? [t[10]] : [],
    source: 'built-in',
    builtin: true
  };
}

export const BUILTIN_EXERCISES = T.map(expand);

export const CATEGORIES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Calves', 'Core', 'Cardio', 'Full Body'
];

export const EQUIPMENT = [
  'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell',
  'Bodyweight', 'Bands', 'Other'
];

export const MUSCLES = [
  'Chest', 'Upper Chest', 'Lats', 'Mid Back', 'Lower Back', 'Traps',
  'Front Delts', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves',
  'Abs', 'Obliques', 'Core', 'Hip Flexors', 'Cardiovascular', 'Full Body'
];
