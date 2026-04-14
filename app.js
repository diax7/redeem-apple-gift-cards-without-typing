// Redeem Apple Gift Cards Without Typing — client-side app
// All state lives in memory; nothing persists and nothing leaves the browser.
//
// The scan box is drawn on a <canvas> element following the exact Equinux
// reverse-engineering spec:
//   box width  = 3 × box height
//   border     = 0.045 × box height
//   font-size  = 0.34 × box height  (applied directly, per Equinux's formula)
// Canvas is used instead of CSS so proportions can't be skewed by cascading
// styles, custom-property fallbacks, or lazy font loading.

const FONT_URL = 'fonts/Scancardium_2.0.ttf';
// On-screen render size for each card's scan box. The scanner works at any
// size as long as the ratios are correct; this one is chosen to give the
// iPhone/iPad camera plenty of pixels to resolve from a 4–7 inch distance.
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
//
// We load Scancardium through the FontFace API (not plain @font-face) because:
//   1. We need to know the exact moment it's ready before drawing to canvas.
//      Canvas does NOT lazy-load fonts the way CSS text does — if we draw
//      before the font is registered, the browser silently falls back to a
//      system font and Apple's OCR scanner ignores the result.
//   2. We want to verify the font actually loaded (some environments block
//      loading local TTFs). We compare a probe string's width in Scancardium
//      vs. a known fallback; if they match, the custom font didn't load.

async function loadScancardium() {
  try {
    const face = new FontFace('Scancardium', `url(${FONT_URL})`, {
      style: 'normal',
      weight: '400',
      display: 'block',
    });
    const loaded = await face.load();
    document.fonts.add(loaded);

    // Pre-warm the font across the range of sizes the canvas may draw with.
    // Without this, the first draw can still hit a fallback on some browsers.
    await document.fonts.load(`${Math.round(BOX_HEIGHT * 0.34)}px "Scancardium"`);
    await document.fonts.load(`${Math.round(BOX_HEIGHT * 0.26)}px "Scancardium"`);

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

// Verifies a custom font loaded by measuring a probe string's width in that
// family and comparing it to the same string rendered in a known fallback.
// If the widths match exactly, the browser fell back and the custom font
// is not actually in use.
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

// ---------- Scan box rendering ----------
//
// Draws the code into a canvas at exact pixel dimensions following the
// Equinux reverse-engineering spec:
//   box width  = 3 × box height          (exact)
//   border     = 0.045 × box height      (exact)
//   font-size  ≤ 0.34 × box height       (Equinux max)
//
// The Scancardium TTF from hughmandeville/homekit_code has slightly wider
// glyph advances than the version Equinux measured, so a straight 0.34
// font-size makes 16 characters overflow the 3:1 box. To keep the box
// proportions exact (which the scanner validates) while guaranteeing the
// text fits, we measure the code at the Equinux maximum and then shrink
// the font-size only if needed so the text fills about 88% of the interior
// width — matching the natural padding visible on real Apple gift cards.
function drawScanBox(code) {
  const boxH = BOX_HEIGHT;
  const boxW = boxH * 3;
  const border = boxH * 0.045;
  const interior = boxW - 2 * border;

  // Start with the Equinux max font-size. Measure the text and, if it would
  // overflow the target fill width, scale the font-size down proportionally.
  const maxFontSize = boxH * 0.34;
  const targetWidth = interior * 0.88;

  const probeCtx = document.createElement('canvas').getContext('2d');
  probeCtx.font = `${maxFontSize}px "Scancardium", monospace`;
  const rawWidth = probeCtx.measureText(code).width;
  const fontSize = rawWidth > targetWidth
    ? maxFontSize * (targetWidth / rawWidth)
    : maxFontSize;

  // Draw at devicePixelRatio for crisp rendering on retina screens.
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.className = 'scan-box';
  canvas.width = Math.round(boxW * dpr);
  canvas.height = Math.round(boxH * dpr);
  canvas.style.width = `${boxW}px`;
  canvas.style.height = `${boxH}px`;
  canvas.setAttribute('aria-label', `Scannable gift card code ${code}`);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Pure white background — the scanner needs maximum contrast.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, boxW, boxH);

  // Black border. strokeRect centers the stroke on the path, so inset by
  // border/2 to keep the entire stroke width inside the box bounds.
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, boxW - border, boxH - border);

  // Text — centered on the box using actual rendered bounds so the result
  // is visually perfect regardless of the font's internal metrics.
  ctx.fillStyle = '#000000';
  ctx.font = `${fontSize}px "Scancardium", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(code);
  const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.72;
  const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.05;
  const y = boxH / 2 + (ascent - descent) / 2;

  ctx.fillText(code, boxW / 2, y);
  return canvas;
}

// ---------- Code parsing ----------
// Apple gift card codes are 16 uppercase alphanumeric characters. We accept
// codes pasted with spaces/dashes and clean them before validating.
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
    const node = document.createElement('article');
    node.className = 'gift-card';
    node.dataset.id = card.id;

    // Human-friendly readable form: XXXX XXXX XXXX XXXX
    const readable = card.code.match(/.{1,4}/g).join(' ');

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <span class="card-label">Scan with your iPhone or iPad camera</span>
      <button type="button" class="card-remove" aria-label="Remove this card">&times;</button>
    `;

    const scanWrap = document.createElement('div');
    scanWrap.className = 'scan-wrap';
    scanWrap.appendChild(drawScanBox(card.code));

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `
      <span class="readable-code">${readable}</span>
      <button type="button" class="copy-btn">Copy code</button>
    `;

    node.appendChild(header);
    node.appendChild(scanWrap);
    node.appendChild(footer);

    header.querySelector('.card-remove').addEventListener('click', () => {
      state.cards = state.cards.filter((c) => c.id !== card.id);
      renderCards();
    });

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

    el.cardsArea.appendChild(node);
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
    const lastCard = el.cardsArea.querySelector('.gift-card:last-child');
    lastCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
