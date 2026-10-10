import { useState } from 'react';
import { ArrowLeft, ChevronLeft, Dumbbell, FileUp, Loader2, LogIn, Sparkles, UserPlus } from 'lucide-react';
import PrivacyTermsModal from './PrivacyTermsModal';
import type { AuthUser } from '../utils/authStorage';

interface WelcomeScreenProps {
  /** Profiles already saved on this device - offered first, so a returning user is one tap from their data. */
  profiles: AuthUser[];
  isGuestLoading: boolean;
  isRestoring: boolean;
  isDemoLoading: boolean;
  onGuest: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onRestore: () => void;
  onDemo: () => void;
  onOpenProfile: (userId: string) => void;
}

const glassButton =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 text-xs font-bold text-white backdrop-blur-md transition active:scale-95 hover:bg-white/15 disabled:opacity-60';

/**
 * The first screen: a photo, one clear primary action (start as a guest) and the other ways in as quiet glass buttons. The sign-in and
 * sign-up forms open from here. Always dark, whatever the app theme, because the picture decides the colours.
 */
export default function WelcomeScreen({
  profiles,
  isGuestLoading,
  isRestoring,
  isDemoLoading,
  onGuest,
  onLogin,
  onRegister,
  onRestore,
  onDemo,
  onOpenProfile,
}: WelcomeScreenProps) {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  return (
    // Phone: the photo fills the screen behind the content. Desktop (md+): the screen splits in half - content on one side, the photo in a frame on the other.
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-zinc-950 text-white md:grid md:grid-cols-2">
      <img src="/images/welcome.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] md:hidden" {...{ fetchpriority: 'high' }} />
      {/* Darkens the bright windows at the top and builds a calm, readable base for the text and buttons. */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/10 to-zinc-950/10 md:hidden" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-transparent md:hidden" />
      {/* Desktop only: a soft lime wash behind the content so the glass has something to blur. */}
      <div className="pointer-events-none absolute -start-40 top-1/3 hidden h-[34rem] w-[34rem] rounded-full bg-lime-400/10 blur-3xl md:block" />

      <div className="relative flex flex-1 flex-col md:mx-auto md:w-full md:max-w-lg md:justify-center md:gap-10 md:px-8">
      <header className="relative flex items-center gap-2.5 px-6 pt-[max(env(safe-area-inset-top),1.5rem)] md:px-0 md:pt-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400 text-zinc-950 shadow-lg">
          <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <span className="font-display text-xl tracking-tight">MacroLift</span>
      </header>

      <main className="relative mt-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] md:mt-0 md:px-0 md:pb-0">
        <h1 className="font-display text-[2.15rem] leading-[1.15] tracking-tight md:text-5xl md:leading-[1.1]">
          האימון והתזונה שלך,
          <br />
          <span className="text-lime-400">במקום אחד</span>
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-300">
          מעקב קלוריות, אימונים וצעדים. הכול נשמר רק אצלך, על המכשיר.
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-[1.75rem] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-xl">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenProfile(p.id)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right transition active:scale-[0.99] hover:bg-white/15"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-400/20 text-sm font-bold text-lime-300">
                  {p.fullName.slice(0, 1) || '?'}
                </span>
                <span className="truncate text-sm font-semibold">המשך כ{p.fullName}</span>
              </span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-zinc-300" />
            </button>
          ))}

          <button
            type="button"
            onClick={onGuest}
            disabled={isGuestLoading}
            className="flex items-center justify-between rounded-2xl bg-lime-400 py-2 pe-2 ps-6 text-zinc-950 shadow-[0_10px_30px_-10px_rgba(163,230,53,0.7)] transition active:scale-[0.98] disabled:opacity-70"
          >
            <span className="text-base font-extrabold">{isGuestLoading ? 'יוצר פרופיל...' : 'התחל כאורח'}</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-lime-400">
              {isGuestLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeft className="h-5 w-5" />}
            </span>
          </button>

          <div className="flex gap-2">
            <button type="button" onClick={onLogin} className={glassButton}>
              <LogIn className="h-4 w-4 text-lime-300" />
              התחברות
            </button>
            <button type="button" onClick={onRegister} className={glassButton}>
              <UserPlus className="h-4 w-4 text-lime-300" />
              הרשמה
            </button>
            <button type="button" onClick={onRestore} disabled={isRestoring} className={glassButton}>
              {isRestoring ? <Loader2 className="h-4 w-4 animate-spin text-lime-300" /> : <FileUp className="h-4 w-4 text-lime-300" />}
              שחזור מגיבוי
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            onClick={onDemo}
            disabled={isDemoLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 underline-offset-4 hover:underline disabled:opacity-60"
          >
            {isDemoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-lime-300" />}
            {isDemoLoading ? 'טוען נתוני דמו...' : 'רוצה להתרשם קודם? נסו משתמש דמו'}
          </button>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            אורח, הרשמה ושחזור נשמרים על המכשיר בלבד, בלי חשבון בענן.{' '}
            <button type="button" onClick={() => setIsPrivacyOpen(true)} className="underline underline-offset-2 hover:text-zinc-200">
              פרטיות ותנאי שימוש
            </button>
          </p>
        </div>
      </main>
      </div>

      <div className="relative hidden p-4 md:block">
        <div className="relative h-full min-h-[30rem] overflow-hidden rounded-[2rem] border border-white/10">
          <img src="/images/welcome.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 via-transparent to-zinc-950/20" />
        </div>
      </div>
      {isPrivacyOpen && <PrivacyTermsModal onClose={() => setIsPrivacyOpen(false)} />}
    </div>
  );
}
