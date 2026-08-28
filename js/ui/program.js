/* ============================================================================
   PROGRAM — build mode.
   Powerful, but progressive: four fields on the first screen, everything else
   behind ADVANCED.
   ========================================================================== */

import { el, num, restLabel, esc, haptic } from '../util.js';
import { WEEKDAYS, WEEKDAYS_SHORT } from '../config.js';
import { CATEGORIES, EQUIPMENT, MUSCLES } from '../data/exercises.js';
import {
  getPrograms, getProgram, getDay, createProgram, updateProgram, duplicateProgram,
  activateProgram, archiveProgram, deleteProgram,
  addDay, updateDay, deleteDay, moveDay,
  addPrescription, updatePrescription, removePrescription, movePrescription,
  searchExercises, recentExerciseIds, getExercise, createExercise, saveExercise,
  deleteCustomExercise, getSettings
} from '../store.js';
import {
  prescriptionLabel, smartDefaults, normalisePrescription,
  TARGET_TYPES, LOAD_TYPES
} from '../prescription.js';
import {
  icon, iconButton, sheet, confirmSheet, promptSheet, toast, topbar,
  field, segmented, emptyState, switchRow
} from './components.js';

/* ========================================================== PROGRAMME LIST */
export function renderProgramList(root, ctx, params = {}) {
  root.innerHTML = '';
  root.appendChild(topbar({ title: 'Program', subtitle: 'Build mode' }));
  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  const programs = getPrograms();

  screen.appendChild(el('div', { class: 'section-head' }, [
    el('div', { class: 'eyebrow', text: 'My programmes' }),
    el('button', { class: 'btn btn-sm btn-outline', type: 'button', text: '+ NEW', onclick: () => newProgram(ctx) })
  ]));

  if (!programs.length) {
    screen.appendChild(emptyState({
      title: 'No programme',
      message: 'Build your first programme. Create your workout days, add exercises and start training.',
      actionLabel: 'Create programme',
      onAction: () => newProgram(ctx)
    }));
    if (params.createNow) newProgram(ctx);
    return;
  }

  const active = programs.filter((p) => p.status !== 'archived');
  const archived = programs.filter((p) => p.status === 'archived');

  const card = el('div', { class: 'card flush' });
  active.forEach((p) => card.appendChild(programRow(p, ctx)));
  screen.appendChild(card);

  if (archived.length) {
    screen.appendChild(el('div', { class: 'month-label', text: 'Archived' }));
    const arc = el('div', { class: 'card flush' });
    archived.forEach((p) => arc.appendChild(programRow(p, ctx)));
    screen.appendChild(arc);
  }

  if (params.createNow) newProgram(ctx);
}

function programRow(p, ctx) {
  const days = p.days.filter((d) => d.enabled !== false).length;
  const item = el('button', { class: 'list-item', type: 'button' }, [
    el('div', { class: `dot ${p.status === 'active' ? 'on' : ''}` }),
    el('div', { class: 'grow' }, [
      el('div', { class: 'h3', text: p.name }),
      el('div', { class: 'tiny dim', text: `${days} days / week${p.status === 'active' ? ' · ACTIVE' : p.status === 'archived' ? ' · ARCHIVED' : ''}` })
    ]),
    el('span', { class: 'chev', text: '›' })
  ]);
  item.addEventListener('click', () => ctx.go({ tab: 'program', name: 'programDetail', programId: p.id }));
  return item;
}

function newProgram(ctx) {
  promptSheet({
    title: 'New programme',
    label: 'Programme name',
    placeholder: 'Hypertrophy',
    confirmLabel: 'Create',
    onSubmit: (name) => {
      const p = createProgram(name);
      ctx.go({ tab: 'program', name: 'programDetail', programId: p.id });
    }
  });
}

/* ======================================================== PROGRAMME DETAIL */
export function renderProgramDetail(root, ctx, params) {
  const program = getProgram(params.programId);
  if (!program) { ctx.go({ tab: 'program', name: 'programList' }); return; }

  root.innerHTML = '';
  const bar = topbar({
    title: program.name,
    subtitle: program.status === 'active' ? 'Active programme' : program.status,
    onBack: () => ctx.go({ tab: 'program', name: 'programList' })
  });
  bar.appendChild(iconButton('dots', 'Programme options', () => programMenu(program, ctx)));
  root.appendChild(bar);

  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  if (program.status !== 'active') {
    const act = el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'MAKE THIS MY ACTIVE PROGRAMME' });
    act.addEventListener('click', () => { activateProgram(program.id); toast('Activated'); ctx.rerender(); });
    screen.appendChild(act);
    screen.appendChild(el('div', { class: 'spacer' }));
  }

  screen.appendChild(el('div', { class: 'row between' }, [
    el('div', { class: 'eyebrow', text: `${program.days.length} DAYS` }),
    el('div', { class: 'eyebrow', text: `V${program.version || 1}` })
  ]));
  screen.appendChild(el('div', { class: 'rule', style: 'margin-top:10px' }));

  if (!program.days.length) {
    screen.appendChild(emptyState({
      title: 'No days yet',
      message: 'Add your first workout day, then fill it with exercises.',
      actionLabel: 'Add workout day',
      onAction: () => dayEditorSheet(program, null, ctx)
    }));
    return;
  }

  program.days.forEach((day, i) => {
    const block = el('div', { class: `day-block ${day.enabled === false ? 'rest' : 'active'}` });

    block.appendChild(el('div', { class: 'row between' }, [
      el('div', { class: 'eyebrow accent', text: day.dayOfWeek === null || day.dayOfWeek === undefined ? 'UNSCHEDULED' : WEEKDAYS[day.dayOfWeek].toUpperCase() }),
      el('div', { class: 'row', style: 'gap:2px' }, [
        arrowBtn('up', i === 0, () => { moveDay(program.id, day.id, -1); ctx.rerender(); }),
        arrowBtn('down', i === program.days.length - 1, () => { moveDay(program.id, day.id, 1); ctx.rerender(); })
      ])
    ]));

    block.appendChild(el('div', { class: 'h1', style: 'margin:4px 0 2px', text: day.name }));
    if (day.subtitle) block.appendChild(el('div', { class: 'small muted', text: day.subtitle }));
    block.appendChild(el('div', { class: 'tiny dim', style: 'margin-top:6px', text: `${day.exercises.length} exercises · ~${day.estMinutes || 60} min${day.enabled === false ? ' · DISABLED' : ''}` }));

    const row = el('div', { class: 'row', style: 'margin-top:12px;gap:8px' });
    const edit = el('button', { class: 'btn btn-sm btn-outline', type: 'button', text: 'EDIT EXERCISES' });
    edit.addEventListener('click', () => ctx.go({ tab: 'program', name: 'dayEditor', programId: program.id, dayId: day.id }));
    const settings = el('button', { class: 'btn btn-sm btn-outline', type: 'button', text: 'DAY SETTINGS' });
    settings.addEventListener('click', () => dayEditorSheet(program, day, ctx));
    row.append(edit, settings);
    block.appendChild(row);

    screen.appendChild(block);
  });

  const add = el('button', { class: 'btn btn-block btn-outline', type: 'button', text: '+ ADD WORKOUT DAY' });
  add.addEventListener('click', () => dayEditorSheet(program, null, ctx));
  screen.appendChild(add);
}

function arrowBtn(dir, disabled, onClick) {
  const b = el('button', { class: 'icon-btn', type: 'button', 'aria-label': dir === 'up' ? 'Move up' : 'Move down' }, [icon(dir, 18)]);
  if (disabled) { b.disabled = true; b.style.opacity = '0.25'; }
  else b.addEventListener('click', onClick);
  b.style.width = '38px'; b.style.height = '38px'; b.style.minWidth = '38px';
  return b;
}

function programMenu(program, ctx) {
  const ref = {};
  const body = el('div', { class: 'card flush' });
  const item = (label, hint, run, danger) => {
    const b = el('button', { class: 'list-item', type: 'button' }, [
      el('div', { class: 'grow' }, [
        el('div', { class: 'h3', text: label, style: danger ? 'color:var(--accent-bright)' : '' }),
        el('div', { class: 'tiny dim', text: hint })
      ])
    ]);
    b.addEventListener('click', () => { ref.close(); run(); });
    body.appendChild(b);
  };

  item('Rename', 'Change the programme name', () => {
    promptSheet({
      title: 'Rename programme', label: 'Name', value: program.name,
      onSubmit: (v) => { updateProgram(program.id, { name: v }); ctx.rerender(); }
    });
  });
  item('Duplicate', 'Copy every day and exercise', () => {
    const copy = duplicateProgram(program.id);
    toast('Duplicated');
    ctx.go({ tab: 'program', name: 'programDetail', programId: copy.id });
  });
  if (program.status !== 'active') {
    item('Activate', 'Train this programme', () => { activateProgram(program.id); toast('Activated'); ctx.rerender(); });
  }
  item(program.status === 'archived' ? 'Unarchive' : 'Archive', 'Keep it without showing it in Train', () => {
    archiveProgram(program.id); ctx.rerender();
  });
  item('Delete', 'Remove the programme permanently', () => {
    confirmSheet({
      title: 'Delete programme',
      message: `"${program.name}" and all of its days will be removed. Completed workouts keep their own snapshot and stay in History. A backup is written first.`,
      confirmLabel: 'Delete',
      onConfirm: () => { deleteProgram(program.id); ctx.go({ tab: 'program', name: 'programList' }); }
    });
  }, true);

  const s = sheet({ title: program.name, body });
  ref.close = s.close;
}

/* ------------------------------------------------------------ day sheet */
function dayEditorSheet(program, day, ctx) {
  const isNew = !day;
  const draft = day ? { ...day } : { name: '', subtitle: '', dayOfWeek: null, estMinutes: 60, notes: '', enabled: true };

  const body = el('div', {});

  const nameInput = el('input', { class: 'input', type: 'text', value: draft.name, placeholder: 'Lower A' });
  body.appendChild(field('Workout name', nameInput));

  const subInput = el('input', { class: 'input', type: 'text', value: draft.subtitle || '', placeholder: 'Squat-led · heaviest session' });
  body.appendChild(field('Description', subInput));

  const dayChips = el('div', { class: 'chips' });
  const setDay = (v) => {
    draft.dayOfWeek = v;
    Array.from(dayChips.children).forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.v) === v && v !== null || (c.dataset.v === 'null' && v === null))));
  };
  WEEKDAYS_SHORT.forEach((d, i) => {
    const c = el('button', { class: 'chip', type: 'button', text: d, 'aria-pressed': draft.dayOfWeek === i ? 'true' : 'false' });
    c.dataset.v = String(i);
    c.addEventListener('click', () => setDay(i));
    dayChips.appendChild(c);
  });
  const none = el('button', { class: 'chip', type: 'button', text: 'NONE', 'aria-pressed': draft.dayOfWeek === null ? 'true' : 'false' });
  none.dataset.v = 'null';
  none.addEventListener('click', () => setDay(null));
  dayChips.appendChild(none);
  body.appendChild(field('Day of week', dayChips, 'The Train screen shows the day that matches today.'));

  const minsInput = el('input', { class: 'input', type: 'number', inputmode: 'numeric', value: String(draft.estMinutes || 60), min: '5', step: '5' });
  body.appendChild(field('Estimated duration (minutes)', minsInput));

  const notesInput = el('textarea', { class: 'textarea', placeholder: 'Warm-up protocol, reminders, anything to see before you start.' });
  notesInput.value = draft.notes || '';
  body.appendChild(field('Notes', notesInput));

  if (!isNew) {
    body.appendChild(switchRow('Enabled', draft.enabled !== false, (v) => { draft.enabled = v; },
      'Disabled days stay in the programme but never appear in Train.'));
    const del = el('button', { class: 'btn btn-danger btn-block', type: 'button', text: 'DELETE THIS DAY', style: 'margin-top:20px' });
    del.addEventListener('click', () => {
      ref.close();
      confirmSheet({
        title: 'Delete day',
        message: `"${day.name}" and its ${day.exercises.length} exercises will be removed from this programme. Past sessions are unaffected.`,
        confirmLabel: 'Delete',
        onConfirm: () => { deleteDay(program.id, day.id); ctx.rerender(); }
      });
    });
    body.appendChild(del);
  }

  const ref = sheet({
    title: isNew ? 'New workout day' : 'Day settings',
    body,
    tall: true,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: isNew ? 'Create' : 'Save',
        variant: 'btn-primary',
        onClick: ({ close }) => {
          const patch = {
            name: nameInput.value.trim() || 'Untitled',
            subtitle: subInput.value.trim(),
            dayOfWeek: draft.dayOfWeek,
            estMinutes: Number(minsInput.value) || 60,
            notes: notesInput.value.trim(),
            enabled: draft.enabled !== false
          };
          if (isNew) {
            const d = addDay(program.id, patch);
            close();
            ctx.go({ tab: 'program', name: 'dayEditor', programId: program.id, dayId: d.id });
          } else {
            updateDay(program.id, day.id, patch);
            close();
            ctx.rerender();
          }
        }
      }
    ]
  });
}

/* ============================================================ DAY EDITOR */
export function renderDayEditor(root, ctx, params) {
  const program = getProgram(params.programId);
  const day = getDay(params.programId, params.dayId);
  if (!program || !day) { ctx.go({ tab: 'program', name: 'programList' }); return; }

  root.innerHTML = '';
  const bar = topbar({
    title: day.name,
    subtitle: program.name,
    onBack: () => ctx.go({ tab: 'program', name: 'programDetail', programId: program.id })
  });
  bar.appendChild(iconButton('edit', 'Day settings', () => dayEditorSheet(program, day, ctx)));
  root.appendChild(bar);

  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  if (!day.exercises.length) {
    screen.appendChild(emptyState({
      title: 'No exercises',
      message: 'Add the movements for this day. Sets, targets and rest all have sensible defaults you can change.',
      actionLabel: 'Add exercise',
      onAction: () => openPicker(program, day, ctx)
    }));
    return;
  }

  const list = el('div', { class: 'stack' });
  day.exercises.forEach((rx, i) => {
    const ex = getExercise(rx.exerciseId);
    const card = el('div', { class: 'card' });

    const top = el('div', { class: 'row', style: 'align-items:flex-start' }, [
      el('div', { class: 'idx num', style: 'font-size:13px;font-weight:800;color:var(--text-dim);width:24px', text: String(i + 1).padStart(2, '0') }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'h2', text: rx.displayName || ex.name }),
        el('div', { class: 'tiny dim', style: 'margin-top:3px;letter-spacing:.1em;text-transform:uppercase', text: `${ex.category} · ${rx.equipmentOverride || ex.equipment}` }),
        el('div', { class: 'row', style: 'gap:14px;margin-top:8px' }, [
          el('div', { class: 'small num', text: prescriptionLabel(rx) }),
          el('div', { class: 'small dim num', text: `REST ${restLabel(rx.restSec)}` })
        ])
      ])
    ]);
    card.appendChild(top);

    const actions = el('div', { class: 'row', style: 'margin-top:14px;gap:6px' }, [
      el('button', { class: 'btn btn-sm btn-outline grow', type: 'button', text: 'EDIT', onclick: () => prescriptionSheet(program, day, rx, ctx) }),
      arrowBtn('up', i === 0, () => { movePrescription(program.id, day.id, rx.id, -1); ctx.rerender(); }),
      arrowBtn('down', i === day.exercises.length - 1, () => { movePrescription(program.id, day.id, rx.id, 1); ctx.rerender(); }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove exercise', style: 'width:38px;height:38px;min-width:38px', onclick: () => {
        confirmSheet({
          title: 'Remove exercise',
          message: `Remove ${rx.displayName || ex.name} from ${day.name}?`,
          confirmLabel: 'Remove',
          onConfirm: () => { removePrescription(program.id, day.id, rx.id); ctx.rerender(); }
        });
      } }, [icon('trash', 18)])
    ]);
    card.appendChild(actions);
    list.appendChild(card);
  });
  screen.appendChild(list);

  const add = el('button', { class: 'btn btn-block btn-primary', type: 'button', text: '+ ADD EXERCISE', style: 'margin-top:20px' });
  add.addEventListener('click', () => openPicker(program, day, ctx));
  screen.appendChild(add);
}

/* ======================================================== EXERCISE PICKER */
export function openPicker(program, day, ctx, onPick) {
  const body = el('div', {});
  let category = null;
  let query = '';

  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search name, muscle or equipment', 'aria-label': 'Search exercises' });
  const searchWrap = el('div', { class: 'search-wrap' }, [icon('search'), search]);
  body.appendChild(searchWrap);

  const catRow = el('div', { class: 'chips scroll', style: 'margin-top:14px' });
  const allChip = el('button', { class: 'chip', type: 'button', text: 'ALL', 'aria-pressed': 'true' });
  allChip.addEventListener('click', () => { category = null; syncChips(); draw(); });
  catRow.appendChild(allChip);
  CATEGORIES.forEach((c) => {
    const chip = el('button', { class: 'chip', type: 'button', text: c.toUpperCase(), 'aria-pressed': 'false' });
    chip.dataset.cat = c;
    chip.addEventListener('click', () => { category = category === c ? null : c; syncChips(); draw(); });
    catRow.appendChild(chip);
  });
  body.appendChild(catRow);

  function syncChips() {
    allChip.setAttribute('aria-pressed', category === null ? 'true' : 'false');
    Array.from(catRow.children).forEach((c) => {
      if (c.dataset.cat) c.setAttribute('aria-pressed', c.dataset.cat === category ? 'true' : 'false');
    });
  }

  const results = el('div', { style: 'margin-top:16px' });
  body.appendChild(results);

  const pick = (ex) => {
    ref.close();
    if (onPick) { onPick(ex); return; }
    const rx = smartDefaults(ex, getSettings().units);
    prescriptionSheet(program, day, rx, ctx, true);
  };

  function draw() {
    results.innerHTML = '';

    if (!query && !category) {
      const recents = recentExerciseIds(5);
      if (recents.length) {
        results.appendChild(el('div', { class: 'eyebrow', style: 'margin-bottom:8px', text: 'Recent' }));
        const rc = el('div', { class: 'card flush', style: 'margin-bottom:18px' });
        recents.forEach((id) => rc.appendChild(exerciseRow(getExercise(id), pick)));
        results.appendChild(rc);
      }
    }

    const list = searchExercises(query, category);
    results.appendChild(el('div', { class: 'eyebrow', style: 'margin-bottom:8px', text: `${list.length} exercises` }));

    if (!list.length) {
      results.appendChild(emptyState({
        title: 'No exercises found',
        message: 'Try another search or create your own exercise.',
        actionLabel: 'Create exercise',
        onAction: () => { ref.close(); exerciseEditor(null, ctx, (created) => pick(created)); }
      }));
      return;
    }

    const card = el('div', { class: 'card flush' });
    list.slice(0, 200).forEach((ex) => card.appendChild(exerciseRow(ex, pick)));
    results.appendChild(card);
  }

  search.addEventListener('input', (e) => { query = e.target.value; draw(); });
  draw();

  const ref = sheet({
    title: 'Add exercise',
    body,
    tall: true,
    actions: [
      { label: 'Create new exercise', onClick: ({ close }) => { close(); exerciseEditor(null, ctx, (created) => pick(created)); } }
    ]
  });
}

function exerciseRow(ex, onPick) {
  const item = el('button', { class: 'list-item', type: 'button' }, [
    el('div', { class: 'thumb' }, [
      ex.image && ex.image.url
        ? el('img', { src: ex.image.url, alt: '', loading: 'lazy' })
        : el('span', { text: ex.name.slice(0, 2).toUpperCase() })
    ]),
    el('div', { class: 'grow' }, [
      el('div', { class: 'h3', text: ex.name }),
      el('div', { class: 'tiny dim', text: `${ex.category} · ${ex.equipment}${ex.builtin === false ? ' · CUSTOM' : ''}` })
    ]),
    el('span', { class: 'chev', text: '›' })
  ]);
  item.addEventListener('click', () => onPick(ex));
  return item;
}

/* =================================================== PRESCRIPTION EDITOR */
export function prescriptionSheet(program, day, rxInput, ctx, isNew = false) {
  const rx = JSON.parse(JSON.stringify(rxInput));
  const ex = getExercise(rx.exerciseId);
  const body = el('div', {});
  let advancedOpen = false;

  /* --- exercise line --- */
  const exLine = el('button', { class: 'list-item', type: 'button', style: 'border:1px solid var(--border);border-radius:var(--r);margin-bottom:20px' }, [
    el('div', { class: 'thumb' }, [el('span', { text: ex.name.slice(0, 2).toUpperCase() })]),
    el('div', { class: 'grow' }, [
      el('div', { class: 'h3', text: rx.displayName || ex.name }),
      el('div', { class: 'tiny dim', text: `${ex.category} · ${rx.equipmentOverride || ex.equipment}` })
    ]),
    el('span', { class: 'tiny accent-text', text: 'DETAILS' })
  ]);
  exLine.addEventListener('click', () => exerciseDetailSheet(ex));
  body.appendChild(exLine);

  /* --- sets --- */
  const setsWrap = el('div', {});
  let setsRange = rx.sets.min !== rx.sets.max;
  const setMin = numberInput(rx.sets.min, 1, 20, 1);
  const setMax = numberInput(rx.sets.max, 1, 20, 1);

  const setsGrid = el('div', {});
  function drawSets() {
    setsGrid.innerHTML = '';
    if (setsRange) {
      setsGrid.appendChild(el('div', { class: 'pair' }, [
        labelled('Minimum', setMin), labelled('Maximum', setMax)
      ]));
    } else {
      setsGrid.appendChild(setMin);
    }
  }
  drawSets();

  const setsToggle = el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: setsRange ? 'USE ONE NUMBER' : 'USE A RANGE' });
  setsToggle.addEventListener('click', () => {
    setsRange = !setsRange;
    if (!setsRange) setMax.value = setMin.value;
    setsToggle.textContent = setsRange ? 'USE ONE NUMBER' : 'USE A RANGE';
    drawSets();
  });
  setsWrap.appendChild(el('div', { class: 'row between', style: 'margin-bottom:7px' }, [
    el('div', { class: 'field-label', style: 'margin:0', text: 'Sets' }), setsToggle
  ]));
  setsWrap.appendChild(setsGrid);
  body.appendChild(el('div', { class: 'field' }, [setsWrap]));

  /* --- target --- */
  const targetWrap = el('div', {});
  let targetRange = rx.target.min !== rx.target.max;
  const tMin = numberInput(rx.target.min, 0, 100000, 0.5);
  const tMax = numberInput(rx.target.max, 0, 100000, 0.5);
  const unitSelect = el('select', { class: 'select' });

  const typeSeg = segmented(
    Object.values(TARGET_TYPES).map((t) => ({ label: t.label, value: t.key })),
    rx.target.type,
    (v) => { rx.target.type = v; drawTargetUnits(); }
  );

  const targetGrid = el('div', { style: 'margin-top:12px' });
  const unitField = el('div', { style: 'margin-top:12px' });

  function drawTargetUnits() {
    const type = TARGET_TYPES[rx.target.type];
    unitField.innerHTML = '';
    if (type.units.length > 1) {
      unitSelect.innerHTML = '';
      type.units.forEach((u) => {
        const o = el('option', { value: u, text: u });
        if (u === rx.target.unit) o.selected = true;
        unitSelect.appendChild(o);
      });
      if (!type.units.includes(rx.target.unit)) rx.target.unit = type.units[0];
      unitSelect.value = rx.target.unit;
      unitField.appendChild(labelled('Unit', unitSelect));
    } else {
      rx.target.unit = type.units[0];
    }
  }

  function drawTarget() {
    targetGrid.innerHTML = '';
    if (targetRange) {
      targetGrid.appendChild(el('div', { class: 'pair' }, [labelled('Minimum', tMin), labelled('Maximum', tMax)]));
    } else {
      targetGrid.appendChild(tMin);
    }
  }
  drawTarget();
  drawTargetUnits();

  const targetToggle = el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: targetRange ? 'USE ONE NUMBER' : 'USE A RANGE' });
  targetToggle.addEventListener('click', () => {
    targetRange = !targetRange;
    if (!targetRange) tMax.value = tMin.value;
    targetToggle.textContent = targetRange ? 'USE ONE NUMBER' : 'USE A RANGE';
    drawTarget();
  });

  targetWrap.appendChild(el('div', { class: 'row between', style: 'margin-bottom:7px' }, [
    el('div', { class: 'field-label', style: 'margin:0', text: 'Target' }), targetToggle
  ]));
  targetWrap.append(typeSeg, targetGrid, unitField);
  body.appendChild(el('div', { class: 'field' }, [targetWrap]));

  /* --- rest --- */
  const restInput = numberInput(rx.restSec, 0, 900, 15);
  const restPresets = el('div', { class: 'chips scroll', style: 'margin-top:10px' });
  [0, 45, 60, 90, 120, 150, 180].forEach((sec) => {
    const c = el('button', { class: 'chip', type: 'button', text: sec === 0 ? 'NONE' : restLabel(sec) });
    c.addEventListener('click', () => { restInput.value = String(sec); haptic(6); });
    restPresets.appendChild(c);
  });
  body.appendChild(field('Rest (seconds)', el('div', {}, [restInput, restPresets])));

  /* --- advanced --- */
  const advToggle = el('button', { class: 'btn btn-block btn-outline', type: 'button', text: 'ADVANCED' });
  const advanced = el('div', { style: 'display:none;margin-top:18px' });
  advToggle.addEventListener('click', () => {
    advancedOpen = !advancedOpen;
    advanced.style.display = advancedOpen ? 'block' : 'none';
    advToggle.textContent = advancedOpen ? 'HIDE ADVANCED' : 'ADVANCED';
  });
  body.append(advToggle, advanced);

  const loadSeg = segmented(
    Object.values(LOAD_TYPES).map((l) => ({ label: l.label.split(' ')[0], value: l.key })),
    rx.load.type,
    (v) => { rx.load.type = v; }
  );
  advanced.appendChild(field('Load type', loadSeg, 'Decides whether a weight field appears while logging.'));

  const nameInput = el('input', { class: 'input', type: 'text', value: rx.displayName || '', placeholder: ex.name });
  advanced.appendChild(field('Display name', nameInput, 'Overrides the library name in this programme only.'));

  const tempoInput = el('input', { class: 'input', type: 'text', value: rx.tempo || '', placeholder: '3-1-1' });
  advanced.appendChild(field('Tempo', tempoInput));

  const rpeInput = el('input', { class: 'input', type: 'number', inputmode: 'decimal', value: rx.rpe || '', placeholder: '8', min: '1', max: '10', step: '0.5' });
  advanced.appendChild(field('RPE target', rpeInput));

  const equipInput = el('select', { class: 'select' });
  equipInput.appendChild(el('option', { value: '', text: `Default (${ex.equipment})` }));
  EQUIPMENT.forEach((e) => {
    const o = el('option', { value: e, text: e });
    if (rx.equipmentOverride === e) o.selected = true;
    equipInput.appendChild(o);
  });
  advanced.appendChild(field('Equipment override', equipInput));

  const cueInput = el('textarea', { class: 'textarea', placeholder: ex.coachingCues[0] || 'One line you want to read between sets.' });
  cueInput.value = rx.cue || '';
  advanced.appendChild(field('Coaching cue', cueInput));

  const notesInput = el('textarea', { class: 'textarea', placeholder: 'Anything else about this exercise in this programme.' });
  notesInput.value = rx.notes || '';
  advanced.appendChild(field('Notes', notesInput));

  const imgInput = el('input', { class: 'input', type: 'url', value: (rx.image && rx.image.url) || '', placeholder: 'https://…' });
  const imgAttr = el('input', { class: 'input', type: 'text', value: (rx.image && rx.image.attribution) || '', placeholder: 'Photographer / source' });
  const imgLicense = el('input', { class: 'input', type: 'text', value: (rx.image && rx.image.license) || '', placeholder: 'e.g. CC BY 4.0' });
  advanced.appendChild(field('Image URL', imgInput, 'Optional. The app works with no images at all.'));
  advanced.appendChild(field('Image attribution', imgAttr));
  advanced.appendChild(field('Image licence', imgLicense));

  /* --- save --- */
  const ref = sheet({
    title: isNew ? 'Add exercise' : 'Edit exercise',
    body,
    tall: true,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: isNew ? 'Add' : 'Save',
        variant: 'btn-primary',
        onClick: ({ close }) => {
          rx.sets = { min: Number(setMin.value) || 1, max: setsRange ? (Number(setMax.value) || 1) : (Number(setMin.value) || 1) };
          rx.target.min = Number(tMin.value) || 0;
          rx.target.max = targetRange ? (Number(tMax.value) || 0) : (Number(tMin.value) || 0);
          if (TARGET_TYPES[rx.target.type].units.length > 1) rx.target.unit = unitSelect.value;
          rx.restSec = Number(restInput.value) || 0;
          rx.displayName = nameInput.value.trim() || null;
          rx.tempo = tempoInput.value.trim() || null;
          rx.rpe = rpeInput.value ? Number(rpeInput.value) : null;
          rx.equipmentOverride = equipInput.value || null;
          rx.cue = cueInput.value.trim() || null;
          rx.notes = notesInput.value.trim() || null;
          rx.image = imgInput.value.trim()
            ? { url: imgInput.value.trim(), source: imgInput.value.trim(), attribution: imgAttr.value.trim() || null, license: imgLicense.value.trim() || null }
            : null;

          const clean = normalisePrescription(rx);
          if (isNew) addPrescription(program.id, day.id, clean);
          else updatePrescription(program.id, day.id, rx.id, clean);
          close();
          ctx.rerender();
        }
      }
    ]
  });
}

function numberInput(value, min, max, step) {
  return el('input', {
    class: 'input num',
    type: 'number',
    inputmode: 'decimal',
    value: value === null || value === undefined ? '' : String(value),
    min: String(min), max: String(max), step: String(step)
  });
}

function labelled(text, control) {
  return el('div', {}, [el('div', { class: 'field-label', text }), control]);
}

/* ==================================================== EXERCISE DETAIL VIEW */
export function exerciseDetailSheet(ex, opts = {}) {
  const { onAdd, onEdit } = opts;
  const body = el('div', {});

  body.appendChild(el('div', { class: 'ex-image' }, [
    ex.image && ex.image.url
      ? el('img', { src: ex.image.url, alt: ex.name })
      : el('div', { class: 'ph' }, [
        el('div', { class: 'glyph', text: ex.name.slice(0, 2).toUpperCase() }),
        el('div', { class: 'tiny', style: 'margin-top:6px', text: 'NO IMAGE' })
      ])
  ]));

  body.appendChild(el('h2', { class: 'h1', text: ex.name }));
  body.appendChild(el('div', { class: 'eyebrow', style: 'margin-top:8px', text: `${ex.category} · ${ex.equipment}` }));

  if (ex.aliases && ex.aliases.length) {
    body.appendChild(el('div', { class: 'small muted', style: 'margin-top:8px', text: `Also known as ${ex.aliases.join(', ')}` }));
  }

  body.appendChild(el('div', { class: 'rule' }));

  body.appendChild(kv('Primary', (ex.primaryMuscles || []).join(', ') || '—'));
  body.appendChild(kv('Secondary', (ex.secondaryMuscles || []).join(', ') || '—'));
  body.appendChild(kv('Pattern', ex.movementPattern || '—'));
  body.appendChild(kv('Logged as', (ex.prescriptionTypes || []).join(', ')));

  if (ex.description) {
    body.appendChild(el('div', { class: 'eyebrow', style: 'margin-top:22px', text: 'Description' }));
    body.appendChild(el('p', { class: 'small muted', style: 'margin-top:8px;line-height:1.6', text: ex.description }));
  }

  if (ex.coachingCues && ex.coachingCues.length) {
    body.appendChild(el('div', { class: 'eyebrow', style: 'margin-top:22px', text: 'Coaching cues' }));
    ex.coachingCues.forEach((c) => body.appendChild(el('div', { class: 'cue', style: 'margin-top:10px', text: c })));
  }

  if (ex.image && ex.image.attribution) {
    body.appendChild(el('div', { class: 'attribution', style: 'margin-top:20px', text: `Image: ${ex.image.attribution}${ex.image.license ? ` · ${ex.image.license}` : ''}` }));
  }

  const actions = [{ label: 'Close', onClick: ({ close }) => close() }];
  if (onEdit) actions.push({ label: 'Edit', onClick: ({ close }) => { close(); onEdit(ex); } });
  if (onAdd) actions.push({ label: 'Add to workout', variant: 'btn-primary', onClick: ({ close }) => { close(); onAdd(ex); } });

  return sheet({ title: 'Exercise', body, tall: true, actions });
}

function kv(k, v) {
  return el('div', { class: 'kv' }, [el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })]);
}

/* ================================================== CUSTOM EXERCISE EDITOR */
export function exerciseEditor(existing, ctx, onSaved) {
  const ex = existing || {
    name: '', category: 'Chest', equipment: 'Dumbbell', primaryMuscles: [], secondaryMuscles: [],
    movementPattern: '', loadType: 'weight', prescriptionTypes: ['reps'], aliases: [],
    description: '', coachingCues: [], image: { url: null, attribution: null, license: null, source: null }
  };
  const body = el('div', {});

  const name = el('input', { class: 'input', type: 'text', value: ex.name, placeholder: 'Cable Fly' });
  body.appendChild(field('Name', name));

  const cat = el('select', { class: 'select' });
  CATEGORIES.forEach((c) => {
    const o = el('option', { value: c, text: c });
    if (c === ex.category) o.selected = true;
    cat.appendChild(o);
  });
  body.appendChild(field('Category', cat));

  const equip = el('select', { class: 'select' });
  EQUIPMENT.forEach((e) => {
    const o = el('option', { value: e, text: e });
    if (e === ex.equipment) o.selected = true;
    equip.appendChild(o);
  });
  body.appendChild(field('Equipment', equip));

  const primary = el('select', { class: 'select' });
  MUSCLES.forEach((m) => {
    const o = el('option', { value: m, text: m });
    if ((ex.primaryMuscles || [])[0] === m) o.selected = true;
    primary.appendChild(o);
  });
  body.appendChild(field('Primary muscle', primary));

  const secondary = el('input', { class: 'input', type: 'text', value: (ex.secondaryMuscles || []).join(', '), placeholder: 'Triceps, Front Delts' });
  body.appendChild(field('Secondary muscles', secondary, 'Comma separated.'));

  const aliases = el('input', { class: 'input', type: 'text', value: (ex.aliases || []).join(', '), placeholder: 'Cable Crossover' });
  body.appendChild(field('Aliases', aliases, 'Extra names that should find this exercise in search.'));

  let loadType = ex.loadType || 'weight';
  body.appendChild(field('Load type', segmented(
    Object.values(LOAD_TYPES).map((l) => ({ label: l.label.split(' ')[0], value: l.key })),
    loadType, (v) => { loadType = v; }
  )));

  let targetType = (ex.prescriptionTypes || ['reps'])[0];
  body.appendChild(field('Logged as', segmented(
    Object.values(TARGET_TYPES).map((t) => ({ label: t.label, value: t.key })),
    targetType, (v) => { targetType = v; }
  )));

  const desc = el('textarea', { class: 'textarea', placeholder: 'How the movement is performed.' });
  desc.value = ex.description || '';
  body.appendChild(field('Description', desc));

  const cue = el('input', { class: 'input', type: 'text', value: (ex.coachingCues || [])[0] || '', placeholder: 'Elbows soft, squeeze at the front.' });
  body.appendChild(field('Coaching cue', cue));

  const img = el('input', { class: 'input', type: 'url', value: (ex.image && ex.image.url) || '', placeholder: 'https://…' });
  const imgAttr = el('input', { class: 'input', type: 'text', value: (ex.image && ex.image.attribution) || '', placeholder: 'Source / photographer' });
  const imgLic = el('input', { class: 'input', type: 'text', value: (ex.image && ex.image.license) || '', placeholder: 'Licence' });
  body.appendChild(field('Image URL', img, 'Only add images you have the right to use. Attribution below is stored with it.'));
  body.appendChild(field('Attribution', imgAttr));
  body.appendChild(field('Licence', imgLic));

  if (existing && existing.builtin === false) {
    const del = el('button', { class: 'btn btn-danger btn-block', type: 'button', text: 'DELETE EXERCISE', style: 'margin-top:16px' });
    del.addEventListener('click', () => {
      ref.close();
      confirmSheet({
        title: 'Delete exercise',
        message: `${existing.name} will be removed from the library. Programmes and history that reference it keep their own copy of the name.`,
        confirmLabel: 'Delete',
        onConfirm: () => { deleteCustomExercise(existing.id); ctx && ctx.rerender(); }
      });
    });
    body.appendChild(del);
  }

  const ref = sheet({
    title: existing ? 'Edit exercise' : 'Create exercise',
    body,
    tall: true,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Save',
        variant: 'btn-primary',
        onClick: ({ close }) => {
          if (!name.value.trim()) { name.focus(); return; }
          const fields = {
            name: name.value.trim(),
            category: cat.value,
            equipment: equip.value,
            primaryMuscles: [primary.value],
            secondaryMuscles: secondary.value.split(',').map((s) => s.trim()).filter(Boolean),
            aliases: aliases.value.split(',').map((s) => s.trim()).filter(Boolean),
            loadType,
            prescriptionTypes: [targetType],
            movementPattern: ex.movementPattern || (targetType === 'reps' ? 'Isolation' : 'Cardio'),
            description: desc.value.trim(),
            coachingCues: cue.value.trim() ? [cue.value.trim()] : [],
            image: img.value.trim()
              ? { url: img.value.trim(), source: img.value.trim(), attribution: imgAttr.value.trim() || null, license: imgLic.value.trim() || null }
              : { url: null, source: null, attribution: null, license: null },
            source: existing && existing.builtin ? 'built-in (edited)' : 'custom'
          };
          const saved = existing ? saveExercise({ ...existing, ...fields }) : createExercise(fields);
          close();
          toast('Exercise saved');
          if (onSaved) onSaved(saved);
          else if (ctx) ctx.rerender();
        }
      }
    ]
  });
}

/* ================================================== LIBRARY BROWSER (MORE) */
export function renderLibrary(root, ctx) {
  root.innerHTML = '';
  root.appendChild(topbar({
    title: 'Exercise library',
    onBack: () => ctx.go({ tab: 'more', name: 'settings' })
  }));
  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  let query = '';
  let category = null;

  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search exercises', 'aria-label': 'Search exercises' });
  screen.appendChild(el('div', { class: 'search-wrap' }, [icon('search'), search]));

  const chips = el('div', { class: 'chips scroll', style: 'margin-top:14px' });
  const all = el('button', { class: 'chip', type: 'button', text: 'ALL', 'aria-pressed': 'true' });
  all.addEventListener('click', () => { category = null; sync(); draw(); });
  chips.appendChild(all);
  CATEGORIES.forEach((c) => {
    const chip = el('button', { class: 'chip', type: 'button', text: c.toUpperCase() });
    chip.dataset.cat = c;
    chip.addEventListener('click', () => { category = category === c ? null : c; sync(); draw(); });
    chips.appendChild(chip);
  });
  screen.appendChild(chips);

  function sync() {
    all.setAttribute('aria-pressed', category === null ? 'true' : 'false');
    Array.from(chips.children).forEach((c) => {
      if (c.dataset.cat) c.setAttribute('aria-pressed', c.dataset.cat === category ? 'true' : 'false');
    });
  }

  const create = el('button', { class: 'btn btn-block btn-outline', type: 'button', text: '+ CREATE EXERCISE', style: 'margin-top:16px' });
  create.addEventListener('click', () => exerciseEditor(null, ctx));
  screen.appendChild(create);

  const out = el('div', { style: 'margin-top:20px' });
  screen.appendChild(out);

  function draw() {
    out.innerHTML = '';
    const list = searchExercises(query, category);
    out.appendChild(el('div', { class: 'eyebrow', style: 'margin-bottom:8px', text: `${list.length} exercises` }));
    if (!list.length) {
      out.appendChild(emptyState({
        title: 'No exercises found',
        message: 'Try another search or create your own exercise.',
        actionLabel: 'Create exercise',
        onAction: () => exerciseEditor(null, ctx)
      }));
      return;
    }
    const card = el('div', { class: 'card flush' });
    list.forEach((ex) => card.appendChild(exerciseRow(ex, (picked) => {
      exerciseDetailSheet(picked, { onEdit: (target) => exerciseEditor(target, ctx) });
    })));
    out.appendChild(card);
  }

  search.addEventListener('input', (e) => { query = e.target.value; draw(); });
  draw();
}
