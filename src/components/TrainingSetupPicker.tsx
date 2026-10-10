import { Home } from 'lucide-react';
import Dumbbell from './DumbbellIcon';
import type { ExerciseDifficulty, HomeEquipment, TrainingLocation } from '../types/fitness';

interface TrainingSetupValue {
  location: TrainingLocation | null;
  equipment: HomeEquipment | null;
  level: ExerciseDifficulty | null;
}

interface TrainingSetupPickerProps {
  value: TrainingSetupValue;
  onChange: (next: TrainingSetupValue) => void;
}

const LOCATIONS: { value: TrainingLocation; label: string; hint: string; icon: typeof Home }[] = [
  { value: 'gym', label: 'במכון כושר', hint: 'מוטות, מכונות וכבלים', icon: Dumbbell },
  { value: 'home', label: 'בבית', hint: 'משקל גוף, קליסטניקס, משקולות וגומיות', icon: Home },
];

const EQUIPMENT: { value: HomeEquipment; label: string; hint: string }[] = [
  { value: 'none', label: 'בלי ציוד', hint: 'משקל גוף בלבד: שכיבות סמיכה, מכרעים, חתירה מתחת לשולחן' },
  { value: 'dumbbells', label: 'משקולות וגומיות', hint: 'זוג משקולות (או יותר) וגומיות התנגדות' },
];

const LEVELS: { value: ExerciseDifficulty; label: string; hint: string }[] = [
  { value: 'beginner', label: 'מתחיל', hint: 'פחות מ-10 שכיבות סמיכה רגילות, או חזרה מהפסקה ארוכה' },
  { value: 'intermediate', label: 'בינוני', hint: 'כ-10 עד 25 שכיבות סמיכה רגילות ברצף' },
  { value: 'advanced', label: 'מתקדם', hint: 'יותר מ-25 שכיבות סמיכה, ומכרעים על רגל אחת בשליטה' },
];

function Choice({ selected, onClick, title, hint, icon: Icon }: { selected: boolean; onClick: () => void; title: string; hint: string; icon?: typeof Home }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-right transition ${
        selected
          ? 'border-lime-400/50 bg-lime-400/10'
          : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600'
      }`}
    >
      {Icon && <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-500'}`} />}
      <span className="min-w-0">
        <span className={`block text-sm font-bold ${selected ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-zinc-600 dark:text-zinc-500">{hint}</span>
      </span>
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-500">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

/** Where the user trains; for home training also the equipment they own and their level, which pick the home program. */
export default function TrainingSetupPicker({ value, onChange }: TrainingSetupPickerProps) {
  return (
    <div className="flex flex-col gap-5">
      <Group label="איפה אתה מתאמן?">
        {LOCATIONS.map((o) => (
          <Choice
            key={o.value}
            selected={value.location === o.value}
            onClick={() =>
              onChange(o.value === 'home' ? { location: 'home', equipment: value.equipment, level: value.level } : { location: 'gym', equipment: null, level: null })
            }
            title={o.label}
            hint={o.hint}
            icon={o.icon}
          />
        ))}
      </Group>

      {value.location === 'home' && (
        <>
          <Group label="איזה ציוד יש לך בבית?">
            {EQUIPMENT.map((o) => (
              <Choice key={o.value} selected={value.equipment === o.value} onClick={() => onChange({ ...value, equipment: o.value })} title={o.label} hint={o.hint} />
            ))}
          </Group>
          <Group label="מה הרמה שלך?">
            {LEVELS.map((o) => (
              <Choice key={o.value} selected={value.level === o.value} onClick={() => onChange({ ...value, level: o.value })} title={o.label} hint={o.hint} />
            ))}
          </Group>
        </>
      )}
    </div>
  );
}
