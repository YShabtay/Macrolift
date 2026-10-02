import { useState } from 'react';
import { Check, Dumbbell, Eye, EyeOff, Loader2, Lock, LogIn, Mail, Sparkles, User, UserPlus, X } from 'lucide-react';
import { hashPassword, loadUsers, saveUsers, setSessionUserId } from '../utils/authStorage';
import type { AuthUser } from '../utils/authStorage';
import { ThemeToggleButton } from './ThemeToggle';
import Toast from './Toast';
import { startDemoSession } from '../utils/demoData';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PasswordRule {
  key: 'length' | 'upper' | 'lower' | 'number' | 'special';
  label: string;
  isValid: boolean;
}

function getPasswordRules(password: string): PasswordRule[] {
  return [
    { key: 'length', label: 'לפחות 8 תווים', isValid: password.length >= 8 },
    { key: 'upper', label: 'אות גדולה (A-Z)', isValid: /[A-Z]/.test(password) },
    { key: 'lower', label: 'אות קטנה (a-z)', isValid: /[a-z]/.test(password) },
    { key: 'number', label: 'ספרה (0-9)', isValid: /[0-9]/.test(password) },
    { key: 'special', label: 'תו מיוחד (!@#...)', isValid: /[^A-Za-z0-9]/.test(password) },
  ];
}

const PASSWORD_RULE_ERRORS: Record<PasswordRule['key'], string> = {
  length: 'הסיסמה חייבת לכלול לפחות 8 תווים',
  upper: 'הסיסמה חייבת לכלול אות גדולה אחת לפחות',
  lower: 'הסיסמה חייבת לכלול אות קטנה אחת לפחות',
  number: 'הסיסמה חייבת לכלול ספרה אחת לפחות',
  special: 'הסיסמה חייבת לכלול תו מיוחד אחד לפחות',
};

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(rules: PasswordRule[]): PasswordStrength {
  const satisfied = rules.filter((r) => r.isValid).length;
  if (satisfied >= 5) return 'strong';
  if (satisfied >= 3) return 'medium';
  return 'weak';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Mode = 'login' | 'register';

interface AuthProps {
  onAuthenticated: (userId: string) => void;
}

export default function Auth({ onAuthenticated }: AuthProps) {
  const [mode, setMode] = useState<Mode>('login');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const passwordRules = getPasswordRules(password);
  const isPasswordValid = passwordRules.every((r) => r.isValid);
  const passwordStrength = getPasswordStrength(passwordRules);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  // Email is optional now (no verification step) - only validated when the user actually filled it in.
  const isEmailValid = email.trim() === '' || EMAIL_REGEX.test(email.trim());
  const isRegisterFormValid =
    fullName.trim().length >= 2 && username.trim().length >= 3 && isEmailValid && isPasswordValid && passwordsMatch;

  function resetFields() {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setConfirmTouched(false);
    setError(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    resetFields();
  }

  async function handleDemoLogin() {
    setIsDemoLoading(true);
    try {
      const demoUserId = await startDemoSession();
      onAuthenticated(demoUserId);
    } catch {
      setToastMessage('טעינת מצב הדמו נכשלה, נסה/י שוב');
    } finally {
      setIsDemoLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedUsername = username.trim().toLowerCase();

    if (mode === 'login') {
      if (normalizedUsername.length < 3) {
        setError('שם משתמש חייב להכיל לפחות 3 תווים');
        return;
      }
      if (password.length < 1) {
        setError('יש להזין סיסמה');
        return;
      }
      setIsSubmitting(true);
      try {
        const users = await loadUsers();
        const passwordHash = await hashPassword(password);
        const existing = users.find((u) => u.username === normalizedUsername);
        if (!existing || existing.passwordHash !== passwordHash) {
          setError('שם משתמש או סיסמה שגויים');
          return;
        }
        await setSessionUserId(existing.id);
        onAuthenticated(existing.id);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Registration - validate, then create the account and sign in right away.
    const normalizedEmail = email.trim().toLowerCase();
    const failedRule = passwordRules.find((r) => !r.isValid);

    if (fullName.trim().length < 2) {
      setError('יש להזין שם מלא תקין');
      return;
    }
    if (normalizedUsername.length < 3) {
      setError('שם משתמש חייב להכיל לפחות 3 תווים');
      return;
    }
    if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
      setError('כתובת המייל אינה תקינה');
      return;
    }
    if (failedRule) {
      setError(PASSWORD_RULE_ERRORS[failedRule.key]);
      return;
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setIsSubmitting(true);
    try {
      const users = await loadUsers();
      if (users.some((u) => u.username === normalizedUsername)) {
        setError('שם המשתמש כבר תפוס, נסה/י שם אחר');
        return;
      }
      if (normalizedEmail && users.some((u) => u.email?.toLowerCase() === normalizedEmail)) {
        setError('כתובת המייל כבר רשומה במערכת');
        return;
      }
      const newUser: AuthUser = {
        id: crypto.randomUUID(),
        fullName: fullName.trim(),
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      await saveUsers([...users, newUser]);
      await setSessionUserId(newUser.id);
      onAuthenticated(newUser.id);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-10 text-zinc-900 dark:text-zinc-100">
      <div className="fixed left-4 top-[max(env(safe-area-inset-top),1rem)] z-30">
        <ThemeToggleButton />
      </div>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400 text-zinc-950 shadow-glow">
            <Dumbbell className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">MacroLift</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">כושר ותזונה אישית, בנוי בשבילך</p>
          </div>
        </div>

        <div className="glass-card p-6 sm:p-7">
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`rounded-lg py-2.5 text-sm font-bold transition ${
                    mode === 'login' ? 'bg-lime-400 text-zinc-950' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  התחברות
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`rounded-lg py-2.5 text-sm font-bold transition ${
                    mode === 'register' ? 'bg-lime-400 text-zinc-950' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  הרשמה חדשה
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {mode === 'register' && (
                  <Field icon={User} label="שם מלא">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="לדוגמה: דני כהן"
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
                    />
                  </Field>
                )}

                <Field icon={UserPlus} label="שם משתמש">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="שם משתמש"
                    autoCapitalize="none"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
                  />
                </Field>

                {mode === 'register' && (
                  <div>
                    <Field icon={Mail} label="כתובת מייל (אופציונלי)">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}
                        placeholder="name@example.com"
                        dir="ltr"
                        autoComplete="email"
                        className={`w-full rounded-xl border bg-white dark:bg-zinc-900 px-4 py-3 text-left text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:ring-2 ${
                          email && !isEmailValid
                            ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/20'
                            : 'border-zinc-300 dark:border-zinc-700 focus:border-lime-400 focus:ring-lime-400/20'
                        }`}
                      />
                    </Field>
                    {email && !isEmailValid && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                        <X className="h-3 w-3 shrink-0" />
                        כתובת המייל אינה תקינה
                      </p>
                    )}
                  </div>
                )}

                <PasswordField
                  label="סיסמה"
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggleShow={() => setShowPassword((s) => !s)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />

                {mode === 'register' && password && (
                  <div className="-mt-2">
                    <PasswordStrengthBar strength={passwordStrength} />
                    <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {passwordRules.map((rule) => (
                        <li
                          key={rule.key}
                          className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                            rule.isValid ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-500 dark:text-zinc-500'
                          }`}
                        >
                          {rule.isValid ? (
                            <Check className="h-3 w-3 shrink-0" />
                          ) : (
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-current" />
                          )}
                          {rule.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {mode === 'register' && (
                  <div>
                    <PasswordField
                      label="אימות סיסמה"
                      value={confirmPassword}
                      onChange={(v) => {
                        setConfirmPassword(v);
                        setConfirmTouched(true);
                      }}
                      show={showConfirmPassword}
                      onToggleShow={() => setShowConfirmPassword((s) => !s)}
                      autoComplete="new-password"
                    />
                    {confirmTouched && confirmPassword && (
                      <p
                        className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${
                          passwordsMatch ? 'text-lime-700 dark:text-lime-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {passwordsMatch ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
                        {passwordsMatch ? 'הסיסמאות תואמות' : 'הסיסמאות אינן תואמות'}
                      </p>
                    )}
                  </div>
                )}

                {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting || (mode === 'register' && !isRegisterFormValid)}
                  className="btn-primary mt-1 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LogIn className="h-4 w-4" />
                  {mode === 'login' ? 'התחברות' : 'יצירת חשבון'}
                </button>

                <div className="my-1 flex items-center gap-3">
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-600">או</span>
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                </div>

                <button
                  type="button"
                  disabled
                  className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3 text-sm font-semibold text-zinc-500 dark:text-zinc-500 opacity-60"
                >
                  <GoogleIcon />
                  המשך עם Google
                  <span className="mr-1 rounded-full bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    בקרוב
                  </span>
                </button>
              </form>
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isDemoLoading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-lime-400/50 bg-lime-400/5 py-3.5 text-sm font-bold text-lime-700 transition hover:bg-lime-400/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-lime-400"
        >
          {isDemoLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען נתוני דמו...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              כניסה מיידית כמשתמש דמו (התרשמות מהירה)
            </>
          )}
        </button>

        <p className="mt-5 text-center text-sm text-zinc-600 dark:text-zinc-500">
          {mode === 'login' ? (
            <>
              אין לך חשבון עדיין?{' '}
              <button type="button" onClick={() => switchMode('register')} className="font-semibold text-lime-700 dark:text-lime-400">
                הירשם/י עכשיו
              </button>
            </>
          ) : (
            <>
              כבר יש לך חשבון?{' '}
              <button type="button" onClick={() => switchMode('login')} className="font-semibold text-lime-700 dark:text-lime-400">
                התחבר/י
              </button>
            </>
          )}
        </p>
      </div>

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        <Icon className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        {label}
      </div>
      {children}
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <Field icon={Lock} label={label}>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 pl-11 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
        />
        <button
          type="button"
          onClick={onToggleShow}
          tabIndex={-1}
          aria-label={show ? 'הסתר סיסמה' : 'הצג סיסמה'}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

const STRENGTH_CONFIG: Record<PasswordStrength, { label: string; barColor: string; textColor: string; segments: number }> = {
  weak: { label: 'חלשה', barColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', segments: 1 },
  medium: { label: 'בינונית', barColor: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400', segments: 2 },
  strong: { label: 'חזקה', barColor: 'bg-lime-400', textColor: 'text-lime-700 dark:text-lime-400', segments: 3 },
};

function PasswordStrengthBar({ strength }: { strength: PasswordStrength }) {
  const config = STRENGTH_CONFIG[strength];
  return (
    <div>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((seg) => (
          <div
            key={seg}
            className={`h-1.5 flex-1 rounded-full transition-colors ${seg <= config.segments ? config.barColor : 'bg-zinc-200 dark:bg-zinc-800'}`}
          />
        ))}
      </div>
      <p className={`mt-1 text-[11px] font-semibold ${config.textColor}`}>חוזק סיסמה: {config.label}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z" />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z"
      />
      <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.95H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
