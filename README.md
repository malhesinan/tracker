# Workout Tracker — personal training log

A mobile-first, offline-first workout logger. No build step, no dependencies,
no backend. Plain HTML, CSS and ES modules.

Passcode: **9977** (set in `js/config.js`).

Exercise images come from the ExerciseDB free tier operated by AscendAPI —
a public endpoint, no key and no sign-up. Only the image links are stored;
nothing is rehosted. Download them once from **More → Exercise images**.

---

## Run it

The app uses ES modules and a service worker, so it must be served over HTTP —
opening `index.html` from the file system will not work.

**Locally**

```bash
cd workout-tracker
python3 -m http.server 8000
# then open http://localhost:8000 on your computer,
# or http://<your-computer-ip>:8000 on your iPhone (same Wi-Fi)
```

**On the internet (needed for "Add to Home Screen" to work properly)**

Any static host works. The whole folder is the site.

- Netlify: drag the folder onto https://app.netlify.com/drop
- Vercel: `npx vercel deploy --prod` inside the folder
- GitHub Pages: push the folder to a repo, Settings → Pages → deploy from branch
- Cloudflare Pages: connect the repo, no build command, output directory `/`

HTTPS is required for the service worker (except on `localhost`).

## Install on iPhone

1. Open the URL in **Safari** (Chrome on iOS cannot install web apps).
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.
4. Tap **Add**.

It now launches full screen with no browser chrome and works with no signal. The
dumbbell icon appears on the Home Screen under the name **Workout**.

## Where the data lives

Everything is stored in `localStorage` on the device, behind the `storage`
module in `js/storage.js`. Nothing is sent anywhere. Back up from
**More → Data → Export all data**.

Deleting Safari website data, or deleting the installed app, deletes the log.
Export regularly.

---

## Manual test checklist

**Exercise images**
- [ ] More → Exercise images → Download images reports how many exercises matched
- [ ] Thumbnails appear on the workout screen, exercise picker and library
- [ ] Exercise detail shows the large image with the ExerciseDB credit underneath
- [ ] Turning "Show exercise images" off falls back to the initials tiles
- [ ] An image you add yourself still shows with the setting off
- [ ] With no connection, the download fails with a clear message and nothing else breaks
- [ ] Revisit a workout offline: images seen before still appear (service worker cache)

**Lock**
- [ ] Wrong code shakes and clears; right code (9977) opens the app
- [ ] Close and relaunch → passcode asked again
- [ ] More → "Stay unlocked on this device" on → relaunch skips the passcode
- [ ] More → Lock now returns to the passcode screen

**Train**
- [ ] On a scheduled day the correct workout appears with exercise count and duration
- [ ] On a rest day the next scheduled session is shown
- [ ] Start → the workout screen opens with exercise 01 expanded
- [ ] Leave mid-workout → Train shows "IN PROGRESS" and percentage
- [ ] Tapping TRAIN in the nav during a live session goes straight back to it

**Logging**
- [ ] − and + change weight by the configured step and reps by 1
- [ ] Typing into a field keeps focus (no re-render flicker)
- [ ] Completing a set turns the row red and starts the rest timer
- [ ] Completing the last set of an exercise collapses it and opens the next
- [ ] Long-press a set number → remove set
- [ ] + SET adds a set carrying the previous values
- [ ] COPY LAST fills the fields but marks nothing done
- [ ] Last session's numbers appear as grey placeholders

**Prescription types**
- [ ] Reps exercise shows KG + REPS
- [ ] Bodyweight exercise shows REPS only
- [ ] Treadmill (20 min) shows TIME only, entered as `20:00`
- [ ] Rowing (10 × 250 m) shows DISTANCE and TIME
- [ ] A 2–3 set range renders as "2–3 ×" and lays out 3 rows

**Rest timer**
- [ ] Counts down, +30 / +60 extend, PAUSE and RESUME work, SKIP dismisses
- [ ] At zero: vibration, tone, red state — and no browser dialog
- [ ] Backgrounding the app and returning keeps the correct remaining time

**Records**
- [ ] Beating a previous top weight flags NEW PR on the row and shows a toast
- [ ] The PR also appears in the session summary and history

**Finish**
- [ ] Finish sheet shows sets / minutes / volume and optional difficulty, energy, notes
- [ ] Summary shows volume change vs the previous session of the same day
- [ ] Discard asks for confirmation and removes the session

**Program**
- [ ] Create, rename, duplicate, activate, archive, delete a programme
- [ ] Add / rename / reorder / disable / delete a workout day
- [ ] Add, edit, reorder, remove exercises
- [ ] Set and rep ranges save correctly; single number when min = max
- [ ] ADVANCED holds tempo, RPE, equipment, display name, cue, notes, image
- [ ] Search finds by name ("bench"), alias ("BB bench"), muscle ("hamstring"), equipment ("cable")
- [ ] Create a custom exercise and use it in a workout

**Versioning**
- [ ] Complete a workout, change the prescription in Program, reopen the past
      session → it still shows the old prescription

**History**
- [ ] Sessions list groups by month with consistency bars
- [ ] Exercise view shows today / previous / best, trend arrow and chart
- [ ] Chart metric switcher works (est. 1RM, top set, volume)

**Data**
- [ ] Export JSON downloads and re-imports cleanly
- [ ] Export CSV opens in a spreadsheet with one row per set
- [ ] Importing a corrupt file is rejected and changes nothing
- [ ] Reset asks for confirmation, and Restore last backup brings the data back

**Offline / PWA**
- [ ] Add to Home Screen, then enable Airplane Mode → the app still launches and logs
- [ ] Icon and name appear correctly on the Home Screen
- [ ] Safe areas respected on a notched iPhone (nothing under the home indicator)


---

## Changelog

**1.1.0**
- Renamed to Workout Tracker; new dumbbell icon across the manifest, favicon and Home Screen
- Light theme: white surfaces, near-black type, a single orange (`#F26228`) for active, complete and record states
- Exercise images via the ExerciseDB free API (AscendAPI) with per-exercise and per-prescription overrides, an on/off setting, and offline caching after first view
- Added the **PT Program**: Push / Pull / Legs / Upper / Lower across Friday–Tuesday, Wednesday steps, Thursday standalone cardio
- Storage keys moved from `redline.*` to `wt.*`, migrated automatically on first launch
- Built-in programmes are now seeded by stable id, so one you delete stays deleted
