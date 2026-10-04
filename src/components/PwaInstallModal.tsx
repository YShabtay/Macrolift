import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, CheckCircle2, Compass, Download, MoreVertical, Save, X } from 'lucide-react';
import type { AppState } from '../types/fitness';
import { exportBackup, hasTrackedData } from '../utils/backupExport';
import {
  detectPlatform,
  getInstallPrompt,
  isIosNonSafari,
  isStandalone,
  promptInstall,
  subscribeInstallPrompt,
  type InstallPlatform,
} from '../utils/pwaInstall';

type GuideTab = 'ios' | 'android';

const STEP_CYCLE_MS = 2400;

/** iOS share button: a square with an arrow rising out of it. */
function ShareIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 15V3.5" />
      <path d="M8.2 7.2 12 3.5l3.8 3.7" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

/** iOS "Add to Home Screen": a rounded square with a plus. */
function AddSquareIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

interface GuideStep {
  title: string;
  body: ReactNode;
  icon: ReactNode;
}

const IOS_STEPS: GuideStep[] = [
  {
    title: 'פתחו את האתר ב-Safari',
    body: 'ההוספה למסך הבית באייפון עובדת רק מדפדפן Safari (לא מ-Chrome או מדפדפן שנפתח בתוך אפליקציה אחרת).',
    icon: <Compass className="h-6 w-6" />,
  },
  {
    title: 'לחצו על כפתור השיתוף',
    body: 'בשורת הכלים בתחתית המסך (באייפד: למעלה), הכפתור עם הריבוע והחץ העולה.',
    icon: <ShareIcon />,
  },
  {
    title: 'בחרו "הוסף למסך הבית"',
    body: 'גללו מעט למטה ברשימה ולחצו על "הוסף למסך הבית" (Add to Home Screen).',
    icon: <AddSquareIcon />,
  },
  {
    title: 'אשרו בלחיצה על "הוסף"',
    body: 'לחצו על "הוסף" (Add) בפינה העליונה. הסמל של MacroLift יופיע במסך הבית.',
    icon: <Check className="h-6 w-6" />,
  },
];

const ANDROID_STEPS: GuideStep[] = [
  {
    title: 'פתחו את תפריט שלוש הנקודות',
    body: 'לחצו על ⋮ בפינת הדפדפן (Chrome או Samsung Internet).',
    icon: <MoreVertical className="h-6 w-6" />,
  },
  {
    title: 'בחרו "התקן אפליקציה"',
    body: 'בתפריט בחרו "התקן אפליקציה" או "הוסף למסך הבית" (Install app / Add to Home screen).',
    icon: <Download className="h-6 w-6" />,
  },
  {
    title: 'אשרו את ההתקנה',
    body: 'לחצו "התקן" בחלון שמופיע. האפליקציה תתווסף למסך הבית ולרשימת האפליקציות.',
    icon: <Check className="h-6 w-6" />,
  },
];

interface PwaInstallModalProps {
  /** When given, a backup card is shown first if the user already has data in this browser. */
  appState?: AppState;
  onClose: () => void;
}

/** Step-by-step guide for adding MacroLift to the home screen on iPhone (Safari) and Android (Chrome / Samsung). */
export default function PwaInstallModal({ appState, onClose }: PwaInstallModalProps) {
  // Opens on the tab matching the detected device; desktop visitors get the iPhone guide first.
  const [tab, setTab] = useState<GuideTab>(() => (detectPlatform() === 'android' ? 'android' : 'ios'));
  const platform: InstallPlatform = detectPlatform();
  const installPrompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
  const [installResult, setInstallResult] = useState<'accepted' | 'dismissed' | null>(null);
  const alreadyInstalled = isStandalone();
  // Browser storage and the home-screen app's storage are separate on iPhone, so existing data has to travel in a backup file.
  const hasExistingData = !alreadyInstalled && !!appState && hasTrackedData(appState);
  const [isBackupDone, setIsBackupDone] = useState(false);

  async function handleDownloadBackup() {
    if (!appState) return;
    if ((await exportBackup(appState)) !== 'cancelled') setIsBackupDone(true);
  }

  const steps = tab === 'ios' ? IOS_STEPS : ANDROID_STEPS;

  // A highlight walks through the steps so the order is obvious at a glance; tapping a step jumps to it.
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActive((i) => (i + 1) % steps.length), STEP_CYCLE_MS);
    return () => clearInterval(timer);
  }, [steps.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function selectTab(next: GuideTab) {
    setTab(next);
    setActive(0);
  }

  async function handleInstall() {
    setInstallResult((await promptInstall()) ? 'accepted' : 'dismissed');
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="התקנת האפליקציה במסך הבית"
      dir="rtl"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/80 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-b-none shadow-glow animate-slide-up sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-zinc-950">
              <AddSquareIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">התקנה במסך הבית 📲</h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-500">חוויה מלאה, בלי סרגל דפדפן</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          {hasExistingData && (
            <div className="mb-4 rounded-xl border border-orange-400/50 bg-orange-400/10 p-3.5">
              <p className="flex items-start gap-2 text-sm font-extrabold leading-snug text-orange-700 dark:text-orange-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ⚠️ יש לך נתונים שמורים בדפדפן! כדי שהם לא ייעלמו במעבר למסך הבית, הורד גיבוי עכשיו:
              </p>
              <button type="button" onClick={() => void handleDownloadBackup()} className="btn-primary mt-3 w-full">
                <Save className="h-4 w-4" />
                הורד קובץ גיבוי של הנתונים שלך 💾
              </button>
              <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {isBackupDone ? '✅ הקובץ ירד. ' : ''}לאחר פתיחת האפליקציה במסך הבית, תוכל לטעון את הקובץ בלחיצה אחת.
              </p>
            </div>
          )}

          {alreadyInstalled && (
            <p className="mb-3 flex items-center gap-2 rounded-xl border border-lime-400/30 bg-lime-400/5 px-3 py-2.5 text-xs font-semibold text-lime-700 dark:text-lime-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              האפליקציה כבר מותקנת ופועלת ממסך הבית.
            </p>
          )}

          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/70 p-1">
            {([
              { id: 'ios', label: '🍏 אייפון (iOS)' },
              { id: 'android', label: '🤖 אנדרואיד (Galaxy/Pixel)' },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => selectTab(id)}
                className={`rounded-lg px-2 py-2.5 text-xs font-bold transition ${
                  tab === id ? 'bg-lime-400 text-zinc-950 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'ios' && platform === 'ios' && isIosNonSafari() && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3 py-2.5 text-xs leading-relaxed text-orange-700 dark:text-orange-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              נראה שאתם לא ב-Safari. פתחו את הקישור הזה ב-Safari כדי שאפשרות ההוספה למסך הבית תופיע.
            </p>
          )}

          {tab === 'android' && installPrompt && !alreadyInstalled && installResult !== 'accepted' && (
            <button type="button" onClick={() => void handleInstall()} className="btn-primary mt-4 w-full animate-pulse py-3.5 text-base">
              <Download className="h-5 w-5" />
              התקן אפליקציה עכשיו בלחיצה ⬇️
            </button>
          )}
          {tab === 'android' && installResult === 'accepted' && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-lime-400/30 bg-lime-400/5 px-3 py-2.5 text-sm font-semibold text-lime-700 dark:text-lime-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              ההתקנה הושלמה. מצאו את MacroLift במסך הבית.
            </p>
          )}

          <p className="mb-2 mt-4 text-xs font-semibold text-zinc-600 dark:text-zinc-500">
            {tab === 'android' && installPrompt ? 'או ידנית, בשלושה צעדים:' : 'איך עושים את זה:'}
          </p>

          <ol className="flex flex-col gap-2.5">
            {steps.map((step, i) => {
              const isActive = i === active;
              return (
                <li key={step.title}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-right transition-all duration-300 ${
                      isActive
                        ? 'border-lime-400 bg-lime-400/10 shadow-glow'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 opacity-80'
                    }`}
                  >
                    <span
                      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        isActive ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {isActive && <span className="absolute inset-0 rounded-xl bg-lime-400/60 motion-safe:animate-ping" aria-hidden="true" />}
                      <span className="relative">{step.icon}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                            isActive ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{step.title}</span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-zinc-700 dark:text-zinc-400">{step.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
            שימו לב: הנתונים נשמרים בנפרד בדפדפן ובאפליקציה שבמסך הבית. אם כבר התחלתם לתעד בדפדפן, ייצאו גיבוי (פרופיל ← גיבוי נתונים) ושחזרו אותו באפליקציה.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
