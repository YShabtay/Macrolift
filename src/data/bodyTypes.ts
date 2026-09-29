import type { BodyState } from '../types/fitness';

export interface BodyTypeOption {
  value: BodyState;
  label: string;
  description: string;
  /** Path to a static illustration under /public/images/body-types/. */
  image: string;
}

/**
 * Static body-type cards shown in onboarding. Images are plain local files
 * (SVG placeholders for now) rather than dynamically generated icons, so the
 * exact same illustration renders everywhere until real photography is added.
 */
export const BODY_TYPE_OPTIONS: BodyTypeOption[] = [
  {
    value: 'lean',
    label: 'רזה / אחוז שומן נמוך',
    description: 'מסת שריר נמוכה יחסית, קווי מתאר רזים',
    image: '/images/body-types/lean.svg',
  },
  {
    value: 'athletic',
    label: 'אתלטי / ממוצע',
    description: 'מבנה גוף מאוזן, פעילות גופנית סדירה',
    image: '/images/body-types/athletic.svg',
  },
  {
    value: 'higher_fat',
    label: 'מסה גבוהה / עודף משקל קל',
    description: 'אחוז שומן גבוה יותר, בסיס טוב לבניית מסת שריר',
    image: '/images/body-types/higher-fat.svg',
  },
];
