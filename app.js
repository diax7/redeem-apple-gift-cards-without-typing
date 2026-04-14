// Redeem Apple Gift Cards Without Typing — client-side app.
// Every card is rendered as a plain <input> element styled to match
// hughmandeville/homekit_code's working HomeKit scan helper. That exact
// CSS has been verified to scan correctly with the iPhone/iPad camera —
// the only change is the width (420px → 600px) so a 16-character gift
// card code fits. Nothing fancy: no canvas, no SVG, no custom rendering.

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
// Scancardium is loaded via @font-face in styles.css. We also explicitly
// wait for it through the FontFace API so we only enable the Generate
// button once the font is actually parsed and ready — without this, the
// first rendered card could briefly use a fallback font and the OCR would
// fail to recognise it.

async function waitForFont() {
  try {
    await document.fonts.load('52px "Scancardium"');
    if (document.fonts.check('52px "Scancardium"')) {
      state.fontReady = true;
      el.generateBtn.disabled = false;
    } else {
      throw new Error('Scancardium did not become available after load().');
    }
  } catch (err) {
    console.error('Scancardium failed to load:', err);
    el.validationError.hidden = false;
    el.validationError.textContent =
      'Couldn\u2019t load the Scancardium font. The scanner will not recognise these cards without it. Please reload the page.';
  }
}

// ---------- Code parsing ----------
// Apple gift card codes are 16 alphanumeric characters. We accept codes
// pasted with spaces or dashes and strip them before validating.
const CODE_RE = /^[A-Z0-9]{16}$/;

function parseCodes(raw) {
  const valid = [];
  const invalid = [];
  for (const line of raw.split(/\r?\n/)) {
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
    const readable = card.code.match(/.{1,4}/g).join(' ');

    const node = document.createElement('article');
    node.className = 'gift-card';
    node.dataset.id = card.id;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <span class="card-label">Scan with your iPhone or iPad camera</span>
      <button type="button" class="card-remove" aria-label="Remove this card">&times;</button>
    `;

    // The actual scannable element — a plain <input> exactly like
    // hughmandeville's working implementation.
    const scan = document.createElement('input');
    scan.type = 'text';
    scan.className = 'scan-box';
    scan.value = card.code;
    scan.readOnly = true;
    scan.setAttribute('aria-label', `Scannable code ${card.code}`);
    // Select all on click so the user can copy the code manually if
    // they don't want to use the Copy button.
    scan.addEventListener('click', () => scan.select());

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `
      <span class="readable-code">${readable}</span>
      <button type="button" class="copy-btn">Copy code</button>
    `;

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

    node.appendChild(header);
    node.appendChild(scan);
    node.appendChild(footer);
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

waitForFont();
