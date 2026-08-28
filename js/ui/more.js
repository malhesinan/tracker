/* ============================================================================
   MORE — preferences, data management, app information.
   ========================================================================== */

import { el, download, longDate, num, mmss } from '../util.js';
import { APP } from '../config.js';
import { storage, storageIsPersistent } from '../storage.js';
import {
  getSettings, updateSettings, reloadFromStorage, completedSessions, getPrograms
} from '../store.js';
import { setLabel } from '../prescription.js';
import { sessionTotals, summaryStats } from '../stats.js';
import {
  topbar, field, segmented, switchRow, sheet, confirmSheet, toast, emptyState, icon
} from './components.js';

export function renderMore(root, ctx) {
  root.innerHTML = '';
  root.appendChild(topbar({ title: 'More', subtitle: 'Settings and data' }));
  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  const s = getSettings();

  /* ------------------------------------------------------------ training */
  screen.appendChild(sectionHead('Training'));

  screen.appendChild(field('Units', segmented(
    [{ label: 'KG', value: 'kg' }, { label: 'LB', value: 'lb' }],
    s.units,
    (v) => { updateSettings({ units: v }); toast(`Units set to ${v.toUpperCase()}`); }
  ), 'Applies to new prescriptions and the weight steppers.'));

  screen.appendChild(field('Weight step', segmented(
    [{ label: '1', value: 1 }, { label: '2.5', value: 2.5 }, { label: '5', value: 5 }],
    s.weightStep,
    (v) => updateSettings({ weightStep: v })
  ), 'How much the − and + buttons change the weight.'));

  /* ------------------------------------------------------------ rest */
  screen.appendChild(sectionHead('Rest timer'));
  const restCard = el('div', { class: 'card' });
  restCard.appendChild(switchRow('Start automatically', s.restAutoStart,
    (v) => updateSettings({ restAutoStart: v }),
    'Begins the moment you complete a set.'));
  restCard.appendChild(switchRow('Sound', s.restSound,
    (v) => updateSettings({ restSound: v }),
    'A short tone when rest ends. Silent switch still wins.'));
  restCard.appendChild(switchRow('Vibration', s.restVibrate,
    (v) => updateSettings({ restVibrate: v }),
    'Where the browser supports it.'));
  screen.appendChild(restCard);

  /* ------------------------------------------------------------ library */
  screen.appendChild(sectionHead('Library'));
  screen.appendChild(navCard([
    { label: 'Exercise library', hint: 'Browse, edit and create exercises', run: () => ctx.go({ tab: 'more', name: 'library' }) },
    { label: 'Programmes', hint: `${getPrograms().length} saved`, run: () => ctx.go({ tab: 'program', name: 'programList' }) }
  ]));

  /* ------------------------------------------------------------ lock */
  screen.appendChild(sectionHead('Lock screen'));
  const lockCard = el('div', { class: 'card' });
  lockCard.appendChild(switchRow('Stay unlocked on this device', s.rememberUnlock,
    (v) => { updateSettings({ rememberUnlock: v }); storage.setUnlock(true, v); },
    'Off means the passcode is asked every time the app is launched.'));
  const lockNow = el('button', { class: 'btn btn-block btn-outline', type: 'button', text: 'LOCK NOW', style: 'margin-top:12px' });
  lockNow.addEventListener('click', () => { storage.setUnlock(false, false); ctx.lock(); });
  lockCard.appendChild(lockNow);
  lockCard.appendChild(el('div', { class: 'hint', style: 'margin-top:12px', text:
    'The passcode keeps the app private on a shared phone. It is not encryption — anyone with the unlocked device and a browser console can read the stored data.' }));
  screen.appendChild(lockCard);

  /* ------------------------------------------------------------ data */
  screen.appendChild(sectionHead('Data'));
  const stats = summaryStats();
  screen.appendChild(el('div', { class: 'stat-grid', style: 'margin-bottom:14px' }, [
    cell(String(getPrograms().length), 'Programmes'),
    cell(String(stats.count), 'Workouts'),
    cell(String(stats.totalSets), 'Sets')
  ]));

  screen.appendChild(navCard([
    { label: 'Export all data', hint: 'Full JSON backup', run: exportJSON },
    { label: 'Export workout history', hint: 'CSV, one row per set', run: exportCSV },
    { label: 'Import data', hint: 'Validated before anything is replaced', run: () => importFlow(ctx) },
    { label: 'Restore last backup', hint: backupHint(), run: () => restoreBackup(ctx) },
    { label: 'Reset application', hint: 'Delete everything on this device', danger: true, run: () => resetFlow(ctx) }
  ]));

  /* ------------------------------------------------------------ about */
  screen.appendChild(sectionHead('About'));
  const about = el('div', { class: 'card' });
  about.appendChild(kv('Version', `${APP.name} ${APP.version}`));
  about.appendChild(kv('Data schema', `v${APP.schemaVersion}`));
  about.appendChild(kv('Storage', storageIsPersistent() ? 'On this device' : 'Memory only — private mode'));
  about.appendChild(kv('Offline', navigator.onLine ? 'Online' : 'Offline — app still works'));
  screen.appendChild(about);

  const install = el('button', { class: 'btn btn-block btn-outline', type: 'button', text: 'INSTALL ON IPHONE', style: 'margin-top:12px' });
  install.addEventListener('click', showInstall);
  screen.appendChild(install);

  screen.appendChild(el('div', { class: 'attribution', style: 'margin-top:22px' }, [
    el('div', { text: 'Exercise images are optional. Nothing is fetched from a third party unless you add a URL yourself, and any attribution and licence you enter is stored alongside it.' })
  ]));
}

/* ------------------------------------------------------------- helpers */
function sectionHead(text) {
  return el('div', { class: 'section-head' }, [el('div', { class: 'eyebrow', text })]);
}

function cell(v, k) {
  return el('div', { class: 'cell' }, [el('div', { class: 'v num', text: v }), el('div', { class: 'k', text: k })]);
}

function kv(k, v) {
  return el('div', { class: 'kv' }, [el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })]);
}

function navCard(items) {
  const card = el('div', { class: 'card flush' });
  items.forEach((it) => {
    const b = el('button', { class: 'list-item', type: 'button' }, [
      el('div', { class: 'grow' }, [
        el('div', { class: 'h3', text: it.label, style: it.danger ? 'color:var(--accent-bright)' : '' }),
        el('div', { class: 'tiny dim', text: it.hint })
      ]),
      el('span', { class: 'chev', text: '›' })
    ]);
    b.addEventListener('click', it.run);
    card.appendChild(b);
  });
  return card;
}

function backupHint() {
  const b = storage.loadBackup();
  return b ? `Taken ${longDate(b.takenAt)} · ${b.reason}` : 'No backup yet';
}

/* --------------------------------------------------------------- export */
function exportJSON() {
  const data = storage.exportAll();
  const stamp = new Date().toISOString().slice(0, 10);
  download(`redline-backup-${stamp}.json`, JSON.stringify(data, null, 2));
  toast('Export ready');
}

function exportCSV() {
  const rows = [[
    'date', 'time', 'programme', 'workout', 'exercise', 'set',
    'weight', 'unit', 'reps', 'time_seconds', 'distance', 'distance_unit',
    'prescribed_sets', 'prescribed_target', 'rest_seconds', 'pr'
  ]];

  completedSessions().forEach((s) => {
    const d = new Date(s.startedAt);
    const date = d.toISOString().slice(0, 10);
    const time = d.toTimeString().slice(0, 5);
    (s.logs || []).forEach((log) => {
      const rx = log.prescription || {};
      const sets = (log.sets || []).filter((x) => x.done);
      sets.forEach((set, i) => {
        rows.push([
          date, time, s.programName, s.dayName, log.name, i + 1,
          set.weight === null || set.weight === undefined ? '' : set.weight,
          (rx.load && rx.load.unit) || '',
          set.reps === null || set.reps === undefined ? '' : set.reps,
          set.timeSec || '',
          set.distance || '',
          (rx.target && rx.target.unit) || '',
          rx.sets ? (rx.sets.min === rx.sets.max ? rx.sets.min : `${rx.sets.min}-${rx.sets.max}`) : '',
          rx.target ? (rx.target.min === rx.target.max ? rx.target.min : `${rx.target.min}-${rx.target.max}`) : '',
          rx.restSec === undefined ? '' : rx.restSec,
          (set.prs || []).join('|')
        ]);
      });
    });
  });

  if (rows.length === 1) { toast('No completed workouts to export', 'warn'); return; }

  const csv = rows.map((r) => r.map((cellValue) => {
    const v = String(cellValue === null || cellValue === undefined ? '' : cellValue);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',')).join('\n');

  const stamp = new Date().toISOString().slice(0, 10);
  download(`redline-history-${stamp}.csv`, csv, 'text/csv');
  toast(`Exported ${rows.length - 1} sets`);
}

/* --------------------------------------------------------------- import */
function importFlow(ctx) {
  const input = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let payload;
      try {
        payload = JSON.parse(String(reader.result));
      } catch (e) {
        showImportResult({ ok: false, errors: ['The file is not valid JSON.'], warnings: [], counts: {} }, null, ctx);
        return;
      }
      const result = storage.validateImport(payload);
      showImportResult(result, payload, ctx);
    };
    reader.onerror = () => toast('Could not read the file', 'warn');
    reader.readAsText(file);
  });
  input.click();
}

function showImportResult(result, payload, ctx) {
  const body = el('div', {});

  if (!result.ok) {
    body.appendChild(el('div', { class: 'h2', style: 'color:var(--accent-bright);margin-bottom:12px', text: 'Import rejected' }));
    body.appendChild(el('p', { class: 'small muted', style: 'margin-bottom:12px', text: 'Nothing on this device has been changed.' }));
    result.errors.forEach((e) => body.appendChild(el('div', { class: 'cue', style: 'margin-bottom:8px', text: e })));
    sheet({ title: 'Import', body, actions: [{ label: 'Close', onClick: ({ close }) => close() }] });
    return;
  }

  body.appendChild(el('div', { class: 'stat-grid', style: 'margin-bottom:16px' }, [
    cell(String(result.counts.programs), 'Programmes'),
    cell(String(result.counts.sessions), 'Workouts'),
    cell(String(result.counts.exercises), 'Exercises')
  ]));
  result.warnings.forEach((w) => body.appendChild(el('div', { class: 'cue', style: 'margin-bottom:8px', text: w })));
  body.appendChild(el('p', { class: 'small muted', style: 'line-height:1.6', text:
    'Replace overwrites everything currently on this device. Merge keeps what you have and only adds records that are not already here. Either way a backup of the current data is written first.' }));

  sheet({
    title: 'Import data',
    body,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Merge',
        onClick: ({ close }) => {
          storage.applyMerge(payload);
          reloadFromStorage();
          close();
          toast('Merged');
          ctx.rerender();
        }
      },
      {
        label: 'Replace',
        variant: 'btn-primary',
        onClick: ({ close }) => {
          close();
          confirmSheet({
            title: 'Replace all data',
            message: 'Everything currently stored on this device will be replaced by the file contents.',
            confirmLabel: 'Replace',
            onConfirm: () => {
              storage.applyImport(payload);
              reloadFromStorage();
              toast('Data replaced');
              ctx.rerender();
            }
          });
        }
      }
    ]
  });
}

function restoreBackup(ctx) {
  const backup = storage.loadBackup();
  if (!backup) { toast('No backup available', 'warn'); return; }
  confirmSheet({
    title: 'Restore backup',
    message: `Restore the snapshot taken on ${longDate(backup.takenAt)} (${backup.reason}). Current data is backed up first.`,
    confirmLabel: 'Restore',
    onConfirm: () => {
      storage.applyImport(backup.data);
      reloadFromStorage();
      toast('Backup restored');
      ctx.rerender();
    }
  });
}

function resetFlow(ctx) {
  confirmSheet({
    title: 'Reset application',
    message: 'Every programme, workout and custom exercise on this device will be deleted. A backup is written first and can be restored from this screen. Export first if the data matters.',
    confirmLabel: 'Delete everything',
    onConfirm: () => {
      storage.resetAll();
      reloadFromStorage();
      toast('Application reset');
      ctx.go({ tab: 'train', name: 'today' });
    }
  });
}

/* -------------------------------------------------------------- install */
function showInstall() {
  const body = el('div', {});
  const steps = [
    ['1', 'Open the app in Safari', 'Chrome on iOS cannot install web apps.'],
    ['2', 'Tap the Share button', 'The square with an arrow, in the toolbar.'],
    ['3', 'Choose "Add to Home Screen"', 'Scroll down the share sheet if you do not see it.'],
    ['4', 'Tap Add', 'REDLINE now launches full screen with no browser chrome, and works with no signal.']
  ];
  steps.forEach(([n, title, hint]) => {
    body.appendChild(el('div', { class: 'row', style: 'align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border)' }, [
      el('div', { class: 'num', style: 'font-size:13px;font-weight:800;color:var(--accent);width:24px', text: n }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'h3', text: title }),
        el('div', { class: 'tiny dim', style: 'margin-top:4px', text: hint })
      ])
    ]));
  });
  sheet({ title: 'Install on iPhone', body, actions: [{ label: 'Got it', variant: 'btn-primary', onClick: ({ close }) => close() }] });
}
