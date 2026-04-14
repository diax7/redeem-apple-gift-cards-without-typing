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

// V1 — CANONICAL 3:1 BOX WITH DYNAMIC FONT FIT
// 3:1 box, 0.045 border, fillRect frame. Font starts at Equinux's
// 0.34 × H maximum and shrinks only if 16 characters would overflow,
// targeting 88% of interior width.
function drawV1(code) {
  const H = BOX_HEIGHT;
  const W = H * 3;
  const border = Math.round(H * 0.045);
  const interior = W - 2 * border;

  const maxFontSize = H * 0.34;
  const targetWidth = interior * 0.88;
  const raw = measureAt(code, maxFontSize);
  const fontSize = raw > targetWidth ? maxFontSize * (targetWidth / raw) : maxFontSize;

  const { canvas, ctx } = makeCanvas(W, H);
  fillFrame(ctx, W, H, border);
  drawCenteredText(ctx, code, fontSize, W / 2, H / 2);
  return canvas;
}

// V2 — STRICT 0.34 FONT, SVG WITH textLength COMPRESSION
// Keeps the box exactly 3:1 AND the font size exactly 0.34 × H, using
// SVG's textLength/lengthAdjust="spacingAndGlyphs" to squeeze the 16
// characters to fit inside the interior. This is the only variant that
// preserves ALL Equinux ratios simultaneously.
function drawV2(code) {
  const H = BOX_HEIGHT;
  const W = H * 3;
  const border = Math.round(H * 0.045);
  const fontSize = H * 0.34;
  const interior = W - 2 * border;
  const textLength = interior * 0.90;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'scan-box');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const outer = document.createElementNS(ns, 'rect');
  outer.setAttribute('width', W);
  outer.setAttribute('height', H);
  outer.setAttribute('fill', '#000000');
  svg.appendChild(outer);

  const inner = document.createElementNS(ns, 'rect');
  inner.setAttribute('x', border);
  inner.setAttribute('y', border);
  inner.setAttribute('width', W - 2 * border);
  inner.setAttribute('height', H - 2 * border);
  inner.setAttribute('fill', '#ffffff');
  svg.appendChild(inner);

  const text = document.createElementNS(ns, 'text');
  text.setAttribute('x', W / 2);
  text.setAttribute('y', H / 2);
  text.setAttribute('font-family', '"Scancardium", monospace');
  text.setAttribute('font-size', fontSize);
  text.setAttribute('fill', '#000000');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('textLength', textLength);
  text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  text.textContent = code;
  svg.appendChild(text);

  return svg;
}

// V3 — STRICT 0.34 FONT, WIDER BOX (NOT 3:1)
// Preserves the 0.34 × H font-size exactly, but lets the box be wider than
// 3:1 so the text fits with natural character spacing. Sacrifices the 3:1
// box ratio to keep the font ratio.
function drawV3(code) {
  const H = BOX_HEIGHT;
  const fontSize = H * 0.34;
  const textWidth = measureAt(code, fontSize);
  const border = Math.round(H * 0.045);
  // Pad interior so text sits at ~88% fill.
  const interior = Math.ceil(textWidth / 0.88);
  const W = interior + 2 * border;

  const { canvas, ctx } = makeCanvas(W, H);
  fillFrame(ctx, W, H, border);
  drawCenteredText(ctx, code, fontSize, W / 2, H / 2);
  return canvas;
}

// V4 — 3:1 BOX, 0.30 FONT (compromise ratio)
// Middle ground between Equinux's 0.34 and what my Scancardium file
// naturally fits. The box is strictly 3:1 with natural character spacing.
function drawV4(code) {
  const H = BOX_HEIGHT;
  const W = H * 3;
  const border = Math.round(H * 0.045);
  const fontSize = H * 0.30;

  const { canvas, ctx } = makeCanvas(W, H);
  fillFrame(ctx, W, H, border);
  drawCenteredText(ctx, code, fontSize, W / 2, H / 2);
  return canvas;
}

// V5 — 3:1 BOX, 0.26 FONT (matches real card photos)
// This ratio is what the scan boxes on actual Apple gift card photos look
// like — 16 characters span roughly 85% of the interior with clear padding
// on both sides. Smallest text of the five variants.
function drawV5(code) {
  const H = BOX_HEIGHT;
  const W = H * 3;
  const border = Math.round(H * 0.045);
  const fontSize = H * 0.26;

  const { canvas, ctx } = makeCanvas(W, H);
  fillFrame(ctx, W, H, border);
  drawCenteredText(ctx, code, fontSize, W / 2, H / 2);
  return canvas;
}

const VARIANTS = [
  {
    id: 'V1',
    name: 'Dynamic fit',
    desc: '3:1 box · font shrunk to fit 88% of interior',
    render: drawV1,
  },
  {
    id: 'V2',
    name: 'Strict 0.34, SVG squeeze',
    desc: '3:1 box · font-size exactly 0.34 × H · characters squeezed via SVG textLength',
    render: drawV2,
  },
  {
    id: 'V3',
    name: 'Strict 0.34, wide box',
    desc: 'Font-size 0.34 × H · box wider than 3:1 to fit text',
    render: drawV3,
  },
  {
    id: 'V4',
    name: '0.30 ratio',
    desc: '3:1 box · font-size 0.30 × H',
    render: drawV4,
  },
  {
    id: 'V5',
    name: '0.26 ratio',
    desc: '3:1 box · font-size 0.26 × H · matches real Apple card photos',
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
