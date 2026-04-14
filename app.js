// Redeem Apple Gift Cards Without Typing — client-side app
// All state lives in memory; nothing persists and nothing leaves the browser.

const FONT_URL = 'fonts/Scancardium_2.0.ttf';

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
// The Scancardium font ships with the site in fonts/. We still load it via the
// FontFace API (rather than pure @font-face CSS) so we can reliably wait for it
// to be ready before enabling card generation — if we rendered cards before the
// font was parsed, the browser would briefly fall back to a system font and
// Apple's OCR scanner would not recognize those characters.
async function loadScancardium() {
  try {
    const face = new FontFace('Scancardium', `url(${FONT_URL})`, { style: 'normal', weight: '400' });
    const loaded = await face.load();
    document.fonts.add(loaded);
    state.fontReady = true;
    el.generateBtn.disabled = false;
  } catch (err) {
    // This should never happen in practice because the font is local.
    // If it does, surface a clear inline error so the user knows why nothing works.
    console.error('Scancardium failed to load:', err);
    el.validationError.hidden = false;
    el.validationError.textContent =
      'Couldn\u2019t load the Scancardium font. Please reload the page.';
  }
}

// ---------- Code parsing ----------
// Apple gift card codes are 16 uppercase alphanumeric characters.
// We accept codes pasted with spaces/dashes and clean them before validation.
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

    node.innerHTML = `
      <div class="card-header">
        <span class="card-label">Scan with your iPhone or iPad camera</span>
        <button type="button" class="card-remove" aria-label="Remove this card">&times;</button>
      </div>
      <div class="scan-box">
        <span class="scan-code">${escapeHtml(card.code)}</span>
      </div>
      <div class="card-footer">
        <span class="readable-code">${readable}</span>
        <button type="button" class="copy-btn">Copy code</button>
      </div>
    `;

    node.querySelector('.card-remove').addEventListener('click', () => {
      state.cards = state.cards.filter((c) => c.id !== card.id);
      renderCards();
    });

    node.querySelector('.copy-btn').addEventListener('click', async (event) => {
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

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
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

  // Append valid codes to existing cards, skipping duplicates.
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

// Cmd/Ctrl+Enter from the textarea submits.
el.codesInput.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    el.generateBtn.click();
  }
});

loadScancardium();
