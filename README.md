# MacroLift

**A local-first fitness & nutrition PWA in Hebrew (RTL): personalised calorie/macro targets, workout programs, weight-trend analysis and an AI coach, with all user data staying on the device.**

[![Live Demo](https://img.shields.io/badge/Demo-Live%20App-brightgreen)](https://macrolift-one.vercel.app/)
![React](https://img.shields.io/badge/React_18-61dafb?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06b6d4?logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8)

**Try it:** <https://macrolift-one.vercel.app/> (open it on a phone and "Add to Home Screen"; there is also a one-tap demo user).

Built by an Industrial Engineering & Information Systems student as an end-to-end product project: from the nutrition model and UX, through offline-capable frontend engineering, to a secured serverless AI backend.

---

## Screenshots

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/01-dashboard.jpg" width="220" alt="Dashboard"><br><sub><b>Dashboard</b><br>weigh-in, calories and macros left today</sub></td>
    <td align="center"><img src="docs/screenshots/02-nutrition.jpg" width="220" alt="Food log"><br><sub><b>Food log</b><br>meals with per-meal macro summary</sub></td>
    <td align="center"><img src="docs/screenshots/03-workout.jpg" width="220" alt="Workout in progress"><br><sub><b>Workout</b><br>per-set logging, previous session, rest timer</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/04-weight-trend.jpg" width="220" alt="Weight trend"><br><sub><b>Weight trend</b><br>weekly averages instead of daily noise</sub></td>
    <td align="center"><img src="docs/screenshots/05-ai-coach.jpg" width="220" alt="AI coach"><br><sub><b>AI coach</b><br>answers based on your plan and today's intake</sub></td>
    <td align="center"><img src="docs/screenshots/06-calorie-calc.jpg" width="220" alt="Calorie calculation"><br><sub><b>Transparent targets</b><br>BMR, TDEE and goal calories</sub></td>
  </tr>
</table>

---

## The problem

Most tracking apps share the same weaknesses:

- **Noisy data.** Daily weight swings of 1-2 kg (water, salt, digestion) make a single weigh-in meaningless, so people give up or panic.
- **Tedious logging.** Searching for every food item and weighing every gram does not last more than a couple of weeks.
- **Privacy.** Progress photos and body data end up on someone else's server.

## The approach

| Problem | What MacroLift does |
| --- | --- |
| Noisy weight | Rolling weekly averages and a trend line. The coach only comments after enough weigh-ins (3+ in each compared week) and never on a single day. |
| Tedious logging | A fast local database of Israeli staples, barcode scanning, voice logging, meal-photo scan, quick-add shortcuts, and Gemini as a fallback for anything else. |
| Rigid daily targets | Weekly calorie budget: a heavy day is balanced across the rest of the week instead of "failing" the day. |
| Privacy | No accounts and no database. Everything, photos included, is stored on the device, with JSON backup/restore for portability. |
| Generic training | Programs matched to days per week, gender and target-muscle focus, with weekly volume checked against the 12-16 sets/week range per muscle group. |

---

## Features

**Nutrition**
- Personalised targets: BMR by Mifflin-St Jeor (gender-specific), activity multiplier from daily steps and training days, goal-based surplus/deficit and gender-aware macros.
- Food log by meal with per-meal macro summary, editable entries, natural serving units, and day-by-day navigation.
- Weekly calorie budget and rebalancing options after an overshoot.
- Logging by search, barcode (camera, via Open Food Facts), voice, or a photo of the meal.

**Training**
- Built-in programs plus a custom plan builder, with a weekly volume view per muscle group.
- Guided workout mode: per-set logging, warm-up sets, plate calculator, rest timer (works in the background and with notifications).
- Exercise swap, exercise videos, workout calendar, streaks and a weekly summary with week navigation.

**Progress**
- Weight trend (weekly averages), circumference measurements, progress photos with side-by-side comparison, and an AI progress review.
- A coach that interprets the trend with conservative rules instead of reacting to noise.

**AI coach** (Gemini)
- Chat that knows your profile, targets, today's intake, active plan and weight, and that continues the conversation instead of restarting every message.
- Meal photo analysis and voice-to-meal parsing.

**Product & reliability**
- Installable PWA with offline support, an install guide for iOS/Android, and background update checks with a "new version" prompt.
- Defensive data layer: schema versioning and migrations, sanitising of stored data on boot, per-screen error boundaries, and a recovery path if a chunk fails to load.
- Backup reminders, JSON export/import and CSV export.

---

## Architecture

```mermaid
flowchart LR
    UI["React UI<br/>(RTL, Tailwind)"] --> State["App state<br/>(single source of truth)"]
    State --> Storage["storageService<br/>(localStorage, versioned)"]
    UI --> Utils["Pure calculation modules<br/>(nutrition, volume, weekly balance, trends)"]
    UI -->|"AI requests"| Proxy["/api/gemini<br/>(Vercel serverless)"]
    Proxy -->|"server-side key"| Gemini["Gemini API"]
    UI -->|"barcode"| OFF["Open Food Facts"]
    SW["Service worker<br/>(Workbox)"] --- UI
```

Design decisions worth knowing:

- **Local-first by choice.** All persistence goes through one abstraction (`src/services/storageService.ts`), so a backend can be added later without touching the UI. [`schema.sql`](schema.sql) sketches that target shape.
- **Logic is separated from UI.** Calculations live in small, pure modules under `src/utils` (for example `calculations.ts`, `weeklyBalance.ts`, `planVolume.ts`, `coachInsights.ts`), which keeps them easy to reason about and to test.
- **The AI key never reaches the browser.** In production every AI call goes through `api/gemini.ts`, a serverless proxy that holds the key server-side and enforces a model allow-list, request-size and token caps, a same-origin check and a per-IP rate limit. During local development the app calls Google directly with `VITE_GEMINI_API_KEY`, which is compiled out of production builds.
- **Heavy dependencies load on demand.** The barcode decoder (ZXing) is only fetched when the scanner opens.
- **Resilience over cleverness.** Stored data is validated and migrated at boot (`dataMigration.ts`), and a bad entry degrades one screen rather than the whole app.

### Project structure

```
api/              Serverless Gemini proxy (Vercel)
src/components/   Screens and UI building blocks
src/services/     Storage, Gemini clients, barcode lookup
src/utils/        Pure logic: nutrition model, volume, trends, migrations
src/hooks/        Reusable hooks (install banner, visual viewport, ...)
src/data/         Workout templates, muscle labels and the local food database
```

---

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: add VITE_GEMINI_API_KEY to enable the AI features locally
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check and production build |
| `npm run lint` | Lint with oxlint |
| `npm run preview` | Serve the production build |

### Deploying (Vercel)

1. Import the repo; the framework preset is Vite.
2. Add `GEMINI_API_KEY` (**not** prefixed with `VITE_`) under *Settings -> Environment Variables*.
3. Set a quota or budget for the key in Google Cloud / AI Studio.

Without a key the app still works; only the AI features are unavailable.

---

## Limitations and next steps

- Data lives on a single device. Backup/restore covers moving between devices; optional cloud backup is the main candidate for a future version.
- The nutrition model gives estimates for healthy adults, not medical advice (the app shows a disclaimer).
- Planned: automated unit tests for the calculation modules with CI.
