import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, Save, X } from 'lucide-react';
import type { FoodEntry } from '../types/fitness';

interface EditMealModalProps {
  entry: FoodEntry;
  onSave: (id: string, updates: Partial<Omit<FoodEntry, 'id' | 'date' | 'meal'>>) => void;
  onClose: () => void;
}

export default function EditMealModal({ entry, onSave, onClose }: EditMealModalProps) {
  const [name, setName] = useState(entry.name);
  const [weightGrams, setWeightGrams] = useState(entry.weightGrams != null ? String(entry.weightGrams) : '');
  const [calories, setCalories] = useState(String(entry.calories));
  const [proteinG, setProteinG] = useState(String(entry.proteinG));
  const [carbsG, setCarbsG] = useState(String(entry.carbsG));
  const [fatG, setFatG] = useState(String(entry.fatG));

  const originalWeight = entry.weightGrams;
  const currentWeight = Number(weightGrams);
  const canRecalculateByWeight =
    originalWeight !== undefined &&
    originalWeight > 0 &&
    weightGrams.trim() !== '' &&
    Number.isFinite(currentWeight) &&
    currentWeight > 0 &&
    currentWeight !== originalWeight;

  function handleRecalculateByWeight() {
    if (!canRecalculateByWeight || originalWeight === undefined) return;
    const ratio = currentWeight / originalWeight;
    setCalories(String(Math.round(entry.calories * ratio)));
    setProteinG(String(Math.round(entry.proteinG * ratio)));
    setCarbsG(String(Math.round(entry.carbsG * ratio)));
    setFatG(String(Math.round(entry.fatG * ratio)));
  }

  function handleSave() {
    const cal = Number(calories);
    if (!name.trim() || Number.isNaN(cal) || cal < 0) return;

    onSave(entry.id, {
      name: name.trim(),
      quantity: weightGrams.trim() ? `${weightGrams.trim()} גרם` : entry.quantity,
      weightGrams: weightGrams.trim() ? Number(weightGrams) : undefined,
      calories: cal,
      proteinG: Number(proteinG) || 0,
      carbsG: Number(carbsG) || 0,
      fatG: Number(fatG) || 0,
    });
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">עריכת ארוחה</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">שם המנה</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">משקל (גר׳)</label>
            <input
              type="number"
              inputMode="decimal"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              placeholder="לא צויין"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
            />
          </div>

          {canRecalculateByWeight && (
            <button
              type="button"
              onClick={handleRecalculateByWeight}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-lime-400/40 bg-lime-400/10 px-3 py-2 text-xs font-semibold text-lime-700 dark:text-lime-400 transition hover:border-lime-400/70 hover:bg-lime-400/20"
            >
              <Calculator className="h-3.5 w-3.5" />
              חשב מחדש לפי יחס משקל ({originalWeight}g ← {weightGrams}g)
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="קלוריות" value={calories} onChange={setCalories} valueClassName="text-lime-700 dark:text-lime-400" />
            <NumberField label="חלבון (גר׳)" value={proteinG} onChange={setProteinG} valueClassName="text-sky-700 dark:text-sky-400" />
            <NumberField label="פחמימה (גר׳)" value={carbsG} onChange={setCarbsG} valueClassName="text-amber-700 dark:text-amber-400" />
            <NumberField label="שומן (גר׳)" value={fatG} onChange={setFatG} valueClassName="text-yellow-700 dark:text-yellow-400" />
          </div>

          <button type="button" onClick={handleSave} className="btn-primary">
            <Save className="h-4 w-4" />
            שמור שינויים
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NumberField({
  label,
  value,
  onChange,
  valueClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  valueClassName: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-center text-sm font-bold outline-none focus:border-lime-400 ${valueClassName}`}
      />
    </div>
  );
}
