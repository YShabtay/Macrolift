import { Smartphone, X } from 'lucide-react';

interface PwaInstallBannerProps {
  /** 'first-install': beginner tip for a profile with no data yet. 'has-data': a meal or workout is already logged in the browser. 'default': the regular nudge. */
  variant?: 'default' | 'first-install' | 'has-data';
  onOpen: () => void;
  onDismiss: () => void;
}

/** Compact dashboard nudge that opens the install guide; dismissing it hides it for 7 days. */
export default function PwaInstallBanner({ variant = 'default', onOpen, onDismiss }: PwaInstallBannerProps) {
  const isFirstInstall = variant === 'first-install';
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-lime-400/30 bg-lime-400/5 p-3 animate-fade-in">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-700 dark:text-lime-400">
        <Smartphone className="h-5 w-5" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-right">
        {variant === 'has-data' ? (
          <>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">מתכנן להוסיף למסך הבית? 💾</p>
            <p className="text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">לחץ כאן להסבר ושמירת הנתונים</p>
          </>
        ) : isFirstInstall ? (
          <>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">טיפ למתחילים 📲</p>
            <p className="text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">התקן קודם את האפליקציה למסך הבית כדי שהמעקב יישמר ישירות בתוכה</p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">חוויה מלאה במסך הבית 📲</p>
            <p className="truncate text-[11px] text-zinc-600 dark:text-zinc-400">לחצו להסבר התקנה קצר</p>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="סגירת ההצעה להתקנה למשך 7 ימים"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-lime-400/20 dark:text-zinc-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
