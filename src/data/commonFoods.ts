export interface QuickFoodItem {
  name: string;
  quantity: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** A small, curated set of common items for one-tap logging. Values are typical/average per the stated quantity. */
export const QUICK_FOODS: QuickFoodItem[] = [
  { name: 'ביצה L', quantity: '1 יחידה', calories: 78, proteinG: 6.5, fatG: 5.5, carbsG: 0.5 },
  { name: 'פרוסת לחם מלא', quantity: '1 פרוסה', calories: 80, proteinG: 3.5, fatG: 1, carbsG: 15 },
  { name: 'חזה עוף מבושל', quantity: '100 גרם', calories: 165, proteinG: 31, fatG: 3.5, carbsG: 0 },
  { name: 'פרוסת גבינה צהובה', quantity: '1 פרוסה', calories: 100, proteinG: 6, fatG: 8, carbsG: 1 },
  { name: 'שמן זית', quantity: '1 כף', calories: 120, proteinG: 0, fatG: 14, carbsG: 0 },
  { name: 'קוטג׳ 5%', quantity: '100 גרם', calories: 110, proteinG: 11, fatG: 5, carbsG: 3.5 },
  { name: 'אורז לבן מבושל', quantity: '100 גרם', calories: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 },
  { name: 'שיבולת שועל', quantity: '50 גרם יבש', calories: 190, proteinG: 6.5, fatG: 3.5, carbsG: 33 },
  { name: 'יוגורט טבעי 3%', quantity: '100 גרם', calories: 60, proteinG: 3.5, fatG: 3, carbsG: 4.5 },
  { name: 'בננה', quantity: '1 יחידה בינונית', calories: 105, proteinG: 1.3, fatG: 0.4, carbsG: 27 },
  { name: 'אבוקדו', quantity: 'חצי יחידה', calories: 160, proteinG: 2, fatG: 15, carbsG: 8.5 },
  { name: 'שקדים', quantity: '30 גרם', calories: 175, proteinG: 6.5, fatG: 15, carbsG: 6 },
  { name: 'טונה במים', quantity: '1 קופסה (150 גרם)', calories: 140, proteinG: 32, fatG: 1, carbsG: 0 },
  { name: 'חטיף חלבון', quantity: '1 יחידה', calories: 210, proteinG: 20, fatG: 7, carbsG: 20 },
  { name: 'אבקת חלבון (מי גבינה)', quantity: '1 מנה (30 גרם)', calories: 120, proteinG: 24, fatG: 1.5, carbsG: 3 },
];
