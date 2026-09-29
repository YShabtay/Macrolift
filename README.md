<div align="center">

<img src="public/favicon.svg" alt="MacroLift logo" width="72" height="72" />

# MacroLift

**A fully client-side fitness & nutrition coach — deterministic science for the numbers, generative AI for the parts that actually need a brain.**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-offline_ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI_powered-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)

</div>

---

## What is this?

MacroLift is a Hebrew/RTL fitness and nutrition app that takes a person through a guided onboarding, then generates a personalized workout split and calorie/macro targets from first principles — no backend, no account server, everything persisted locally on-device. On top of that deterministic core, it layers a few genuinely useful AI features (meal photo logging, a coaching chat, progress-photo review) that degrade gracefully to "feature disabled" rather than breaking the app when no API key is configured.

It was built as a single-developer portfolio project to demonstrate: modeling a non-trivial domain (training splits, energy balance, macro math) in TypeScript with zero external state-management library; designing a storage layer that's backend-agnostic from day one; and integrating a multimodal LLM as an *enhancement*, not a dependency.

**[Try the guest demo](#-guest-demo-mode)** — one click, fully seeded account, no signup.

---

## Key Features

- **Smart, adaptive onboarding** — a multi-step wizard that adjusts its own follow-up questions based on prior answers (e.g. an experienced-lifter branch asks about current split, injuries and plateaus; a beginner doesn't see any of that).
- **Deterministic nutrition engine** — BMR via the Mifflin-St Jeor equation, TDEE from an activity multiplier derived from daily step count, and goal-adjusted calorie/macro targets. No LLM in the loop for these numbers — same inputs always produce the same output.
- **Generated & adaptive workout plans** — FBW / Upper-Lower / Push-Pull-Legs splits chosen by weekly training frequency, with per-exercise YouTube technique demos, injury-aware exercise substitution, and a same-muscle-group "swap" picker.
- **Visual body-progress comparison** — a draggable before/after slider over dated progress photos, plotted alongside a weigh-in trend chart and optional body-circumference tracking with goal projections.
- **AI features, opt-in** — snap a photo of a meal to auto-log its macros, chat with an AI coach that has read your actual plan and history, and get a written AI review of two progress photos side by side. All via the Gemini API, all inert (with a clear "connect your key" prompt) if `VITE_GEMINI_API_KEY` isn't set.
- **PWA, offline-first** — installable to a home screen, with the full app shell (including the rest timer and workout screens) precached so it keeps working with no signal in a basement gym.
- **Data ownership** — one-click JSON export/import of your entire account, so your data is never trapped in the app.

### 🎬 Guest demo mode

The auth screen has a **"Guest demo login"** button that seeds a complete, realistic account on the spot — full profile, 8 weeks of weigh-ins plotted on a real trend chart, two before/after progress photos, and a weekly workout with some sets already checked off — and drops you straight into the dashboard. No form, no email, no waiting.

---

## Architecture Overview

MacroLift is a **static single-page app** — there is no backend server. Everything is designed so a real backend could be dropped in later without touching the UI layer:

```
src/
├── components/      UI components (one file per screen/modal, co-located sub-components)
├── data/             Static domain data: workout templates, exercise media, body-type copy
├── services/         External-facing boundaries: storageService, Gemini chat/vision clients
├── utils/             Pure functions: nutrition math, date/week helpers, workout adaptation
├── types/fitness.ts  The single source of truth for the domain model
└── App.tsx           Owns the top-level state machine and all state-mutating handlers
```

**State management is plain React — deliberately.** `App.tsx` holds one `AppState` object (profile, nutrition plan, workout plan, logs, photos, schedule) in `useState` and passes it, plus a flat list of handler callbacks, down through `Dashboard.tsx` to whichever tab is active. There's no Redux/Zustand/Context-for-everything: the state shape is one JSON-serializable tree by design, because that tree *is* what gets persisted and what an exported backup file looks like. A `useEffect` in `App.tsx` autosaves that tree on every change.

**The storage layer is behind one interface.** `services/storageService.ts` defines a `StorageService` interface (`getAppState` / `saveAppState` / user auth / session) that every read and write in the app goes through — never `localStorage` directly. The only implementation today is a synchronous `localStorage` wrapper exposed through an async API, so swapping in a real backend (Supabase, a REST API, etc.) later means writing one new class against that same interface, not touching a single component.

**Domain calculations are pure and tested by construction.** Everything in `utils/calculations.ts` (BMR/TDEE/macros) and `data/workoutTemplates.ts` (split selection, template lookup) is a pure function of its inputs — no side effects, no hooks — which is what makes the AI features additive rather than load-bearing: turn off Gemini entirely and the app is still a fully working, scientifically-grounded coach.

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript, Tailwind CSS v3 (Dark Athletic Tech design system, full RTL) |
| Build | Vite 8 |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`, offline app-shell precaching) |
| Icons | `lucide-react` |
| AI | Google Gemini (`gemini-3.5-flash-lite`) — vision for meal/photo analysis, chat for the coach |
| Persistence | `localStorage`, behind a swappable `StorageService` interface |
| Lint | `oxlint` |

---

## Quickstart

```bash
git clone https://github.com/<your-username>/MacroLift.git
cd MacroLift/forma-app
npm install
```

AI features (meal scanning, AI coach, photo review) need a free [Gemini API key](https://aistudio.google.com/apikey). Everything else works without one.

```bash
cp .env.example .env.local
# then edit .env.local and paste your key into VITE_GEMINI_API_KEY
```

```bash
npm run dev       # start the dev server
npm run build     # type-check (tsc -b) + production build to dist/
npm run lint       # oxlint
```

Deploying to Vercel: import the repo, set `VITE_GEMINI_API_KEY` as an environment variable (optional), and deploy — it's a static Vite build with no server-side requirements.

---

<div align="center">

Built as a solo portfolio project.

</div>
