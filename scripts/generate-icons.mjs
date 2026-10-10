import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const LIME = '#a3e635';
const DARK = '#09090b';

mkdirSync('public/icons', { recursive: true });

// The same dumbbell glyph the app uses for its logo and favicon (lucide's "dumbbell", a line icon), drawn on its 24x24 grid and scaled up around the center.
const GLYPH_PATHS = [
  'M14.4 14.4 9.6 9.6',
  'M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z',
  'm21.5 21.5-1.4-1.4',
  'M3.9 3.9 2.5 2.5',
  'M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z',
];

function dumbbellGlyph(scale) {
  const paths = GLYPH_PATHS.map((d) => `<path d="${d}" />`).join('');
  return `<g transform="translate(256 256) scale(${scale}) translate(-12 -12)" fill="none" stroke="${DARK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

// "any" icon: a gently rounded lime square with the dark glyph, the same as the logo inside the app. (iOS may darken a light icon when the device is in its dark
// appearance; that is the system's choice for web apps.)
const anySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${LIME}" />
  ${dumbbellGlyph(17)}
</svg>`;

// "maskable" icon (and the iOS home-screen icon): full-bleed background, the glyph kept inside the safe zone (~center 80%).
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${LIME}" />
  ${dumbbellGlyph(14)}
</svg>`;

const jobs = [
  { svg: anySvg, size: 192, out: 'public/icons/icon-192.png' },
  { svg: anySvg, size: 512, out: 'public/icons/icon-512.png' },
  { svg: maskableSvg, size: 192, out: 'public/icons/icon-maskable-192.png' },
  { svg: maskableSvg, size: 512, out: 'public/icons/icon-maskable-512.png' },
  { svg: maskableSvg, size: 180, out: 'public/icons/apple-touch-icon.png' },
];

for (const job of jobs) {
  await sharp(Buffer.from(job.svg)).resize(job.size, job.size).png().toFile(job.out);
  console.log('wrote', job.out);
}
