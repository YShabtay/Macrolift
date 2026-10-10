import { createLucideIcon } from 'lucide-react';

/**
 * The app's dumbbell as an icon, in the same line style as the other icons: a bar, a tall plate and a shorter plate on each side (the logo's shape). It stands in
 * for lucide's own diagonal dumbbell, so the icons inside the app match the logo.
 */
const DumbbellIcon = createLucideIcon('MacroLiftDumbbell', [
  ['path', { d: 'M8 12h8', key: 'bar' }],
  ['rect', { x: '4.75', y: '6.5', width: '3.25', height: '11', rx: '1.25', key: 'left-plate' }],
  ['rect', { x: '16', y: '6.5', width: '3.25', height: '11', rx: '1.25', key: 'right-plate' }],
  ['path', { d: 'M2 9.5v5', key: 'left-end' }],
  ['path', { d: 'M22 9.5v5', key: 'right-end' }],
]);

export default DumbbellIcon;
