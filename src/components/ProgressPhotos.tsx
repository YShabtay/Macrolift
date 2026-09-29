import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Columns2, ImagePlus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import type { Goal, GoalIntensity, ProgressPhoto, WeightLog } from '../types/fitness';
import {
  daysBetween,
  estimateWeightForDate,
  formatDateDisplay,
  formatDateLong,
  todayIso,
} from '../utils/weightCalculations';
import { compressImage } from '../utils/imageCompressor';
import ProgressAIReviewModal from './ProgressAIReviewModal';
import Toast from './Toast';

const QUOTA_ERROR_MESSAGE = 'האחסון המקומי מלא, מומלץ למחוק תמונות ישנות';
const GENERIC_ERROR_MESSAGE = 'שמירת התמונה נכשלה, נסה/י תמונה אחרת';

function isQuotaExceededError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22)
  );
}

interface ProgressPhotosProps {
  photos: ProgressPhoto[];
  weightLogs: WeightLog[];
  goal: Goal;
  goalIntensity?: GoalIntensity;
  onAdd: (photo: Omit<ProgressPhoto, 'id'>) => Promise<void>;
  onDelete: (id: string) => void;
  onApplyCalorieAdjustment: (deltaKcal: number) => void;
}

/** Among photos older than the latest one, picks whichever sits closest to `targetDaysAgo` before it. */
function pickDefaultBeforePhoto(sortedPhotos: ProgressPhoto[], targetDaysAgo = 28): ProgressPhoto {
  const latest = sortedPhotos[sortedPhotos.length - 1];
  let closest = sortedPhotos[0];
  let closestDiff = Infinity;
  for (const photo of sortedPhotos) {
    if (photo.id === latest.id) continue;
    const diff = Math.abs(Math.abs(daysBetween(photo.date, latest.date)) - targetDaysAgo);
    if (diff < closestDiff) {
      closest = photo;
      closestDiff = diff;
    }
  }
  return closest;
}

export default function ProgressPhotos({
  photos,
  weightLogs,
  goal,
  goalIntensity,
  onAdd,
  onDelete,
  onApplyCalorieAdjustment,
}: ProgressPhotosProps) {
  const today = todayIso();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDate, setPendingDate] = useState(today);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<ProgressPhoto | null>(null);
  const [isAIReviewOpen, setIsAIReviewOpen] = useState(false);

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [photos],
  );

  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const beforePhoto = sortedPhotos.find((p) => p.id === beforeId) ?? (sortedPhotos.length >= 2 ? pickDefaultBeforePhoto(sortedPhotos) : sortedPhotos[0]);
  const afterPhoto = sortedPhotos.find((p) => p.id === afterId) ?? sortedPhotos[sortedPhotos.length - 1];

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setIsProcessing(true);
    try {
      const photoUrl = await compressImage(file);
      const weightKg = estimateWeightForDate(weightLogs, pendingDate);
      await onAdd({ date: pendingDate, photoUrl, weightKg });
      setToastMessage('התמונה נשמרה בהצלחה');
    } catch (err) {
      setError(isQuotaExceededError(err) ? QUOTA_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-card p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Camera className="h-5 w-5 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">תמונות התקדמות</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
          תיעוד ויזואלי חודשי עוזר לראות שינויים שהמשקל לבדו לא תמיד מספר.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="date"
            value={pendingDate}
            max={today}
            onChange={(e) => setPendingDate(e.target.value)}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 sm:flex-1"
          />
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary shrink-0 disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            {isProcessing ? 'מעבד תמונה...' : 'העלאת תמונה'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-400">{error}</p>}
      </div>

      {sortedPhotos.length >= 2 && (
        <>
          <BeforeAfterComparison
            photos={sortedPhotos}
            weightLogs={weightLogs}
            goal={goal}
            beforeId={beforePhoto.id}
            afterId={afterPhoto.id}
            onChangeBeforeId={setBeforeId}
            onChangeAfterId={setAfterId}
          />
          <button
            type="button"
            onClick={() => setIsAIReviewOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-lime-400/40 bg-lime-400/10 px-4 py-3.5 font-semibold text-lime-700 dark:text-lime-400 shadow-glow transition hover:border-lime-400/70 hover:bg-lime-400/20"
          >
            <Sparkles className="h-4 w-4" />
            ניתוח התקדמות עם AI ✨
          </button>
        </>
      )}

      <div className="glass-card p-5 sm:p-6">
        <h3 className="mb-4 font-bold text-zinc-900 dark:text-zinc-100">ציר זמן</h3>
        {sortedPhotos.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-500">עדיין לא הועלו תמונות. התמונה הראשונה שלך תופיע כאן.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {[...sortedPhotos].reverse().map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewingPhoto(photo)}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 transition hover:border-lime-400/50"
              >
                <img src={photo.photoUrl} alt={photo.date} className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-[11px] font-semibold text-white">{formatDateDisplay(photo.date)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {viewingPhoto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-4 backdrop-blur-sm animate-fade-in"
            onClick={() => setViewingPhoto(null)}
          >
            <div
              className="glass-card neon-border flex max-h-[90vh] w-full max-w-sm flex-col overflow-y-auto shadow-glow animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <img src={viewingPhoto.photoUrl} alt={viewingPhoto.date} className="w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setViewingPhoto(null)}
                  aria-label="סגירה"
                  className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950/80 text-zinc-700 dark:text-zinc-300 backdrop-blur transition hover:bg-white dark:hover:bg-zinc-900 hover:text-white active:scale-90"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">{formatDateDisplay(viewingPhoto.date)}</p>
                  {viewingPhoto.weightKg !== undefined && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-500">{viewingPhoto.weightKg} ק״ג</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(viewingPhoto.id);
                    setViewingPhoto(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-red-400 transition hover:border-red-500/40 hover:bg-red-500/5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  מחיקה
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {isAIReviewOpen && sortedPhotos.length >= 2 && (
        <ProgressAIReviewModal
          beforePhoto={beforePhoto}
          afterPhoto={afterPhoto}
          weightLogs={weightLogs}
          goal={goal}
          goalIntensity={goalIntensity}
          onApplyCalorieAdjustment={onApplyCalorieAdjustment}
          onClose={() => setIsAIReviewOpen(false)}
        />
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Before / after comparison - side-by-side grid or split slider
// ---------------------------------------------------------------------------

/** Shared across both view modes so the photo frame never changes shape when switching between them. */
const COMPARISON_ASPECT_CLASS = 'aspect-[3/4]';

type ComparisonViewMode = 'side-by-side' | 'slider';

/**
 * Whether a weight change between two progress photos is a good or bad sign depends on the
 * goal - gaining weight is the successful outcome for a lean-bulk goal, not a warning sign.
 */
function getWeightChangeInfo(delta: number, goal: Goal): { qualifier: string; tone: 'positive' | 'warning' | 'neutral' } {
  if (delta === 0) return { qualifier: 'ללא שינוי', tone: 'neutral' };
  const isGain = delta > 0;

  if (goal === 'gain_muscle') {
    return isGain ? { qualifier: 'עלייה נקייה', tone: 'positive' } : { qualifier: 'ירידה', tone: 'warning' };
  }
  if (goal === 'lose_weight') {
    return isGain ? { qualifier: 'עלייה', tone: 'warning' } : { qualifier: 'ירידה', tone: 'positive' };
  }
  return { qualifier: isGain ? 'עלייה' : 'ירידה', tone: 'neutral' };
}

function BeforeAfterComparison({
  photos,
  weightLogs,
  goal,
  beforeId,
  afterId,
  onChangeBeforeId,
  onChangeAfterId,
}: {
  photos: ProgressPhoto[];
  weightLogs: WeightLog[];
  goal: Goal;
  beforeId: string;
  afterId: string;
  onChangeBeforeId: (id: string) => void;
  onChangeAfterId: (id: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ComparisonViewMode>('side-by-side');
  const [sliderPos, setSliderPos] = useState(50);

  const before = photos.find((p) => p.id === beforeId) ?? photos[0];
  const after = photos.find((p) => p.id === afterId) ?? photos[photos.length - 1];

  const beforeWeight = before.weightKg ?? estimateWeightForDate(weightLogs, before.date);
  const afterWeight = after.weightKg ?? estimateWeightForDate(weightLogs, after.date);
  const weightDelta =
    beforeWeight !== undefined && afterWeight !== undefined
      ? Math.round((afterWeight - beforeWeight) * 10) / 10
      : null;
  const dayDelta = daysBetween(before.date, after.date);
  const weightChange = weightDelta !== null ? getWeightChangeInfo(weightDelta, goal) : null;

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">השוואת לפני / אחרי</h3>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <PhotoSelect label="לפני" photos={photos} value={beforeId} onChange={onChangeBeforeId} />
        <PhotoSelect label="אחרי" photos={photos} value={afterId} onChange={onChangeAfterId} />
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ComparisonPhotoCard photo={before} label="נקודת התחלה (לפני)" weightKg={beforeWeight} />
          <ComparisonPhotoCard photo={after} label="מצב נוכחי (אחרי)" weightKg={afterWeight} />
        </div>
      ) : (
        <div
          dir="ltr"
          className={`relative ${COMPARISON_ASPECT_CLASS} w-full select-none overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-xl`}
        >
          <img src={after.photoUrl} alt="אחרי" className="absolute inset-0 h-full w-full object-cover object-center" />
          <img
            src={before.photoUrl}
            alt="לפני"
            className="absolute inset-0 h-full w-full object-cover object-center"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          />

          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-lime-400 shadow-glow"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lime-400 text-zinc-950 shadow-glow">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5 3L1 8L5 13M11 3L15 8L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
            לפני
          </span>
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
            אחרי
          </span>

          <input
            type="range"
            min={0}
            max={100}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            aria-label="גרירת השוואת לפני ואחרי"
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-6 rounded-xl border border-lime-400/20 bg-lime-400/5 p-4 text-center">
        <div>
          <p className="text-xs text-zinc-600 dark:text-zinc-500">שינוי משקל</p>
          <p
            className={`text-2xl font-extrabold ${
              weightChange === null
                ? 'text-zinc-600 dark:text-zinc-500'
                : weightChange.tone === 'positive'
                  ? 'text-lime-700 dark:text-lime-400'
                  : weightChange.tone === 'warning'
                    ? 'text-orange-700 dark:text-orange-400'
                    : 'text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {weightDelta === null ? 'אין נתון' : `${weightDelta > 0 ? '+' : ''}${weightDelta} ק״ג`}
          </p>
          {weightChange && <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500">({weightChange.qualifier})</p>}
        </div>
        <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800" />
        <div>
          <p className="text-xs text-zinc-600 dark:text-zinc-500">ימים שחלפו</p>
          <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">{dayDelta}</p>
        </div>
      </div>
    </div>
  );
}

function ViewModeToggle({ mode, onChange }: { mode: ComparisonViewMode; onChange: (mode: ComparisonViewMode) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
      <button
        type="button"
        onClick={() => onChange('side-by-side')}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
          mode === 'side-by-side'
            ? 'bg-lime-400 text-zinc-950'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
        }`}
      >
        <Columns2 className="h-3.5 w-3.5" />
        זו לצד זו
      </button>
      <button
        type="button"
        onClick={() => onChange('slider')}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
          mode === 'slider'
            ? 'bg-lime-400 text-zinc-950'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        סליידר השוואה
      </button>
    </div>
  );
}

function ComparisonPhotoCard({ photo, label, weightKg }: { photo: ProgressPhoto; label: string; weightKg?: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-xl">
      <div className={COMPARISON_ASPECT_CLASS}>
        <img src={photo.photoUrl} alt={label} className="h-full w-full object-cover object-center" />
      </div>
      <span className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
        {label}
      </span>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-zinc-950/70 p-3 backdrop-blur-md">
        <span className="text-xs font-medium text-zinc-200">{formatDateLong(photo.date)}</span>
        {weightKg !== undefined && <span className="text-xs font-bold text-lime-400">{weightKg} ק״ג</span>}
      </div>
    </div>
  );
}

function PhotoSelect({
  label,
  photos,
  value,
  onChange,
}: {
  label: string;
  photos: ProgressPhoto[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
      >
        {photos.map((photo) => (
          <option key={photo.id} value={photo.id}>
            {formatDateDisplay(photo.date)}
          </option>
        ))}
      </select>
    </div>
  );
}
