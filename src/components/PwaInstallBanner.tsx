import { Smartphone, X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

interface PwaInstallBannerProps {
  /** 'first-install': beginner tip for a profile with no data yet. 'has-data': a meal or workout is already logged in the browser. 'default': the regular nudge. */
  variant?: 'default' | 'first-install' | 'has-data';
  onOpen: () => void;
  onDismiss: () => void;
}

/** Compact dashboard nudge that opens the install guide; dismissing it hides it for 7 days. */
export default function PwaInstallBanner({ variant = 'default', onOpen, onDismiss }: PwaInstallBannerProps) {
  const isFirstInstall = variant === 'first-install';
  const isMobile = useIsMobile();
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-2xl border border-lime-400/30 bg-lime-400/5 p-2 animate-fade-in">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-400/15 text-lime-700 dark:text-lime-400">
        <Smartphone className="h-5 w-5" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-right">
        <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {variant === 'has-data' ? 'מתכנן להוסיף למסך הבית? 💾' : isFirstInstall ? (isMobile ? 'טיפ: התקן למסך הבית 📲' : 'טיפ למתחילים 📲') : 'חוויה מלאה במסך הבית 📲'}
        </p>
        {!isMobile && (
          <p className="truncate text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
            {variant === 'has-data' ? 'לחץ כאן להסבר ושמירת הנתונים' : isFirstInstall ? 'התקן קודם את האפליקציה למסך הבית כדי שהמעקב יישמר ישירות בתוכה' : 'לחצו להסבר התקנה קצר'}
          </p>
        )}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="סגירת ההצעה להתקנה למשך 7 ימים"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-lime-400/20 dark:text-zinc-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
