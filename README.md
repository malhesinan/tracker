# Workout Tracker — personal training log

A mobile-first, offline-first workout logger. No build step, no dependencies.
Plain HTML, CSS and ES modules, with optional cloud sync to Supabase.

Opening the app asks for your email and password once per device (your
Supabase account, see **Cloud sync** below). The device then stays signed in
until **More → Sign out**. Without cloud sync configured, the old passcode
screen (**9977**, set in `js/config.js`) is used instead.

Exercise images come from the ExerciseDB free tier operated by AscendAPI —
a public endpoint, no key and no sign-up. Only the image links are stored;
nothing is rehosted. Built-in exercises link to their image directly; custom
exercises are matched by downloading the catalogue from **More → Exercise images**.

---

## Run it

The app uses ES modules and a service worker, so it must be served over HTTP —
opening `index.html` from the file system will not work.

**Locally**

```bash
cd tracker
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

The phone is always the working copy: every screen reads and writes
`localStorage`, so the app works with no signal. With **cloud sync** switched
on, changes are also copied to a Supabase database and other signed-in
devices pick them up.

### Cloud sync (Supabase)

One-time setup, about ten minutes:

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, **Run**.
   This creates the `records` table, locks every row to its owner (Row Level
   Security) and adds two read-only views, `workout_sessions` and
   `workout_sets` (one row per set), for querying your history.
3. **Authentication → Sign In / Providers**: turn off **Allow new users to sign up**,
   so nobody else can create an account on your project.
4. **Authentication → Users → Add user → Create new user**: your email and a
   password, with **Auto Confirm User** ticked. This is the email and password
   the app asks for when it opens.
5. **Project Settings → API**: copy the **Project URL** and the **anon public**
   key into `CLOUD.url` and `CLOUD.anonKey` in `js/config.js`, then deploy.
   The anon key is meant to be public; the RLS policies are what protect the data.

**Moving your existing data in:** export a backup first (**More → Data →
Export all data**). Then open the updated app on the phone that holds the data
and sign in — do the phone first, before any other device. The first sign-in on a device does this:

| Cloud | This device | Result |
|---|---|---|
| empty | has data | everything on the device is uploaded |
| has data | new (no workouts or custom exercises) | the cloud copy is downloaded |
| has data | has data | both are kept; where the same record differs, the device wins |

After that, sync runs automatically a couple of seconds after each change, when
the app comes back to the foreground or online, and every five minutes. Changes
from other devices are never loaded during a workout or while a day is being
edited; they arrive once you leave that screen. If the same record was changed
on two devices before either synced, the device that syncs last wins.

Signing out keeps everything on the device. **Reset application** while signed
in clears the device and downloads the cloud copy again. The cloud copy is left alone.

### Device only

Without cloud sync, everything is stored in `localStorage` on the device,
behind the `storage` module in `js/storage.js`, and nothing is sent anywhere.
Back up from **More → Data → Export all data**.

Deleting Safari website data, or deleting the installed app, deletes the log on
that device. Without cloud sync, that is the only copy.
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

**Sign-in** (cloud sync configured)
- [ ] First launch shows the sign-in screen, not the passcode
- [ ] A wrong password says "Wrong email or password."
- [ ] Signing in opens Train; relaunching does not ask again
- [ ] More → Sign out returns to the sign-in screen

**Lock** (cloud sync not configured)
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
- [ ] Tap a set number → confirm → that set is removed
- [ ] − SET removes the last set (asks first if it has values or is done)
- [ ] + SET adds a set carrying the previous values
- [ ] COPY LAST fills the fields but marks nothing done
- [ ] COPY LAST also copies last session's exercise note (unless a note is already written)
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

**Cloud sync**
- [ ] With `CLOUD` empty in `js/config.js`, More → Cloud sync says sync is off and nothing else changes
- [ ] A wrong password shows the error under the form
- [ ] First sign-in on the phone reports records uploaded; rows appear in Supabase `records`
- [ ] `select * from workout_sets` lists the logged sets
- [ ] Log a set, wait a few seconds → Status shows a fresh "Synced" time
- [ ] Sign in on a second device → the same programmes and history appear, with no duplicate programmes
- [ ] Edit on one device, reopen the other → the change appears (not while a workout is open)
- [ ] Log in Airplane Mode, then reconnect → the sets reach the cloud
- [ ] Sign out keeps the data on the device

**Offline / PWA**
- [ ] Add to Home Screen, then enable Airplane Mode → the app still launches and logs
- [ ] Icon and name appear correctly on the Home Screen
- [ ] Safe areas respected on a notched iPhone (nothing under the home indicator)


---

## Changelog

**1.3.2**
- COPY LAST also copies the exercise note from last session, unless you have already written one today
- Sets can be deleted: tap a set number to remove that set, or use − SET to drop the last one

**1.3.1**
- Exercise images no longer depend on downloading the ExerciseDB catalogue. The free endpoint is rate limited and can stop answering after a page or two, which left only about a dozen exercises with images
- 106 of the 112 built-in exercises now record the ExerciseDB id of the same exercise and show its image straight away, with no download; wrong guesses such as Dumbbell Curl showing a Zottman curl are gone
- Download/refresh in More → Exercise images now only matches custom exercises and the six built-ins ExerciseDB has no equivalent for (Dumbbell Floor Press, Hollow Hold, Rowing Machine, Sled Push, Indoor Walk, Box Jump)

**1.3.0**
- Sign-in is required when the app opens: email and password once per device, replacing the passcode screen
- Sign-in errors say what to fix (wrong password, unconfirmed account, missing table, no connection)
- When a second device that already has data joins, only one programme stays active

**1.2.1**
- Updates now arrive reliably on an installed iPhone app: the app checks for a new version each time it comes to the front and reloads itself once it is downloaded (never mid-workout)
- A new version no longer picks up stale files from the browser cache

**1.2.0**
- Cloud sync with Supabase: email sign-in, automatic two-way sync, offline-first (works with no signal and catches up when back online)
- The first sign-in uploads everything already on the device, so an existing log moves to the database without an export/import step
- `supabase/schema.sql`: the `records` table with Row Level Security, plus `workout_sessions` and `workout_sets` views for querying
- Built-in programmes now get a stable id, so a second device never duplicates them

**1.1.1**
- Fixed the image download stopping after the first page when the endpoint returns fewer exercises than requested — this was capping matches at a handful
- Added a per-exercise search fallback for anything the catalogue misses, which gives up quickly if the endpoint does not support search
- Settings now reports how many exercises came back from the catalogue, not just how many matched

**1.1.0**
- Renamed to Workout Tracker; new dumbbell icon across the manifest, favicon and Home Screen
- Light theme: white surfaces, near-black type, a single orange (`#F26228`) for active, complete and record states
- Exercise images via the ExerciseDB free API (AscendAPI) with per-exercise and per-prescription overrides, an on/off setting, and offline caching after first view
- Added the **PT Program**: Push / Pull / Legs / Upper / Lower across Friday–Tuesday, Wednesday steps, Thursday standalone cardio
- Storage keys moved from `redline.*` to `wt.*`, migrated automatically on first launch
- Built-in programmes are now seeded by stable id, so one you delete stays deleted
