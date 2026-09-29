-- MacroLift - future cloud backend schema
-- ---------------------------------------------------------------------------
-- Not wired up yet. The app runs entirely on localStorage today, behind the
-- single abstraction in src/services/storageService.ts. This file is the
-- target shape for whenever that gets swapped for a real backend (e.g.
-- Supabase/Postgres) - write one class that implements the StorageService
-- interface against these tables, point storageService at it, done.
--
-- Nested, rarely-queried structures (a workout plan's days/exercises, a
-- nutrition plan's macro breakdown, the optional onboarding measurements
-- snapshot) are kept as JSONB rather than fully normalized - they're written
-- and read as a whole, never joined across, so extra tables would only add
-- migration overhead without a real query benefit.
--
-- If using Supabase specifically: prefer supabase.auth.users over a hand-rolled
-- `users` table (Supabase Auth already covers hashing/sessions/recovery); the
-- `users` table below is included only to mirror the client's current
-- self-managed username/password model 1:1, and every other table's user_id
-- would then reference auth.users(id) instead.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- users - account identity
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- profiles - one row per user: onboarding metrics + the currently active
-- derived nutrition target (recalculated whenever weight/goal/steps/etc change)
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  age INTEGER NOT NULL CHECK (age BETWEEN 14 AND 99),
  height_cm NUMERIC NOT NULL CHECK (height_cm BETWEEN 120 AND 230),
  weight_kg NUMERIC NOT NULL CHECK (weight_kg BETWEEN 35 AND 250),
  average_daily_steps INTEGER NOT NULL CHECK (average_daily_steps BETWEEN 1000 AND 50000),
  training_days_per_week SMALLINT NOT NULL CHECK (training_days_per_week BETWEEN 3 AND 6),
  body_state TEXT NOT NULL CHECK (body_state IN ('lean', 'athletic', 'higher_fat')),
  goal TEXT NOT NULL CHECK (goal IN ('lose_weight', 'maintain', 'gain_muscle', 'recomp')),
  goal_intensity TEXT CHECK (goal_intensity IN ('moderate', 'aggressive')),
  measurements JSONB,       -- optional onboarding snapshot: {waistCm, armCm, chestCm, hipCm}
  experience JSONB,         -- optional deep-dive questionnaire for already-training users
  nutrition_plan JSONB NOT NULL, -- {bmr, tdee, targetCalories, macros:{proteinG,fatG,carbsG}, calorieDeficitOrSurplus}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- workouts - the user's generated plan (one active row per user at a time),
-- plus the calendar scheduling and per-set completion tracking around it
-- ---------------------------------------------------------------------------
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  split_type TEXT NOT NULL CHECK (split_type IN ('fbw', 'upper_lower', 'ppl')),
  days_per_week SMALLINT NOT NULL CHECK (days_per_week BETWEEN 3 AND 6),
  title TEXT NOT NULL,
  description TEXT,
  days JSONB NOT NULL,       -- [{id, dayLabel, focus, exercises:[{id,name,muscleGroup,equipment,sets,repsRange,restSeconds,alternatives,...}]}]
  adaptation_notes JSONB,    -- string[] explaining personalization (injuries, focus areas, deload), if any
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workouts_user_active ON workouts (user_id) WHERE is_active;

-- Which plan day (or 'rest'/'custom') is scheduled on a given calendar date.
CREATE TABLE workout_schedule (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_id TEXT NOT NULL,      -- a DayWorkout.id from workouts.days, or the sentinel 'rest' / 'custom'
  custom_label TEXT,
  PRIMARY KEY (user_id, date)
);

-- Which sets of a given exercise, on a given plan day, were checked off on a given date.
CREATE TABLE workout_set_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  date DATE NOT NULL,
  completed_sets SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day_id, exercise_id, date)
);

-- ---------------------------------------------------------------------------
-- meals - the daily nutrition log
-- ---------------------------------------------------------------------------
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snacks')),
  name TEXT NOT NULL,
  quantity TEXT,             -- free-text descriptive quantity, e.g. "150 גרם" or "1 יחידה"
  weight_grams NUMERIC,      -- numeric portion weight when known - powers weight-ratio recalculation on edit
  logged_at TIME,            -- local time the entry was logged, HH:MM
  calories NUMERIC NOT NULL CHECK (calories >= 0),
  protein_g NUMERIC NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  fat_g NUMERIC NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  carbs_g NUMERIC NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meals_user_date ON meals (user_id, date);

-- ---------------------------------------------------------------------------
-- body_metrics - weight log + circumference measurements, one row per date
-- ---------------------------------------------------------------------------
CREATE TABLE body_metrics (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC CHECK (weight_kg BETWEEN 35 AND 250),
  arm_cm NUMERIC,
  chest_cm NUMERIC,
  waist_cm NUMERIC,
  hip_cm NUMERIC,            -- displayed as "ירך" (thigh) in the app
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

-- Target circumferences per metric, used for the growth-rate/ETA projections.
CREATE TABLE circumference_goals (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  arm_cm NUMERIC,
  chest_cm NUMERIC,
  waist_cm NUMERIC,
  hip_cm NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dated progress photos. photo_url should point at object storage (e.g. a
-- Supabase Storage bucket) in production, not an inline base64 data URL.
CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  photo_url TEXT NOT NULL,
  weight_kg NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE step_logs (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps INTEGER NOT NULL CHECK (steps >= 0),
  PRIMARY KEY (user_id, date)
);
