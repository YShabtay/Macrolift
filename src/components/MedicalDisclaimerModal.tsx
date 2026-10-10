import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert } from 'lucide-react';
import PrivacyTermsModal from './PrivacyTermsModal';

interface MedicalDisclaimerModalProps {
  onConfirm: () => void;
}

export default function MedicalDisclaimerModal({ onConfirm }: MedicalDisclaimerModalProps) {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm animate-fade-in">
      <div className="glass-card neon-border flex w-full max-w-md flex-col gap-4 p-5 shadow-glow animate-slide-up sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-400/10 text-orange-700 dark:text-orange-400">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">לפני שממשיכים</h3>
        </div>

        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          האפליקציה מספקת המלצות כושר ותזונה כלליות ואינה מהווה תחליף לייעוץ רפואי, תזונתי או פיזיותרפי מקצועי. אם
          יש לך מצב רפואי קיים, פציעה, או שאלה הדורשת התאמה אישית - מומלץ להתייעץ עם איש מקצוע מוסמך לפני שינוי
          משמעותי בתזונה או באימונים.
        </p>

        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          האפליקציה מיועדת לבני 18 ומעלה, ואינה מתאימה להריון, להנקה או למצבים רפואיים. שאלות ל-AI ותמונות שתשלח לניתוח עוברות ל-Google.{' '}
          <button type="button" onClick={() => setIsPrivacyOpen(true)} className="font-semibold text-lime-700 underline underline-offset-2 dark:text-lime-400">
            פרטיות ותנאי שימוש
          </button>
        </p>

        <button type="button" onClick={onConfirm} className="btn-primary">
          הבנתי, אני בן/בת 18 ומעלה ומאשר/ת
        </button>
      </div>
      {isPrivacyOpen && <PrivacyTermsModal onClose={() => setIsPrivacyOpen(false)} />}
    </div>,
    document.body,
  );
}
