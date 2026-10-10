import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const LIME = '#a3e635';
const DARK = '#09090b';

mkdirSync('public/icons', { recursive: true });

function dumbbellGlyph() {
  // Bold dumbbell silhouette, centered in a 512x512 viewBox.
  return `
    <rect x="176" y="241" width="160" height="30" rx="15" fill="${DARK}" />
    <rect x="96" y="176" width="56" height="160" rx="16" fill="${DARK}" />
    <rect x="360" y="176" width="56" height="160" rx="16" fill="${DARK}" />
    <rect x="76" y="196" width="20" height="120" rx="10" fill="${DARK}" />
    <rect x="416" y="196" width="20" height="120" rx="10" fill="${DARK}" />
  `;
}

// "any" icon: gently rounded square background (OS applies its own masking on top for this purpose).
const anySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${LIME}" />
  ${dumbbellGlyph()}
</svg>`;

// "maskable" icon: full-bleed background, glyph shrunk toward the safe zone (~center 80%).
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${LIME}" />
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
    ${dumbbellGlyph()}
  </g>
</svg>`;

const jobs = [
  { svg: anySvg, size: 192, out: 'public/icons/icon-192.png' },
  { svg: anySvg, size: 512, out: 'public/icons/icon-512.png' },
  { svg: maskableSvg, size: 192, out: 'public/icons/icon-maskable-192.png' },
  { svg: maskableSvg, size: 512, out: 'public/icons/icon-maskable-512.png' },
  { svg: anySvg, size: 180, out: 'public/icons/apple-touch-icon.png' },
];

for (const job of jobs) {
  await sharp(Buffer.from(job.svg)).resize(job.size, job.size).png().toFile(job.out);
  console.log('wrote', job.out);
}
