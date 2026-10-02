import type { FoodPer100g, ServingUnit } from '../types/fitness';

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

function food(
  id: string,
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  servingUnits?: ServingUnit[],
): FoodPer100g {
  return { id, name, calories, protein, carbs, fat, servingUnit: 'גרם', servingUnits };
}

const unit = (name: string, grams: number): ServingUnit => ({ name, grams });

/**
 * Offline quick-search database: staple foods common in Israel, normalized per 100 grams
 * (cooked weight where the name says "מבושל"/"צלוי"/"אפוי", otherwise raw/as sold). Values are
 * typical averages from standard nutrition tables - good enough for daily tracking, not lab-exact.
 */
export const COMMON_FOODS: FoodPer100g[] = [
  // Poultry & meat
  food('chicken-breast-cooked', 'חזה עוף מבושל', 165, 31, 0, 3.6),
  food('chicken-breast-raw', 'חזה עוף נא', 120, 22.5, 0, 2.6),
  food('chicken-thigh-roasted', 'שוק עוף צלוי עם עור', 210, 26, 0, 11),
  food('chicken-schnitzel', 'שניצל עוף מטוגן', 250, 17, 14, 14, [unit('יחידה', 100)]),
  food('turkey-breast', 'חזה הודו מבושל', 135, 30, 0, 1.5),
  food('beef-ground-cooked', 'בשר בקר טחון מבושל', 217, 26, 0, 12),
  food('beef-entrecote', 'אנטריקוט בקר צלוי', 271, 25, 0, 19),
  food('beef-sirloin', 'סינטה בקר צלוי', 185, 29, 0, 7.5),
  food('chicken-liver', 'כבד עוף מבושל', 167, 24, 1, 6.5),
  // Fish
  food('tuna-water', 'טונה במים (מסוננת)', 116, 26, 0, 1, [unit('קופסה', 120)]),
  food('salmon-baked', 'סלמון אפוי', 206, 22, 0, 12),
  food('sea-bream', 'דניס צלוי', 120, 20, 0, 4),
  food('tilapia', 'אמנון אפוי', 128, 26, 0, 2.7),
  food('sardines-oil', 'סרדינים בשמן (מסוננים)', 208, 25, 0, 11, [unit('קופסה', 90)]),
  // Eggs & dairy
  food('egg-whole', 'ביצה שלמה', 155, 13, 1.1, 11, [unit('יחידה', 55)]),
  food('egg-white', 'חלבון ביצה', 52, 11, 0.7, 0.2, [unit('יחידה', 33)]),
  food('cottage-5', 'קוטג׳ 5%', 110, 11, 3.5, 5, [unit('גביע', 250)]),
  food('cottage-3', 'קוטג׳ 3%', 90, 11, 3.5, 3, [unit('גביע', 250)]),
  food('yogurt-plain-3', 'יוגורט טבעי 3%', 61, 3.5, 4.7, 3, [unit('גביע', 200)]),
  food('yogurt-greek-0', 'יוגורט יווני 0%', 59, 10, 3.6, 0.4, [unit('גביע', 150)]),
  food('white-cheese-5', 'גבינה לבנה 5%', 100, 9, 3.5, 5, [unit('גביע', 250), unit('כף', 20)]),
  food('yellow-cheese-28', 'גבינה צהובה 28%', 340, 26, 1, 26, [unit('פרוסה', 20)]),
  food('mozzarella', 'מוצרלה', 280, 22, 2.2, 22),
  food('cream-cheese', 'גבינת שמנת', 250, 6, 4, 24),
  food('milk-3', 'חלב 3%', 60, 3.3, 4.8, 3, [unit('כוס', 240)]),
  // Grains & carbs
  food('rice-white-cooked', 'אורז לבן מבושל', 130, 2.7, 28, 0.3, [unit('כוס', 160)]),
  food('rice-brown-cooked', 'אורז מלא מבושל', 123, 2.7, 26, 1, [unit('כוס', 160)]),
  food('pasta-cooked', 'פסטה מבושלת', 158, 5.8, 31, 0.9, [unit('כוס', 140)]),
  food('couscous-cooked', 'קוסקוס מבושל', 112, 3.8, 23, 0.2),
  food('quinoa-cooked', 'קינואה מבושלת', 120, 4.4, 21, 1.9, [unit('כוס', 185)]),
  food('bulgur-cooked', 'בורגול מבושל', 83, 3, 19, 0.2),
  food('oats-dry', 'שיבולת שועל (יבשה)', 389, 17, 66, 7, [unit('כוס', 80), unit('כף', 7)]),
  food('bread-whole', 'לחם מלא', 247, 13, 41, 3.4, [unit('פרוסה', 32)]),
  food('bread-white', 'לחם לבן', 265, 9, 49, 3.2, [unit('פרוסה', 28)]),
  food('pita', 'פיתה', 275, 9, 55, 1.2, [unit('יחידה', 90)]),
  food('cornflakes', 'קורנפלקס', 357, 7, 84, 0.4, [unit('כוס', 30)]),
  food('potato-boiled', 'תפוח אדמה מבושל', 87, 1.9, 20, 0.1, [unit('יחידה', 150)]),
  food('sweet-potato-baked', 'בטטה אפויה', 90, 2, 21, 0.1),
  food('chickpeas-cooked', 'חומוס (גרגרים) מבושל', 164, 8.9, 27, 2.6),
  food('lentils-cooked', 'עדשים מבושלות', 116, 9, 20, 0.4),
  food('hummus-spread', 'חומוס (ממרח)', 180, 8, 14, 11, [unit('כף', 25)]),
  food('tahini', 'טחינה גולמית', 595, 17, 21, 54, [unit('כף', 15), unit('כפית', 5)]),
  food('falafel', 'פלאפל מטוגן', 333, 13, 32, 18, [unit('כדור', 17)]),
  // Fruit & vegetables
  food('banana', 'בננה', 89, 1.1, 23, 0.3, [unit('יחידה', 120)]),
  food('apple', 'תפוח עץ', 52, 0.3, 14, 0.2, [unit('יחידה', 180)]),
  food('orange', 'תפוז', 47, 0.9, 12, 0.1, [unit('יחידה', 150)]),
  food('grapes', 'ענבים', 69, 0.7, 18, 0.2),
  food('dates-medjool', 'תמר מג׳הול', 277, 1.8, 75, 0.2, [unit('יחידה', 20)]),
  food('avocado', 'אבוקדו', 160, 2, 9, 15, [unit('יחידה', 150), unit('חצי אבוקדו', 75)]),
  food('cucumber', 'מלפפון', 15, 0.7, 3.6, 0.1, [unit('יחידה', 110)]),
  food('tomato', 'עגבנייה', 18, 0.9, 3.9, 0.2, [unit('יחידה', 120)]),
  food('carrot', 'גזר', 41, 0.9, 10, 0.2, [unit('יחידה', 70)]),
  food('broccoli-cooked', 'ברוקולי מבושל', 35, 2.4, 7, 0.4),
  food('lettuce', 'חסה', 15, 1.4, 2.9, 0.2),
  food('pepper-red', 'פלפל אדום', 31, 1, 6, 0.3, [unit('יחידה', 150)]),
  // Fats, nuts & extras
  food('olive-oil', 'שמן זית', 884, 0, 0, 100, [unit('כף', 15), unit('כפית', 5)]),
  food('butter', 'חמאה', 717, 0.9, 0.1, 81, [unit('כף', 15), unit('כפית', 5)]),
  food('almonds', 'שקדים', 579, 21, 22, 50, [unit('שקד', 1.2), unit('חופן', 28)]),
  food('walnuts', 'אגוזי מלך', 654, 15, 14, 65, [unit('אגוז שלם', 5), unit('חצי אגוז', 3), unit('חופן', 30)]),
  food('peanut-butter', 'חמאת בוטנים', 588, 25, 20, 50, [unit('כף', 15), unit('כפית', 5)]),
  food('whey-protein', 'אבקת חלבון (מי גבינה)', 400, 80, 8, 6, [unit('סקופ', 30)]),
  food('dark-chocolate', 'שוקולד מריר 70%', 598, 8, 46, 43, [unit('קובייה', 10)]),
  food('honey', 'דבש', 304, 0.3, 82, 0, [unit('כף', 21), unit('כפית', 7)]),
  food('sugar', 'סוכר', 387, 0, 100, 0, [unit('כפית', 4)]),
];
