import { createPortal } from 'react-dom';
import { ShieldCheck, X } from 'lucide-react';

interface PrivacyTermsModalProps {
  onClose: () => void;
}

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'מה האפליקציה',
    body: [
      'MacroLift היא אפליקציה חינמית למעקב כושר ותזונה, שנבנתה כפרויקט אישי. היא מספקת הערכות והמלצות כלליות בלבד, ואינה תחליף לייעוץ רפואי, תזונתי או פיזיותרפי. אין להשתמש בה בהריון, בהנקה או עם מצב רפואי, ואין לבסס עליה החלטות רפואיות. אם יש לך מצב רפואי, פציעה או הפרעת אכילה, התייעץ עם רופא או דיאטן לפני שינוי בתזונה או באימון.',
      'האפליקציה מיועדת למשתמשים בני 18 ומעלה.',
    ],
  },
  {
    title: 'איפה הנתונים שלך נשמרים',
    body: [
      'הפרופיל, השקילות, יומן האוכל, האימונים, הצעדים ותמונות ההתקדמות נשמרים רק על המכשיר שלך (באחסון הדפדפן). אין חשבון בענן ואין מסד נתונים שלי עם המידע שלך.',
      'מחיקת נתוני האתר בדפדפן, התקנה מחדש או החלפת מכשיר מוחקות אותם. כדי לא לאבד מידע, ייצא גיבוי מתוך האפליקציה (פרופיל).',
    ],
  },
  {
    title: 'מה כן יוצא מהמכשיר',
    body: [
      'פעולות ה-AI נשלחות ל-Google Gemini דרך שרת ביניים של האפליקציה: שאלות למאמן הדיגיטלי (יחד עם פרטי הפרופיל והתוכנית שהוא צריך כדי לענות), תמונות מנותחות (ניתוח התקדמות, סריקת ארוחה), וטקסט חיפוש מזון. אל תשלח תמונות או מידע שאינך רוצה שיעברו ל-Google.',
      'האפליקציה משתמשת בשירות Gemini בגרסה החינמית. לפי תנאי Google, בגרסה כזו ייתכן שתוכן ישמש לשיפור שירותי Google ושעובדים של Google יקראו אותו. מומלץ לא לשלוח תמונות מזהות.',
      'סריקת ברקוד שולחת את מספר הברקוד אל Open Food Facts (מאגר מוצרים פתוח). סרטוני הדרכה מוטמעים מ-YouTube, והטמעתם חושפת ל-Google/YouTube את כתובת ה-IP שלך כפי שקורה בכל אתר.',
      'האתר מתארח ב-Vercel, שעשוי לשמור יומני גישה טכניים רגילים.',
    ],
  },
  {
    title: 'דיוק התשובות',
    body: [
      'חישובי הקלוריות והמאקרו הם הערכות לפי נוסחאות מקובלות ואינם מדויקים לכל אדם. תשובות ה-AI, ניתוח התמונות והערכת אחוז השומן עלולים לטעות או להיות לא מתאימים לך. אתה האחראי להחלטות שלך ולטיחות האימון.',
    ],
  },
  {
    title: 'אחריות ושימוש',
    body: [
      'האפליקציה ניתנת "כמו שהיא", בלי אחריות מכל סוג, ובמידה המותרת בדין אני לא אחראי לנזק שנגרם משימוש בה. קוד המקור גלוי לצפייה בלבד, וכל הזכויות שמורות (ראה את קובץ ה-LICENSE).',
      'שאלות, בקשות למחיקת מידע או הערות: דרך עמוד הפרויקט ב-GitHub (github.com/YShabtay/Macrolift).',
    ],
  },
];

/** The privacy notice and terms of use in one place: what stays on the device, what is sent to Google's AI, the health limits, and who is responsible for what. */
export default function PrivacyTermsModal({ onClose }: PrivacyTermsModalProps) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="פרטיות ותנאי שימוש"
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-[85] flex items-end justify-center bg-zinc-950/80 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-b-none shadow-glow animate-slide-up sm:rounded-b-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">פרטיות ותנאי שימוש</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h4 className="mb-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">{section.title}</h4>
                <div className="flex flex-col gap-2">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-zinc-500">עודכן לאחרונה: אוקטובר 2026.</p>
        </div>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="btn-primary w-full">
            הבנתי
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
