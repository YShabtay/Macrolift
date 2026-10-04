import { Clock, Star, Trash2, UtensilsCrossed } from 'lucide-react';
import type { FavoriteFood, FoodTemplate, SavedMeal } from '../types/fitness';
import { formatMacro } from '../utils/formatMacro';
import { sumTemplates } from '../utils/foodShortcuts';

interface QuickFoodShortcutsProps {
  favorites: FavoriteFood[];
  recents: FoodTemplate[];
  savedMeals: SavedMeal[];
  /** Adds one food / a whole saved meal to the meal being filled. */
  onAddFood: (food: FoodTemplate) => void;
  onAddMeal: (meal: SavedMeal) => void;
  onRemoveFavorite: (food: FavoriteFood) => void;
  onDeleteSavedMeal: (meal: SavedMeal) => void;
}

function FoodChip({ food, onClick }: { food: FoodTemplate; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-36 shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-2.5 text-right transition hover:border-lime-400/50 active:scale-95"
    >
      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{food.unitLabel ?? food.name}</p>
      <p className="mt-0.5 truncate text-[10px] text-zinc-600 dark:text-zinc-500">
        {food.quantity} &bull; {formatMacro(food.calories)} קק״ל
      </p>
    </button>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Star; children: string }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-500">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </p>
  );
}

/** One-tap shortcuts at the top of "add food": starred foods, what was eaten lately, and saved meals. Renders nothing when there are none yet. */
export default function QuickFoodShortcuts({ favorites, recents, savedMeals, onAddFood, onAddMeal, onRemoveFavorite, onDeleteSavedMeal }: QuickFoodShortcutsProps) {
  if (favorites.length === 0 && recents.length === 0 && savedMeals.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {savedMeals.length > 0 && (
        <div>
          <SectionTitle icon={UtensilsCrossed}>ארוחות שמורות</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {savedMeals.map((meal) => {
              const totals = sumTemplates(meal.items);
              return (
                <div key={meal.id} className="flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 pe-1.5">
                  <button type="button" onClick={() => onAddMeal(meal)} className="min-w-0 flex-1 p-2.5 text-right transition hover:text-lime-700 dark:hover:text-lime-400">
                    <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{meal.name}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-600 dark:text-zinc-500">
                      {meal.items.length} פריטים &bull; {formatMacro(totals.calories)} קק״ל &bull; {formatMacro(totals.proteinG)}ח׳
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSavedMeal(meal)}
                    aria-label={`מחיקת הארוחה השמורה ${meal.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {favorites.length > 0 && (
        <div>
          <SectionTitle icon={Star}>מועדפים</SectionTitle>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {favorites.map((food) => (
              <div key={food.id} className="relative">
                <FoodChip food={food} onClick={() => onAddFood(food)} />
                <button
                  type="button"
                  onClick={() => onRemoveFavorite(food)}
                  aria-label={`הסרת ${food.name} מהמועדפים`}
                  className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-amber-500 hover:bg-amber-500/10"
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {recents.length > 0 && (
        <div>
          <SectionTitle icon={Clock}>אכלת לאחרונה</SectionTitle>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {recents.map((food) => (
              <FoodChip key={`${food.name}|${food.quantity}`} food={food} onClick={() => onAddFood(food)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
