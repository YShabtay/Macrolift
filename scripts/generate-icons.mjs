// Renders the app icons from the logo geometry below. Needs sharp, which is not a project dependency: run `npm i --no-save sharp` first, then `node scripts/generate-icons.mjs`.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const LIME = '#a3e635';
const DARK = '#09090b';

mkdirSync('public/icons', { recursive: true });

/**
 * The logo: a bold, centered lime dumbbell on a dark tile, the same everywhere (home screen, browser tab, inside the app). Drawn on a 512 grid inside the central
 * 73%, so it also fits the safe zone of a maskable icon. The same geometry is in src/components/LogoMark.tsx.
 */
function dumbbell(color) {
  return `
    <rect x="161" y="238" width="190" height="36" rx="18" fill="${color}" />
    <rect x="116" y="156" width="52" height="200" rx="20" fill="${color}" />
    <rect x="344" y="156" width="52" height="200" rx="20" fill="${color}" />
    <rect x="70" y="186" width="38" height="140" rx="16" fill="${color}" />
    <rect x="404" y="186" width="38" height="140" rx="16" fill="${color}" />
  `;
}

// Dark with a lime mark rather than the other way round: iOS darkens a light icon in its dark appearance, which turned a lime tile black and hid the mark.
// "any" icon: a gently rounded dark square (the OS may mask it further).
const anySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${DARK}" />
  ${dumbbell(LIME)}
</svg>`;

// Full-bleed square for the maskable icon and the iOS home-screen icon (the OS rounds the corners itself).
const fullBleedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${DARK}" />
  ${dumbbell(LIME)}
</svg>`;

// The browser-tab icon: the same mark on a rounded dark square.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${DARK}" />
  ${dumbbell(LIME)}
</svg>
`;
writeFileSync('public/favicon.svg', faviconSvg);
console.log('wrote public/favicon.svg');

const jobs = [
  { svg: anySvg, size: 192, out: 'public/icons/icon-192.png' },
  { svg: anySvg, size: 512, out: 'public/icons/icon-512.png' },
  { svg: fullBleedSvg, size: 192, out: 'public/icons/icon-maskable-192.png' },
  { svg: fullBleedSvg, size: 512, out: 'public/icons/icon-maskable-512.png' },
  { svg: fullBleedSvg, size: 180, out: 'public/icons/apple-touch-icon.png' },
];

for (const job of jobs) {
  await sharp(Buffer.from(job.svg)).resize(job.size, job.size).png().toFile(job.out);
  console.log('wrote', job.out);
}
