import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, HelpCircle, Laptop, Smartphone, X } from 'lucide-react';

type HelpTab = 'ios' | 'desktop' | 'faq';

const TABS: { id: HelpTab; label: string; icon: typeof Smartphone }[] = [
  { id: 'ios', label: 'אייפון', icon: Smartphone },
  { id: 'desktop', label: 'מחשב', icon: Laptop },
  { id: 'faq', label: 'שאלות נפוצות', icon: HelpCircle },
];

interface GuideStep {
  title: string;
  body: string;
}

const IOS_STEPS: GuideStep[] = [
  {
    title: 'פתחו את האפליקציה ב-Safari',
    body: 'הוספה למסך הבית באייפון עובדת רק מ-Safari (לא מ-Chrome או מדפדפן שנפתח בתוך אפליקציה אחרת). פתחו את הקישור של MacroLift ב-Safari.',
  },
  {
    title: 'הוסיפו למסך הבית',
    body: 'לחצו על כפתור השיתוף (Share, הריבוע עם החץ כלפי מעלה) בשורת הכלים, גללו ובחרו "הוסף למסך הבית" (Add to Home Screen), ואז "הוסף". מעכשיו האפליקציה נפתחת במסך מלא כמו כל אפליקציה אחרת.',
  },
  {
    title: 'טיימר המנוחה והצלילים',
    body: 'כדי לשמוע את צפצופי סיום המנוחה: ודאו שהמתג הפיזי בצד המכשיר אינו על השתקה (אין פס כתום), והגבירו את עוצמת הקול. אשרו התראות כשהאפליקציה מבקשת. בזמן מנוחה המסך נשאר דלוק, ובסיום תופיע גם הבהוב ירוק והודעה על המסך.',
  },
  {
    title: 'חשוב: Safari והאפליקציה שבמסך הבית לא חולקים מידע',
    body: 'המידע נשמר בנפרד בכל אחד מהם. אם התחלתם ב-Safari ועברתם לאפליקציה, ייצאו גיבוי (פרופיל ← גיבוי נתונים) ושחזרו אותו באפליקציה דרך "כניסה באמצעות קובץ גיבוי".',
  },
];

const DESKTOP_STEPS: GuideStep[] = [
  {
    title: 'פתחו את הקישור בדפדפן',
    body: 'מומלץ Chrome או Edge. האפליקציה עובדת בכל דפדפן מודרני, אבל ההתקנה כאפליקציה זמינה בעיקר בהם.',
  },
  {
    title: 'התקינו מהכתובת',
    body: 'לחצו על סמל ההתקנה בצד שורת הכתובת (מסך עם חץ למטה), או בתפריט הדפדפן ← "התקן את MacroLift". האפליקציה תיפתח בחלון משלה ותופיע ברשימת האפליקציות.',
  },
  {
    title: 'העברת נתונים מהאייפון למחשב',
    body: 'באייפון: פרופיל ← "גיבוי נתונים (JSON)" והשמירה תיעשה לקובץ (למשל באפליקציית "קבצים"). שלחו את הקובץ לעצמכם ב-AirDrop, במייל או בענן. במחשב: במסך הכניסה לחצו "כניסה באמצעות קובץ גיבוי", או בתוך האפליקציה: פרופיל ← "שחזור מגיבוי", ובחרו את הקובץ.',
  },
];

const FAQ: GuideStep[] = [
  {
    title: 'איפה נשמר המידע שלי?',
    body: 'MacroLift בנויה כ-Local-First: כל הנתונים (פרופיל, שקילות, תזונה, אימונים ותמונות התקדמות) נשמרים רק בדפדפן או במכשיר שלכם, ולא בשרת שלנו. אין חשבון בענן ואין מי שיכול לראות את המידע. התוצאה: פרטיות מלאה, אבל גם אחריות: ניקוי נתוני האתר או החלפת מכשיר ימחקו את המידע אם לא גיבתם. מומלץ לגבות מדי פעם.',
  },
  {
    title: 'מה נשלח החוצה כשמשתמשים ב-AI?',
    body: 'רק בעת שימוש בתכונות ה-AI (סריקת ארוחה, הקלטה קולית, ניתוח תמונות התקדמות ומאמן ה-AI) נשלח לשירות Gemini של Google התוכן הנדרש לבקשה: למשל תיאור הארוחה, תמונה שבחרתם או נתוני הפרופיל לצורך ההקשר. שום דבר אינו נשלח ברקע.',
  },
  {
    title: 'איך מעבירים נתונים בין הטלפון למחשב?',
    body: 'במכשיר המקור: פרופיל ← "גיבוי נתונים (JSON)". העבירו את הקובץ למכשיר היעד (AirDrop, מייל, ענן). במכשיר היעד: "כניסה באמצעות קובץ גיבוי" במסך הפתיחה, או פרופיל ← "שחזור מגיבוי".',
  },
  {
    title: 'הטיימר לא משמיע צליל, מה לעשות?',
    body: 'בדקו שמתג ההשתקה הפיזי באייפון כבוי ושהעוצמה מוגברת. הפעילו את האפשרות "הצלצול ימשיך גם כשהמסך נעול" בכרטיס הטיימר, ואשרו התראות. גם בלי צליל תקבלו הבהוב ירוק והודעה בולטת בסיום.',
  },
];

interface HelpCenterModalProps {
  onClose: () => void;
}

/** In-app help: how to install MacroLift on iPhone / desktop, how to move data between devices, and common questions. */
export default function HelpCenterModal({ onClose }: HelpCenterModalProps) {
  const [tab, setTab] = useState<HelpTab>('ios');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="מרכז עזרה ומדריך מכשירים"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <HelpCircle className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">מרכז עזרה ומדריך מכשירים</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div role="tablist" className="mx-4 mt-4 grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/70 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-bold transition ${
                tab === id ? 'bg-lime-400 text-zinc-950 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4 pb-5">
          {tab === 'ios' && <NumberedSteps steps={IOS_STEPS} />}
          {tab === 'desktop' && <NumberedSteps steps={DESKTOP_STEPS} />}
          {tab === 'faq' && (
            <div className="flex flex-col gap-2">
              {FAQ.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={item.title} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 p-3.5 text-right"
                    >
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.title}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && <p className="border-t border-zinc-200 dark:border-zinc-800 p-3.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{item.body}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NumberedSteps({ steps }: { steps: GuideStep[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-400 text-sm font-extrabold text-zinc-950">{i + 1}</span>
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
