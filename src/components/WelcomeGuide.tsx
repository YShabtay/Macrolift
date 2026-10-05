import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import PwaInstallModal from './PwaInstallModal';
import { detectPlatform, getInAppBrowserName, isStandalone } from '../utils/pwaInstall';

interface WelcomeGuideProps {
  /** Called when the guide ends - finished or skipped. */
  onClose: () => void;
}

interface GuideCard {
  id: string;
  title: string;
  illustration: ReactNode;
  body: ReactNode;
  /** Optional extra action under the text. */
  action?: { label: string; onClick: () => void };
}

// ---------------------------------------------------------------------------
// Illustrations: inline SVG so they follow the theme, stay crisp and add almost nothing to the app's size.
// ---------------------------------------------------------------------------

const LIME = '#a3e635';

function Phone({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="52" height="92" rx="9" className="fill-white dark:fill-zinc-900 stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="2.5" />
      <rect x="19" y="5" width="14" height="3" rx="1.5" className="fill-zinc-300 dark:fill-zinc-700" />
      {children}
    </g>
  );
}

/** A phone that keeps its data on itself: a lock on the phone, and a crossed-out cloud beside it (no server, no account). */
function LocalDataIllustration() {
  return (
    <svg viewBox="0 0 320 140" className="mx-auto h-36 w-full max-w-xs" role="img" aria-label="הנתונים נשמרים רק בטלפון, בלי ענן ובלי שרת">
      <Phone x={134} y={24}>
        <rect x="9" y="18" width="34" height="8" rx="4" fill={LIME} opacity="0.85" />
        <rect x="9" y="32" width="26" height="6" rx="3" className="fill-zinc-200 dark:fill-zinc-700" />
        <rect x="9" y="44" width="30" height="6" rx="3" className="fill-zinc-200 dark:fill-zinc-700" />
        <circle cx="26" cy="68" r="11" fill={LIME} />
        <rect x="20" y="66" width="12" height="9" rx="2" fill="#18181b" />
        <path d="M22.5 66v-3a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
      </Phone>
      {/* Cloud, crossed out */}
      <g transform="translate(40 36)" className="text-zinc-400 dark:text-zinc-500">
        <path
          d="M22 52a15 15 0 0 1-1-30 20 20 0 0 1 38-3 14 14 0 0 1 2 33z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <path d="M6 62 76 8" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path d="M128 70h-24" stroke="currentColor" className="text-zinc-400 dark:text-zinc-500" strokeWidth="2.5" strokeDasharray="4 5" strokeLinecap="round" />
    </svg>
  );
}

/** Safari share button -> "Add to Home Screen" -> the app icon on the home screen (reads right to left). */
function HomeScreenIllustration() {
  return (
    <svg viewBox="0 0 320 140" className="mx-auto h-36 w-full max-w-xs" role="img" aria-label="שיתוף, הוסף למסך הבית, אייקון האפליקציה במסך הבית">
      {/* Step 1: share button */}
      <Phone x={238} y={24}>
        <rect x="6" y="66" width="40" height="18" rx="6" className="fill-zinc-100 dark:fill-zinc-800" />
        <g transform="translate(19 68.5)" stroke={LIME} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10V2" />
          <path d="M4 5l3-3 3 3" />
          <path d="M4 8H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1" />
        </g>
        <circle cx="26" cy="75" r="14" fill="none" stroke={LIME} strokeWidth="2" opacity="0.55" className="motion-safe:animate-ping" style={{ transformOrigin: '26px 75px' }} />
      </Phone>
      {/* Step 2: the sheet row "Add to Home Screen" */}
      <Phone x={134} y={24}>
        <rect x="5" y="40" width="42" height="46" rx="7" className="fill-zinc-100 dark:fill-zinc-800" />
        <rect x="9" y="48" width="34" height="12" rx="4" fill="none" stroke={LIME} strokeWidth="2" />
        <rect x="13" y="51" width="6" height="6" rx="1.5" fill="none" stroke={LIME} strokeWidth="1.6" />
        <path d="M16 52.5v3M14.5 54h3" stroke={LIME} strokeWidth="1.2" strokeLinecap="round" />
        <rect x="23" y="53" width="16" height="3" rx="1.5" fill={LIME} opacity="0.8" />
        <rect x="9" y="66" width="34" height="5" rx="2.5" className="fill-zinc-200 dark:fill-zinc-700" />
        <rect x="9" y="75" width="26" height="5" rx="2.5" className="fill-zinc-200 dark:fill-zinc-700" />
      </Phone>
      {/* Step 3: the app on the home screen */}
      <Phone x={30} y={24}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={8 + (i % 2) * 20} y={20 + Math.floor(i / 2) * 20} width="14" height="14" rx="4" className="fill-zinc-200 dark:fill-zinc-700" />
        ))}
        <rect x="28" y="60" width="16" height="16" rx="4.5" fill={LIME} />
        <path d="M32 71v-6M40 71v-6M31 68h10" stroke="#18181b" strokeWidth="2.2" strokeLinecap="round" />
      </Phone>
      <g className="text-zinc-400 dark:text-zinc-500" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M228 70h-18M214 65l-5 5 5 5" />
        <path d="M124 70h-18M110 65l-5 5 5 5" />
      </g>
    </svg>
  );
}

/** Export a file on one phone, move it, load it on the other (reads right to left). */
function BackupIllustration() {
  return (
    <svg viewBox="0 0 320 140" className="mx-auto h-36 w-full max-w-xs" role="img" aria-label="ייצוא קובץ גיבוי במכשיר אחד וטעינה שלו במכשיר החדש">
      <Phone x={238} y={24}>
        <rect x="9" y="22" width="34" height="8" rx="4" fill={LIME} opacity="0.85" />
        <rect x="9" y="36" width="26" height="6" rx="3" className="fill-zinc-200 dark:fill-zinc-700" />
        <path d="M26 74V56M19 63l7-7 7 7" fill="none" stroke={LIME} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Phone>
      {/* The backup file */}
      <g transform="translate(138 38)">
        <path d="M0 6a6 6 0 0 1 6-6h28l14 14v50a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" className="fill-white dark:fill-zinc-900 stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M34 0v14h14" fill="none" className="stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="2.5" strokeLinejoin="round" />
        <text x="24" y="48" textAnchor="middle" fontSize="13" fontWeight="800" fill={LIME}>
          .json
        </text>
      </g>
      <Phone x={30} y={24}>
        <rect x="9" y="22" width="34" height="8" rx="4" className="fill-zinc-200 dark:fill-zinc-700" />
        <rect x="9" y="36" width="26" height="6" rx="3" className="fill-zinc-200 dark:fill-zinc-700" />
        <path d="M26 56v18M19 67l7 7 7-7" fill="none" stroke={LIME} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Phone>
      <g className="text-zinc-400 dark:text-zinc-500" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M228 72h-26M208 67l-5 5 5 5" />
        <path d="M130 72h-26M110 67l-5 5 5 5" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The guide
// ---------------------------------------------------------------------------

/**
 * A short, skippable introduction for new users: where their data lives, how to put the app on the home screen (before entering
 * anything), and how to back up / move to another device. The full step-by-step install guide is one tap away.
 */
export default function WelcomeGuide({ onClose }: WelcomeGuideProps) {
  const [index, setIndex] = useState(0);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const alreadyInstalled = isStandalone();
  const isAndroid = detectPlatform() === 'android';
  // Opened from Instagram & co.: their built-in browser can't install the app, so say how to get out of it first.
  const inAppBrowser = alreadyInstalled ? null : getInAppBrowserName();

  const cards: GuideCard[] = [
    {
      id: 'local',
      title: 'המידע שלך נשמר אצלך בלבד',
      illustration: <LocalDataIllustration />,
      body: (
        <>
          <p>ל-MacroLift אין חשבון ואין שרת. כל מה שתזינו (ארוחות, אימונים, שקילות, תמונות) נשמר רק על המכשיר הזה.</p>
          <p className="mt-2">היתרון: פרטיות מלאה. החיסרון: אם המכשיר או הדפדפן יתנקו, המידע ייעלם, ואף אחד לא יוכל לשחזר אותו בשבילכם. בכרטיס האחרון נסביר איך מגבים.</p>
        </>
      ),
    },
    ...(alreadyInstalled
      ? []
      : [
          {
            id: 'install',
            title: 'הוסיפו למסך הבית לפני שמתחילים',
            illustration: <HomeScreenIllustration />,
            body: (
              <>
                {inAppBrowser && (
                  <p className="mb-2 rounded-lg border border-orange-400/50 bg-orange-400/10 px-3 py-2 text-xs font-semibold leading-relaxed text-orange-700 dark:text-orange-300">
                    ⚠️ פתחתם את הקישור בתוך {inAppBrowser}, ובדפדפן הזה אי אפשר להתקין.{' '}
                    {isAndroid ? 'לחצו על ⋮ ← "פתיחה בדפדפן" (Chrome או Samsung), ושם התקינו.' : 'לחצו על ⋯ ← "Open in Safari", ושם התקינו.'}
                  </p>
                )}
                <p>
                  {isAndroid
                    ? 'בדפדפן: תפריט ⋮ ← "התקן אפליקציה" (או "הוסף למסך הבית") ← אישור.'
                    : 'ב-Safari: כפתור השיתוף (ריבוע עם חץ) ← "הוסף למסך הבית" ← "הוסף".'}
                </p>
                <p className="mt-2 rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-700 dark:text-orange-300">
                  חשוב: הדפדפן והאפליקציה שבמסך הבית שומרים מידע בנפרד. עדיף להתקין קודם ולהזין נתונים רק באפליקציה, כדי שלא יצטרכו להעביר אותם אחר כך.
                </p>
              </>
            ),
            action: { label: 'למדריך ההתקנה המלא', onClick: () => setIsInstallGuideOpen(true) },
          } satisfies GuideCard,
        ]),
    {
      id: 'backup',
      title: 'גיבוי והעברה בין מכשירים',
      illustration: <BackupIllustration />,
      body: (
        <ol className="list-decimal space-y-1.5 pe-5 ps-0 marker:font-bold marker:text-lime-600 dark:marker:text-lime-400">
          <li>בפרופיל: &quot;ייצוא גיבוי נתונים לקובץ&quot;. מתקבל קובץ אחד עם כל המידע.</li>
          <li>שלחו אותו לעצמכם (AirDrop, וואטסאפ, או שמרו בקבצים).</li>
          <li>במכשיר החדש או באפליקציה שבמסך הבית: &quot;כניסה באמצעות קובץ גיבוי&quot;, וכל המידע חוזר.</li>
          <li>כדאי לגבות מדי פעם, כמו גיבוי של תמונות.</li>
        </ol>
      ),
    },
  ];

  const card = cards[index];
  const isLast = index === cards.length - 1;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The full install guide replaces the carousel while it is open; closing it returns to the same card.
  if (isInstallGuideOpen) return <PwaInstallModal onClose={() => setIsInstallGuideOpen(false)} />;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="הכרות קצרה עם MacroLift"
      dir="rtl"
      className="fixed inset-0 z-[72] flex items-end justify-center bg-zinc-950/85 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
    >
      <div className="glass-card neon-border flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-b-none shadow-glow animate-slide-up sm:rounded-b-2xl">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-[11px] font-semibold text-zinc-500">
            {index + 1} מתוך {cards.length}
          </span>
          <button type="button" onClick={onClose} className="flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
            דלג
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div key={card.id} className="flex-1 overflow-y-auto px-5 pb-3 pt-2 animate-fade-in">
          {card.illustration}
          <h2 className="mt-3 text-center text-xl font-extrabold text-zinc-900 dark:text-zinc-100">{card.title}</h2>
          <div className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{card.body}</div>
          {card.action && (
            <button type="button" onClick={card.action.onClick} className="mt-3 text-xs font-bold text-lime-700 underline underline-offset-2 dark:text-lime-400">
              {card.action.label}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2">
          <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
            {cards.map((c, i) => (
              <span key={c.id} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-lime-400' : 'w-1.5 bg-zinc-300 dark:bg-zinc-700'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))} className="btn-primary flex-1">
              {isLast ? 'הבנתי, בואו נתחיל 🚀' : 'הבא'}
              {!isLast && <ChevronLeft className="h-4 w-4" />}
            </button>
            {index > 0 && (
              <button type="button" onClick={() => setIndex((i) => i - 1)} className="btn-secondary">
                <ChevronRight className="h-4 w-4" />
                הקודם
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
