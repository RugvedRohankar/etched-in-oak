// Generates the placeholder "product photos" in public/images.
// Every image is an illustration of an engraved walnut slice, standing in for
// a real product photo. To swap one, replace the file in public/images with a
// photo of the same name, then remove data-placeholder from its <figure> in
// index.html so the "Placeholder" chip goes away.
//
//   npm run placeholders

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images');
const BURN = '#2B180D';
const SERIF = 'Times New Roman, Times, serif';

const f = (n) => Number(n.toFixed(2));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- engraving primitives (local units: slice radius = 100) ---------- */

const txt = (s, y, size, o = {}) =>
  `<text x="${f((o.x ?? 0) + (o.ls ?? 0) / 2)}" y="${y}" text-anchor="middle" font-family="${SERIF}" font-size="${size}"${
    o.italic ? ' font-style="italic"' : ''
  }${o.ls ? ` letter-spacing="${o.ls}"` : ''} fill="${BURN}">${esc(s)}</text>`;

const stroke = (d, w = 1.2, extra = '') =>
  `<path d="${d}" fill="none" stroke="${BURN}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

const leaf = (x, y, len, w, rot, filled = true) =>
  `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})" d="M0 0 Q${f(len / 2)} ${f(-w)} ${f(len)} 0 Q${f(len / 2)} ${f(w)} 0 0Z${
    filled ? '' : ` M0 0 L${f(len * 0.9)} 0`
  }" ${filled ? `fill="${BURN}"` : `fill="none" stroke="${BURN}" stroke-width="0.9" stroke-linejoin="round"`}/>`;

const dot = (x, y, r = 1.1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${BURN}"/>`;

const pine = (x, y, h) => {
  const w = h * 0.5;
  const p = (a, b) => `${f(a)} ${f(b)}`;
  return `<path transform="translate(${f(x)} ${f(y)})" d="M${p(0, -h)} L${p(w * 0.45, -h * 0.6)} L${p(w * 0.2, -h * 0.6)} L${p(w * 0.72, -h * 0.25)} L${p(w * 0.3, -h * 0.25)} L${p(w, h * 0.12)} L${p(-w, h * 0.12)} L${p(-w * 0.3, -h * 0.25)} L${p(-w * 0.72, -h * 0.25)} L${p(-w * 0.2, -h * 0.6)} L${p(-w * 0.45, -h * 0.6)}Z M${p(-h * 0.06, h * 0.12)} h${f(h * 0.12)} v${f(h * 0.2)} h${f(-h * 0.12)}Z" fill="${BURN}"/>`;
};

/* ---------- designs still shown as placeholders ---------- */

const designs = {
  blank: () => '',

  vinyl: () => {
    let out = '';
    for (let r = 31; r <= 84; r += 2.6) {
      const gap = Math.abs(r - 49.2) < 1.4 || Math.abs(r - 67.4) < 1.4;
      if (!gap) out += `<circle r="${f(r)}" fill="none" stroke="${BURN}" stroke-width="${r > 82 ? 1.3 : 0.55}" opacity="0.85"/>`;
    }
    return (
      out +
      `<circle r="27" fill="none" stroke="${BURN}" stroke-width="1.2"/>` +
      txt('Your Name', -5, 11.5, { italic: true }) +
      txt('SIDE A', 16, 5.2, { ls: 2.2 }) +
      `<circle r="2.4" fill="${BURN}"/>`
    );
  },

  mountain: (uid) =>
    `<defs><clipPath id="mc-${uid}"><circle r="76"/></clipPath></defs>` +
    `<circle r="80" fill="none" stroke="${BURN}" stroke-width="1.4"/><circle r="76.5" fill="none" stroke="${BURN}" stroke-width="0.6"/>` +
    `<g clip-path="url(#mc-${uid})">` +
    `<circle cx="26" cy="-38" r="12" fill="none" stroke="${BURN}" stroke-width="1.2"/>` +
    stroke('M-58 -50 H-34 M-66 -42 H-46 M44 -58 H62', 0.7) +
    stroke('M-80 12 L-52 -24 L-36 -6 L-8 -46 L16 -12 L34 -28 L80 16', 1.5) +
    stroke('M-16 -34 L-9 -28 L-3 -35 L4 -29 M-58 -16 L-52 -11 L-46 -17 M28 -20 L34 -15 L40 -21', 1) +
    stroke('M-2 -30 L8 -8 M-44 -6 L-38 6 M38 -14 L46 2 M4 -22 L10 -10', 0.6) +
    `<path d="M-80 34 L-54 8 L-36 24 L-6 -2 L20 26 L44 10 L80 36 L80 80 L-80 80Z" fill="${BURN}" opacity="0.93"/>` +
    pine(-62, 18, 15) + pine(-44, 22, 12) + pine(28, 22, 13) + pine(56, 22, 16) + pine(-20, 16, 11) +
    `<path d="M-70 52 Q-40 46 -10 52 T50 52 M-56 62 Q-30 57 -4 62 T44 62" fill="none" stroke="#C9A070" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>` +
    '</g>',

  botanical: () => {
    const P = [[-8, 66], [-14, 22], [8, -18], [2, -66]];
    const at = (t) => {
      const u = 1 - t;
      const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      const d = [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
      const sum = (w, i) => w.reduce((acc, k, j) => acc + k * P[j][i], 0);
      return { x: sum(b, 0), y: sum(b, 1), ang: (Math.atan2(sum(d, 1), sum(d, 0)) * 180) / Math.PI };
    };
    let out =
      `<circle r="80" fill="none" stroke="${BURN}" stroke-width="1.3"/>` +
      stroke(`M${P[0].join(' ')} C${P[1].join(' ')} ${P[2].join(' ')} ${P[3].join(' ')}`, 1.3);
    for (let i = 0; i < 9; i++) {
      const t = 0.14 + i * 0.095;
      const { x, y, ang } = at(t);
      const len = 30 * (1 - t * 0.62);
      out += leaf(x, y, len, len * 0.3, ang + (i % 2 ? 46 : -46), false);
      out += leaf(x, y, len * 0.92, len * 0.28, ang + (i % 2 ? -52 : 52), false);
    }
    // two berry sprigs
    out += stroke('M-10 50 Q-38 40 -52 14 M-30 42 L-40 44 M-42 30 L-52 34 M-48 20 L-58 18', 0.9);
    out += dot(-52, 14, 2.6) + dot(-40, 44, 2.4) + dot(-52, 34, 2.4) + dot(-58, 18, 2.2);
    out += stroke('M-4 44 Q30 40 50 10 M26 38 L36 42 M40 26 L50 30 M47 16 L56 12', 0.9);
    out += dot(50, 10, 2.6) + dot(36, 42, 2.4) + dot(50, 30, 2.4) + dot(56, 12, 2.2);
    return out;
  },
};

/* ---------- shared defs ---------- */

function defs(seed, blur) {
  return `<defs>
  <radialGradient id="face" cx="0" cy="0" r="91" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#A97C53"/><stop offset="0.16" stop-color="#B58960"/><stop offset="0.34" stop-color="#CBA171"/>
    <stop offset="0.8" stop-color="#D7B484"/><stop offset="1" stop-color="#CFA878"/>
  </radialGradient>
  <linearGradient id="light" x1="-70" y1="-80" x2="70" y2="80" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFF4DC" stop-opacity="0.2"/><stop offset="0.5" stop-color="#FFF4DC" stop-opacity="0"/>
    <stop offset="1" stop-color="#1E0F05" stop-opacity="0.16"/>
  </linearGradient>
  <radialGradient id="rim" cx="0" cy="0" r="91" gradientUnits="userSpaceOnUse">
    <stop offset="0.86" stop-color="#3A2314" stop-opacity="0"/><stop offset="1" stop-color="#3A2314" stop-opacity="0.34"/>
  </radialGradient>
  <filter id="bark" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="${seed}" result="n1"/>
    <feDisplacementMap in="SourceGraphic" in2="n1" scale="7" xChannelSelector="R" yChannelSelector="G" result="shape"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="${seed + 3}" result="n2"/>
    <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.09  0 0 0 0 0.055  0 0 0 0 0.03  0 0 0 1.5 -0.5" result="speck"/>
    <feComposite in="speck" in2="shape" operator="in" result="speckIn"/>
    <feMerge><feMergeNode in="shape"/><feMergeNode in="speckIn"/></feMerge>
  </filter>
  <filter id="wobble" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="${seed + 7}"/>
    <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="pores" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="${seed + 11}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.17  0 0 0 0 0.08  0 0 0 0.9 -0.34"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="burn" x="-6%" y="-6%" width="112%" height="112%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="b"/>
    <feFlood flood-color="#5B3317" flood-opacity="0.5"/><feComposite in2="b" operator="in" result="halo"/>
    <feOffset in="SourceAlpha" dx="0.45" dy="0.55" result="o"/>
    <feFlood flood-color="#F6DFB8" flood-opacity="0.4"/><feComposite in2="o" operator="in" result="hl"/>
    <feMerge><feMergeNode in="hl"/><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${blur}"/></filter>
  <filter id="contact" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(blur * 0.25)}"/></filter>
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="3" seed="${seed + 17}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0 0.14  0 0 0 0.55 -0.2"/>
  </filter>
  <filter id="table" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0022 0.055" numOctaves="4" seed="${seed + 23}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 1.7 -0.62"/>
  </filter>
  <filter id="tablelight" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.04" numOctaves="3" seed="${seed + 29}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.4  0 0 0 0 0.24  0 0 0 1.2 -0.62"/>
  </filter>
  <clipPath id="faceclip"><circle r="91"/></clipPath>
</defs>`;
}

/* ---------- pieces of a shot ---------- */

function backdrop(kind, W, H) {
  const vig = `<radialGradient id="vig" cx="0.42" cy="0.4" r="0.85"><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1A0E06" stop-opacity="${
    kind === 'walnut' ? 0.5 : 0.2
  }"/></radialGradient>`;
  const wash = `<linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF8E8" stop-opacity="${
    kind === 'walnut' ? 0.1 : 0.4
  }"/><stop offset="0.6" stop-color="#FFF8E8" stop-opacity="0"/></linearGradient>`;
  const full = (attrs) => `<rect width="${W}" height="${H}" ${attrs}/>`;
  if (kind === 'walnut') {
    const seams = [0.31, 0.68].map((p) => `<rect y="${f(H * p)}" width="${W}" height="3" fill="#1C110A" opacity="0.55"/>`).join('');
    return `<defs>${vig}${wash}</defs>${full('fill="#4A2F1D"')}${full('filter="url(#table)"')}${full('filter="url(#tablelight)" opacity="0.5"')}${seams}${full('fill="url(#wash)"')}${full('fill="url(#vig)"')}`;
  }
  const base = kind === 'sand' ? '#DCC9AA' : '#EDE3CF';
  return `<defs>${vig}${wash}</defs>${full(`fill="${base}"`)}${full('filter="url(#paper)" opacity="0.5"')}${full('fill="url(#wash)"')}${full('fill="url(#vig)"')}`;
}

function slice({ cx, cy, R, design = 'blank', seed = 1, hole = false, uid = 'a', rimOnly = false }) {
  const r = rng(seed);
  let rings = '';
  let rad = 8 + r() * 5;
  while (rad < 88) {
    rings += `<circle r="${f(rad)}" fill="none" stroke="#7A5233" stroke-width="${f(0.5 + r() * 0.9)}" opacity="${f(0.13 + r() * 0.2)}"/>`;
    rad += 4.5 + r() * 7;
  }
  const a = r() * Math.PI * 2;
  const crack = `<path d="M${f(Math.cos(a) * 3)} ${f(Math.sin(a) * 3)} Q${f(Math.cos(a + 0.2) * 16)} ${f(Math.sin(a + 0.2) * 16)} ${f(Math.cos(a - 0.05) * 30)} ${f(Math.sin(a - 0.05) * 30)}" fill="none" stroke="#5A3A22" stroke-width="0.7" opacity="0.4" stroke-linecap="round"/>`;
  const bark = rimOnly
    ? '<rect x="-101" y="-101" width="202" height="202" fill="#2F2017"/><rect x="-101" y="-101" width="202" height="202" fill="#000" filter="url(#pores)" opacity="0.5"/>'
    : '<circle r="97" fill="#2F2017" filter="url(#bark)"/>';
  return `<g transform="translate(${cx} ${cy}) scale(${f(R / 100)})">
    ${bark}
    <circle r="91" fill="url(#face)"/>
    <g clip-path="url(#faceclip)">
      <g filter="url(#wobble)">${rings}</g>
      ${crack}
      <circle r="91" fill="#000" filter="url(#pores)"/>
      <circle r="91" fill="url(#light)"/>
      <circle r="91" fill="url(#rim)"/>
    </g>
    <g filter="url(#wobble)"><circle r="91" fill="none" stroke="#4A3020" stroke-width="1.6" opacity="0.6"/></g>
    ${hole ? '<circle cx="0" cy="-78" r="3.6" fill="#1A0F08"/><path d="M-3.4 -77 A3.6 3.6 0 0 0 3.4 -77" fill="none" stroke="#E9CFA4" stroke-width="0.6" opacity="0.7"/>' : ''}
    <g filter="url(#burn)">${designs[design](uid)}</g>
  </g>`;
}

// Twine from the top of the frame down through the hole.
function twine(cx, cy, R, sway = 0) {
  const hx = cx;
  const hy = cy - R * 0.78;
  const ky = cy - R * 1.12;
  const w = f(R * 0.022);
  const strand = (d) =>
    `<path d="${d}" fill="none" stroke="#B99A68" stroke-width="${w}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#7E6238" stroke-width="${f(w * 0.5)}" stroke-dasharray="${f(w * 1.2)} ${f(w * 2.2)}" opacity="0.6"/>`;
  return (
    strand(`M${f(cx + sway)} -20 Q${f(cx + sway * 0.4)} ${f(ky * 0.5)} ${cx} ${f(ky)}`) +
    strand(`M${cx} ${f(ky)} Q${f(hx - R * 0.07)} ${f((ky + hy) / 2)} ${hx} ${f(hy)}`) +
    strand(`M${cx} ${f(ky)} Q${f(hx + R * 0.07)} ${f((ky + hy) / 2)} ${hx} ${f(hy)}`) +
    `<circle cx="${cx}" cy="${f(ky)}" r="${f(w * 1.1)}" fill="#A88856"/>`
  );
}

const shadow = (cx, cy, R, hang) =>
  hang
    ? `<circle cx="${f(cx + R * 0.1)}" cy="${f(cy + R * 0.15)}" r="${f(R * 0.97)}" fill="#1A0E06" opacity="0.32" filter="url(#shadow)"/>`
    : `<circle cx="${f(cx + R * 0.05)}" cy="${f(cy + R * 0.07)}" r="${f(R * 0.98)}" fill="#120904" opacity="0.5" filter="url(#shadow)"/><circle cx="${f(cx + R * 0.012)}" cy="${f(cy + R * 0.02)}" r="${f(R * 0.985)}" fill="#120904" opacity="0.55" filter="url(#contact)"/>`;

const svg = (W, H, seed, blur, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(seed, blur)}${body}</svg>`;

/* ---------- shots ---------- */

function productShot({ W, H, bg, R, cx = W / 2, cy = H / 2, design, seed, hang = false, sway = 0, under }) {
  let body = backdrop(bg, W, H);
  if (hang) body += shadow(cx, cy, R, true) + twine(cx, cy, R, sway);
  if (under) {
    body += shadow(under.cx, under.cy, under.R, false) + slice({ ...under, design: 'blank', seed: seed + 40, uid: 'u' });
  }
  if (!hang) body += shadow(cx, cy, R, false);
  body += slice({ cx, cy, R, design, seed, hole: hang || design === 'vinyl', uid: 'm' });
  return svg(W, H, seed, f(R * 0.07), body);
}

function studioShot() {
  const W = 1500;
  const H = 1000;
  let body = backdrop('walnut', W, H);
  // a length of branch
  body += `<g transform="translate(250 760) rotate(-14)"><rect x="-190" y="-58" width="560" height="116" rx="56" fill="#120904" opacity="0.5" filter="url(#shadow)" transform="translate(10 16)"/><rect x="-190" y="-58" width="560" height="116" rx="50" fill="#2F2017"/><rect x="-190" y="-58" width="560" height="116" rx="50" fill="#000" filter="url(#pores)" opacity="0.7"/><path d="M-150 -30 H300 M-120 -6 H330 M-160 22 H280 M-60 40 H240" stroke="#1A100A" stroke-width="3" opacity="0.5" stroke-linecap="round"/><ellipse cx="368" cy="0" rx="26" ry="52" fill="#CBA171"/><ellipse cx="368" cy="0" rx="26" ry="52" fill="none" stroke="#2F2017" stroke-width="7"/><ellipse cx="368" cy="0" rx="9" ry="19" fill="#A97C53"/></g>`;
  // a sheet of sandpaper
  body += `<g transform="translate(1210 250) rotate(11)"><rect x="-150" y="-110" width="300" height="220" fill="#120904" opacity="0.45" filter="url(#contact)" transform="translate(6 9)"/><rect x="-150" y="-110" width="300" height="220" fill="#B58A5A"/><rect x="-150" y="-110" width="300" height="220" fill="#000" filter="url(#pores)" opacity="0.8"/></g>`;
  const pieces = [
    { cx: 560, cy: 400, R: 250, design: 'blank', seed: 61 },
    { cx: 1020, cy: 640, R: 215, design: 'mountain', seed: 62 },
    { cx: 1300, cy: 800, R: 130, design: 'blank', seed: 63 },
    { cx: 200, cy: 250, R: 150, design: 'botanical', seed: 64 },
  ];
  pieces.forEach((p, i) => {
    body += shadow(p.cx, p.cy, p.R, false) + slice({ ...p, uid: `s${i}` });
  });
  // loose twine
  body += `<path d="M700 900 C820 820 760 760 880 880 S1000 930 1090 905" fill="none" stroke="#B99A68" stroke-width="6" stroke-linecap="round"/><path d="M700 900 C820 820 760 760 880 880 S1000 930 1090 905" fill="none" stroke="#7E6238" stroke-width="3" stroke-dasharray="7 13" opacity="0.6"/>`;
  return svg(W, H, 60, 16, body);
}

const shots = [
  ['collection/vinyl-record', productShot({ W: 1500, H: 1200, bg: 'linen', R: 420, cx: 780, cy: 660, design: 'vinyl', seed: 14 })],
  ['custom-blank', productShot({ W: 1200, H: 1200, bg: 'linen', R: 400, cy: 680, design: 'blank', seed: 21, hang: true, sway: 14 })],
  ['about-studio', studioShot()],
];

for (const [name, markup, quality = 80] of shots) {
  const file = join(OUT, `${name}.webp`);
  await mkdir(dirname(file), { recursive: true });
  const info = await sharp(Buffer.from(markup)).webp({ quality, effort: 5 }).toFile(file);
  console.log(`${name}.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

/* ---------- hero ornament face ---------- */

// The face of the 3D hero ornament: the walnut slice (bark runs to the edges
// of the square so it maps onto the disc), with the Peace on Earth design
// burned into it. Only the design's dark engraved lines are taken from the
// product photo, inside its round face, so none of the photo's backdrop,
// twine or hanging tab comes along.
const DOVE = join(OUT, '..', 'products', 'peace-on-earth.webp');
const DOVE_FACE = { x: 622, y: 654, crop: 463 }; // the photo's face centre; crop stays inside its cut edge
const FACE_SIZE = 1024;
const DESIGN_SCALE = 0.83; // keeps the design's outer border clear of the hanging hole

async function heroFace() {
  const base = await sharp(
    Buffer.from(svg(FACE_SIZE, FACE_SIZE, 5, 10, slice({ cx: 512, cy: 512, R: 512, design: 'blank', seed: 5, hole: true, uid: 'h', rimOnly: true }))),
  )
    .png()
    .toBuffer();

  // How strongly each pixel is engraved: dark lines are 1, plain wood is 0,
  // with the soft edges of each line in between; faded out at the crop edge.
  const size = DOVE_FACE.crop * 2;
  const { data } = await sharp(DOVE)
    .extract({ left: DOVE_FACE.x - DOVE_FACE.crop, top: DOVE_FACE.y - DOVE_FACE.crop, width: size, height: size })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const burn = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const line = Math.min(1, Math.max(0, (165 - luma) / 95));
      const r = Math.hypot(x - DOVE_FACE.crop, y - DOVE_FACE.crop);
      const edge = Math.min(1, Math.max(0, (DOVE_FACE.crop - r) / 4));
      burn[y * size + x] = Math.round(line * edge * 255);
    }
  }
  const out = Math.round(size * DESIGN_SCALE);
  const at = Math.round((FACE_SIZE - out) / 2);
  const raw = { width: out, height: out, channels: 1 };
  const mask = await sharp(burn, { raw: { width: size, height: size, channels: 1 } }).resize(out, out).extractChannel(0).raw().toBuffer();
  const halo = await sharp(mask, { raw }).blur(2.2).extractChannel(0).raw().toBuffer();
  if (mask.length !== out * out || halo.length !== out * out) throw new Error('unexpected mask size');

  // The same burn as the drawn designs: a dark core, a soft scorched halo,
  // and a faint light lip just below and right of each line.
  const layer = async (colour, opacity, alpha, shift = 0) => {
    const a = Buffer.alloc(out * out);
    for (let y = shift; y < out; y++) {
      for (let x = shift; x < out; x++) a[y * out + x] = Math.round(alpha[(y - shift) * out + (x - shift)] * opacity);
    }
    const input = await sharp({ create: { width: out, height: out, channels: 3, background: colour } })
      .joinChannel(a, { raw })
      .png()
      .toBuffer();
    return { input, left: at, top: at };
  };
  const layers = [
    await layer('#F6DFB8', 0.35, mask, 2),
    await layer('#5B3317', 0.5, halo),
    await layer('#2B180D', 0.92, mask),
  ];
  const info = await sharp(base).composite(layers).webp({ quality: 88, effort: 5 }).toFile(join(OUT, 'hero-ornament-face.webp'));
  console.log(`hero-ornament-face.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

await heroFace();
