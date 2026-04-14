// Redeem Apple Gift Cards Without Typing — client-side app
// All state lives in memory; nothing persists and nothing leaves the browser.
//
// TEST MODE: For each valid code, we render FIVE variants of the scan box,
// each using a different strategy for balancing the Equinux spec ratios
// (3:1 box, 0.045 border, 0.34 font-size) against the practical reality
// that the Scancardium TTF available outside macOS has slightly wider
// glyph advances than the one Equinux measured, so a literal 0.34 font
// size overflows a 3:1 box for 16-character codes. Each variant is
// labelled V1–V5 so the user can physically scan each one with their
// iPhone/iPad and report which one triggers Apple's OCR.

const FONT_URL = 'fonts/Scancardium_2.0.ttf';
// On-screen render size for each card's scan box. Chosen so the box is
// comfortably resolvable by the iPhone/iPad camera at 4–7 inches.
const BOX_HEIGHT = 220;

const state = {
  fontReady: false,
  cards: [], // { id, code }
};

const el = {
  codesInput: document.getElementById('codesInput'),
  generateBtn: document.getElementById('generateBtn'),
  clearBtn: document.getElementById('clearBtn'),
  validationError: document.getElementById('validationError'),
  cardsArea: document.getElementById('cardsArea'),
  toast: document.getElementById('toast'),
};

// ---------- Font loading ----------

async function loadScancardium() {
  try {
    const face = new FontFace('Scancardium', `url(${FONT_URL})`, {
      style: 'normal',
      weight: '400',
      display: 'block',
    });
    const loaded = await face.load();
    document.fonts.add(loaded);

    // Pre-warm every size the variants will actually draw at, so that no
    // variant accidentally hits a first-draw fallback.
    const sizes = [0.26, 0.30, 0.34].map((r) => Math.round(BOX_HEIGHT * r));
    await Promise.all(sizes.map((s) => document.fonts.load(`${s}px "Scancardium"`)));

    if (!isCustomFontLoaded('Scancardium')) {
      throw new Error('Scancardium registered but measurements match the fallback font.');
    }

    state.fontReady = true;
    el.generateBtn.disabled = false;
  } catch (err) {
    console.error('Scancardium failed to load:', err);
    el.validationError.hidden = false;
    el.validationError.textContent =
      'Couldn\u2019t load the Scancardium font. The scanner will not recognize these cards without it. Please reload the page.';
  }
}

function isCustomFontLoaded(family) {
  const probe = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const size = 72;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${size}px monospace`;
  const baseline = ctx.measureText(probe).width;
  ctx.font = `${size}px "${family}", monospace`;
  const withFont = ctx.measureText(probe).width;
  return Math.abs(withFont - baseline) > 0.5;
}

// ---------- Low-level canvas helpers ----------

// Shared measurement context — used by every variant to measure text width
// at a given font size without allocating a new canvas each call.
const measureCtx = document.createElement('canvas').getContext('2d');
function measureAt(code, fontSize) {
  measureCtx.font = `${fontSize}px "Scancardium", monospace`;
  return measureCtx.measureText(code).width;
}

// Builds a canvas at integer CSS pixels with devicePixelRatio scaling for
// crisp retina rendering. Returns { canvas, ctx } so the caller can draw.
function makeCanvas(cssW, cssH) {
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.className = 'scan-box';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

// Draws a crisp black-framed white box using fillRect (NOT strokeRect) so
// every edge is pixel-aligned with no anti-aliasing fringe.
function fillFrame(ctx, W, H, border) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(border, border, W - 2 * border, H - 2 * border);
}

// Draws the code text centered on the box using actual rendered bounds so
// it sits visually dead-center regardless of the font's vertical metrics.
function drawCenteredText(ctx, code, fontSize, cx, cy) {
  ctx.fillStyle = '#000000';
  ctx.font = `${fontSize}px "Scancardium", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(code);
  const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.72;
  const descent = m.actualBoundingBoxDescent ?? fontSize * 0.05;
  const y = cy + (ascent - descent) / 2;
  ctx.fillText(code, cx, y);
}

// ---------- Variants ----------
//
// Each variant returns an HTMLElement (canvas or SVG) that represents one
// take on what a scannable Apple gift card box should look like.

// Builds a bare SVG scan box with fill="none" outline, Apple's exact font,
// and optional per-character positioning. Mirrors finnvoor's proven approach
// for 12-char promo codes, extended for 16-char gift cards.
function buildSvgBox({ boxRatio, perCharPositioning, H = BOX_HEIGHT }) {
  return (code) => {
    const W = H * boxRatio;
    const border = H * 0.045;
    const fontSize = H * 0.34;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'scan-box');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // Solid white background rectangle — matches finnvoor's working SVG
    // (they used a white JPEG at 400×400 behind everything).
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', W);
    bg.setAttribute('height', H);
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    // Box outline — stroke only, fill="none" just like finnvoor's solution.
    // stroke-linejoin="round" matches the exact attributes finnvoor uses.
    const box = document.createElementNS(ns, 'path');
    const x1 = border / 2;
    const y1 = H - border / 2;
    const x2 = W - border / 2;
    const y2 = border / 2;
    box.setAttribute('d', `M${x1} ${y1} L${x2} ${y1} ${x2} ${y2} ${x1} ${y2} Z`);
    box.setAttribute('fill', 'none');
    box.setAttribute('stroke', '#000000');
    box.setAttribute('stroke-width', border);
    box.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(box);

    if (perCharPositioning) {
      // Per-character uniform spacing, scaled from finnvoor's 12-char layout.
      // finnvoor: 12 chars over ~288 units in a 126.5-unit box = 0.19 H per step.
      // For 16 chars, we want 15 intervals across the interior with padding.
      const N = code.length;
      // Match finnvoor's padding ratio: ~33 of 380 = 8.7% of box width each side.
      const sidePadding = W * 0.087;
      const available = W - 2 * sidePadding;
      const step = available / (N - 1);
      const startX = sidePadding;

      const text = document.createElementNS(ns, 'text');
      text.setAttribute('y', H / 2 + fontSize * 0.33);
      text.setAttribute('font-family', '"Scancardium", "Scancardium", monospace');
      text.setAttribute('font-size', fontSize);
      text.setAttribute('fill', '#000000');
      text.setAttribute('text-anchor', 'middle');

      for (let i = 0; i < N; i++) {
        const tspan = document.createElementNS(ns, 'tspan');
        tspan.setAttribute('x', startX + i * step);
        tspan.textContent = code[i];
        text.appendChild(tspan);
      }
      svg.appendChild(text);
    } else {
      // Natural text flow with text-anchor center.
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', W / 2);
      text.setAttribute('y', H / 2 + fontSize * 0.33);
      text.setAttribute('font-family', '"Scancardium", "Scancardium", monospace');
      text.setAttribute('font-size', fontSize);
      text.setAttribute('fill', '#000000');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = code;
      svg.appendChild(text);
    }

    return svg;
  };
}

// V1 — 4:1 box with natural text flow
// If box-ratio scales linearly with character count (finnvoor's 3:1 for 12
// chars → 3/12 × 16 = 4 for 16 chars), this is the correct gift-card box.
const drawV1 = buildSvgBox({ boxRatio: 4.0, perCharPositioning: false });

// V2 — 4:1 box with per-character uniform positioning
// Same 4:1 ratio as V1 but uses finnvoor-style explicit tspan positioning
// for each character so glyph advances are overridden by uniform spacing.
const drawV2 = buildSvgBox({ boxRatio: 4.0, perCharPositioning: true });

// V3 — 3.797:1 box (Apple's internal frameRatio from CRBoxLayer.m)
// The exact magic number Apple uses when initialising the scanner reticle
// for iTunes codes. Slightly narrower than 4:1.
const drawV3 = buildSvgBox({ boxRatio: 3.79710145, perCharPositioning: false });

// V4 — 3.797:1 box with per-character positioning
// Apple's reticle ratio plus finnvoor's uniform character spacing approach.
const drawV4 = buildSvgBox({ boxRatio: 3.79710145, perCharPositioning: true });

// V5 — 4:1 box inside a minimalist Apple gift card mockup
// Surrounds the scan box with the visual elements of a real Apple gift card
// (Apple logo, "Gift Card" title, serial number below) so the scanner's
// ML model sees the card context it's trained to recognise.
function drawV5(code) {
  const cardW = 900;
  const cardH = 1100;
  const ns = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'scan-box');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', cardW);
  svg.setAttribute('height', cardH);
  svg.setAttribute('viewBox', `0 0 ${cardW} ${cardH}`);

  // Card background — white with rounded corners.
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', cardW);
  bg.setAttribute('height', cardH);
  bg.setAttribute('rx', 32);
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  // Apple logo at top centre.
  const apple = document.createElementNS(ns, 'path');
  apple.setAttribute('transform', `translate(${cardW / 2 - 36}, 110) scale(3)`);
  apple.setAttribute('d', 'M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z');
  apple.setAttribute('fill', '#1d1d1f');
  svg.appendChild(apple);

  // "Gift Card" title.
  const title = document.createElementNS(ns, 'text');
  title.setAttribute('x', cardW / 2);
  title.setAttribute('y', 250);
  title.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, Arial, sans-serif');
  title.setAttribute('font-size', 64);
  title.setAttribute('font-weight', 600);
  title.setAttribute('fill', '#1d1d1f');
  title.setAttribute('text-anchor', 'middle');
  title.textContent = 'Gift Card';
  svg.appendChild(title);

  // "For all things Apple" subtitle.
  const subtitle = document.createElementNS(ns, 'text');
  subtitle.setAttribute('x', cardW / 2);
  subtitle.setAttribute('y', 310);
  subtitle.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
  subtitle.setAttribute('font-size', 32);
  subtitle.setAttribute('fill', '#1d1d1f');
  subtitle.setAttribute('text-anchor', 'middle');
  subtitle.textContent = 'For all things Apple';
  svg.appendChild(subtitle);

  // Body text above the scan box.
  const body1 = document.createElementNS(ns, 'text');
  body1.setAttribute('x', cardW / 2);
  body1.setAttribute('y', 480);
  body1.setAttribute('font-family', '-apple-system, sans-serif');
  body1.setAttribute('font-size', 22);
  body1.setAttribute('fill', '#1d1d1f');
  body1.setAttribute('text-anchor', 'middle');
  body1.textContent = 'Use this card at any Apple Store. For online purchases,';
  svg.appendChild(body1);

  const body2 = document.createElementNS(ns, 'text');
  body2.setAttribute('x', cardW / 2);
  body2.setAttribute('y', 512);
  body2.setAttribute('font-family', '-apple-system, sans-serif');
  body2.setAttribute('font-size', 22);
  body2.setAttribute('fill', '#1d1d1f');
  body2.setAttribute('text-anchor', 'middle');
  body2.textContent = 'go to apple.com/redeem to add to your account.';
  svg.appendChild(body2);

  // The scan box itself — 4:1 ratio, exactly centred.
  const boxH = 140;
  const boxW = boxH * 4;
  const border = boxH * 0.045;
  const boxX = (cardW - boxW) / 2;
  const boxY = 600;
  const fontSize = boxH * 0.34;

  const box = document.createElementNS(ns, 'path');
  const x1 = boxX + border / 2;
  const y1 = boxY + boxH - border / 2;
  const x2 = boxX + boxW - border / 2;
  const y2 = boxY + border / 2;
  box.setAttribute('d', `M${x1} ${y1} L${x2} ${y1} ${x2} ${y2} ${x1} ${y2} Z`);
  box.setAttribute('fill', 'none');
  box.setAttribute('stroke', '#000000');
  box.setAttribute('stroke-width', border);
  box.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(box);

  const text = document.createElementNS(ns, 'text');
  text.setAttribute('x', cardW / 2);
  text.setAttribute('y', boxY + boxH / 2 + fontSize * 0.33);
  text.setAttribute('font-family', '"Scancardium", "Scancardium", monospace');
  text.setAttribute('font-size', fontSize);
  text.setAttribute('fill', '#000000');
  text.setAttribute('text-anchor', 'middle');
  text.textContent = code;
  svg.appendChild(text);

  // Serial number below the box — real gift cards show GCA###...
  const serial = document.createElementNS(ns, 'text');
  serial.setAttribute('x', cardW / 2);
  serial.setAttribute('y', boxY + boxH + 50);
  serial.setAttribute('font-family', '-apple-system, sans-serif');
  serial.setAttribute('font-size', 18);
  serial.setAttribute('fill', '#1d1d1f');
  serial.setAttribute('text-anchor', 'middle');
  serial.textContent = 'GCA' + Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
  svg.appendChild(serial);

  return svg;
}

const VARIANTS = [
  {
    id: 'V1',
    name: '4:1 box, natural text',
    desc: 'Box-ratio scaled for 16 chars (4:1) · font 0.34 × H · natural text flow',
    render: drawV1,
  },
  {
    id: 'V2',
    name: '4:1 box, per-char positioning',
    desc: '4:1 box · per-character uniform spacing (finnvoor-style)',
    render: drawV2,
  },
  {
    id: 'V3',
    name: "3.797:1 box (Apple's frameRatio)",
    desc: 'Apple\u2019s exact internal frameRatio from CRBoxLayer.m · natural text',
    render: drawV3,
  },
  {
    id: 'V4',
    name: '3.797:1 box, per-char positioning',
    desc: 'Apple\u2019s frameRatio · per-character uniform spacing',
    render: drawV4,
  },
  {
    id: 'V5',
    name: 'Full gift card mockup',
    desc: '4:1 scan box inside a minimalist Apple gift card (logo, title, serial) so the ML model sees card context',
    render: drawV5,
  },
];

// ---------- Code parsing ----------

const CODE_RE = /^[A-Z0-9]{16}$/;

function parseCodes(raw) {
  const lines = raw.split(/\r?\n/);
  const valid = [];
  const invalid = [];
  for (const line of lines) {
    const cleaned = line.replace(/[\s-]/g, '').toUpperCase();
    if (!cleaned) continue;
    if (CODE_RE.test(cleaned)) {
      valid.push(cleaned);
    } else {
      invalid.push(line.trim());
    }
  }
  return { valid, invalid };
}

// ---------- Card rendering ----------

function renderCards() {
  el.cardsArea.innerHTML = '';

  if (state.cards.length === 0) {
    el.clearBtn.hidden = true;
    return;
  }
  el.clearBtn.hidden = false;

  for (const card of state.cards) {
    // One code generates one "group" containing five variant cards so the
    // user can physically scan each with their iPhone/iPad and identify
    // which variant the scanner recognises.
    const group = document.createElement('div');
    group.className = 'variant-group';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'variant-group-header';
    const readable = card.code.match(/.{1,4}/g).join(' ');
    groupHeader.innerHTML = `
      <div class="variant-group-title">
        <span class="variant-group-code">${readable}</span>
        <button type="button" class="card-remove" aria-label="Remove this code">&times;</button>
      </div>
      <p class="variant-group-sub">Scan each variant with your iPhone or iPad. Note which one triggers the camera scanner.</p>
    `;
    group.appendChild(groupHeader);

    groupHeader.querySelector('.card-remove').addEventListener('click', () => {
      state.cards = state.cards.filter((c) => c.id !== card.id);
      renderCards();
    });

    for (const variant of VARIANTS) {
      const node = document.createElement('article');
      node.className = 'gift-card variant-card';

      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = `
        <span class="variant-badge">${variant.id}</span>
        <span class="variant-name">${variant.name}</span>
      `;

      const desc = document.createElement('p');
      desc.className = 'variant-desc';
      desc.textContent = variant.desc;

      const scanWrap = document.createElement('div');
      scanWrap.className = 'scan-wrap';
      try {
        scanWrap.appendChild(variant.render(card.code));
      } catch (err) {
        console.error(`Variant ${variant.id} failed to render:`, err);
        scanWrap.textContent = `Error: ${err.message}`;
      }

      const footer = document.createElement('div');
      footer.className = 'card-footer';
      footer.innerHTML = `
        <span class="readable-code">${readable}</span>
        <button type="button" class="copy-btn">Copy code</button>
      `;

      footer.querySelector('.copy-btn').addEventListener('click', async (event) => {
        try {
          await navigator.clipboard.writeText(card.code);
          const btn = event.currentTarget;
          btn.textContent = 'Copied';
          btn.classList.add('copied');
          showToast('Code copied to clipboard');
          setTimeout(() => {
            btn.textContent = 'Copy code';
            btn.classList.remove('copied');
          }, 1800);
        } catch {
          showToast('Couldn\u2019t copy — select and copy manually');
        }
      });

      node.appendChild(header);
      node.appendChild(desc);
      node.appendChild(scanWrap);
      node.appendChild(footer);
      group.appendChild(node);
    }

    el.cardsArea.appendChild(group);
  }
}

// ---------- Toast ----------

let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

// ---------- Input wiring ----------

el.generateBtn.addEventListener('click', () => {
  if (!state.fontReady) return;

  const { valid, invalid } = parseCodes(el.codesInput.value);

  if (valid.length === 0) {
    el.validationError.hidden = false;
    el.validationError.textContent = invalid.length
      ? 'No valid 16-character codes found. Codes must be 16 letters and numbers.'
      : 'Please paste at least one gift card code.';
    return;
  }

  el.validationError.hidden = true;

  const existing = new Set(state.cards.map((c) => c.code));
  let added = 0;
  for (const code of valid) {
    if (existing.has(code)) continue;
    state.cards.push({ id: crypto.randomUUID(), code });
    existing.add(code);
    added++;
  }

  renderCards();
  el.codesInput.value = '';

  if (invalid.length) {
    el.validationError.hidden = false;
    el.validationError.textContent = `Skipped ${invalid.length} invalid code${invalid.length > 1 ? 's' : ''}: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`;
  }

  if (added > 0) {
    const firstGroup = el.cardsArea.querySelector('.variant-group');
    firstGroup?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

el.clearBtn.addEventListener('click', () => {
  state.cards = [];
  renderCards();
});

el.codesInput.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    el.generateBtn.click();
  }
});

loadScancardium();
