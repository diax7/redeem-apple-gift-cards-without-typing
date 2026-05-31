const state = {
  fontReady: false,
  cards: [],
};

const el = {
  codesInput: document.getElementById('codesInput'),
  generateBtn: document.getElementById('generateBtn'),
  clearBtn: document.getElementById('clearBtn'),
  validationError: document.getElementById('validationError'),
  cardsArea: document.getElementById('cardsArea'),
  toast: document.getElementById('toast'),
};

async function waitForFont() {
  try {
    await document.fonts.load('52px "Scancardium"');
    if (document.fonts.check('52px "Scancardium"')) {
      state.fontReady = true;
      el.generateBtn.disabled = false;
    } else {
      throw new Error('Scancardium did not become available.');
    }
  } catch (err) {
    console.error('Scancardium failed to load:', err);
    el.validationError.hidden = false;
    el.validationError.textContent =
      'Couldn’t load the Scancardium font. The scanner will not recognise these cards without it. Please reload the page.';
  }
}

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

function buildCardSvg(code) {
  const cardW = 900;
  const cardH = 580;
  const ns = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'scan-box');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', cardW);
  svg.setAttribute('height', cardH);
  svg.setAttribute('viewBox', `0 0 ${cardW} ${cardH}`);

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', cardW);
  bg.setAttribute('height', cardH);
  bg.setAttribute('rx', 32);
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  const apple = document.createElementNS(ns, 'path');
  apple.setAttribute(
    'transform',
    `translate(${cardW / 2 - 36}, 20) scale(3)`
  );
  apple.setAttribute(
    'd',
    'M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z'
  );
  apple.setAttribute('fill', '#1d1d1f');
  svg.appendChild(apple);

  const title = document.createElementNS(ns, 'text');
  title.setAttribute('x', cardW / 2);
  title.setAttribute('y', 130);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('font-family', '-apple-system, Helvetica Neue, Arial');
  title.setAttribute('font-size', 42);
  title.setAttribute('font-weight', '600');
  title.setAttribute('fill', '#1d1d1f');
  title.textContent = 'Gift Card';
  svg.appendChild(title);

  const subtitle = document.createElementNS(ns, 'text');
  subtitle.setAttribute('x', cardW / 2);
  subtitle.setAttribute('y', 170);
  subtitle.setAttribute('text-anchor', 'middle');
  subtitle.setAttribute(
    'font-family',
    '-apple-system, Helvetica Neue, Arial'
  );
  subtitle.setAttribute('font-size', 20);
  subtitle.setAttribute('fill', '#6e6e73');
  subtitle.textContent = 'For all things Apple.';
  svg.appendChild(subtitle);

  const body1 = document.createElementNS(ns, 'text');
  body1.setAttribute('x', cardW / 2);
  body1.setAttribute('y', 250);
  body1.setAttribute('text-anchor', 'middle');
  body1.setAttribute(
    'font-family',
    '-apple-system, Helvetica Neue, Arial'
  );
  body1.setAttribute('font-size', 14);
  body1.setAttribute('fill', '#86868b');
  body1.textContent =
    'Use this card to shop the App Store, Apple TV, Apple Music,';
  svg.appendChild(body1);

  const body2 = document.createElementNS(ns, 'text');
  body2.setAttribute('x', cardW / 2);
  body2.setAttribute('y', 272);
  body2.setAttribute('text-anchor', 'middle');
  body2.setAttribute(
    'font-family',
    '-apple-system, Helvetica Neue, Arial'
  );
  body2.setAttribute('font-size', 14);
  body2.setAttribute('fill', '#86868b');
  body2.textContent =
    'iTunes, Apple Books, Apple Arcade, iCloud+, and more.';
  svg.appendChild(body2);

  const boxH = 140;
  const boxW = boxH * 4;
  const boxX = (cardW - boxW) / 2;
  const boxY = 315;
  const borderW = Math.round(boxH * 0.045);

  const border = document.createElementNS(ns, 'path');
  border.setAttribute(
    'd',
    `M${boxX},${boxY} h${boxW} v${boxH} h${-boxW} Z`
  );
  border.setAttribute('fill', 'none');
  border.setAttribute('stroke', '#000000');
  border.setAttribute('stroke-width', borderW);
  border.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(border);

  const boxBg = document.createElementNS(ns, 'rect');
  boxBg.setAttribute('x', boxX + borderW / 2);
  boxBg.setAttribute('y', boxY + borderW / 2);
  boxBg.setAttribute('width', boxW - borderW);
  boxBg.setAttribute('height', boxH - borderW);
  boxBg.setAttribute('fill', '#ffffff');
  svg.insertBefore(boxBg, border);

  const fontSize = Math.round(boxH * 0.34);
  const codeText = document.createElementNS(ns, 'text');
  codeText.setAttribute('x', cardW / 2);
  codeText.setAttribute('y', boxY + boxH / 2 + fontSize * 0.35);
  codeText.setAttribute('text-anchor', 'middle');
  codeText.setAttribute('font-family', 'Scancardium, monospace');
  codeText.setAttribute('font-size', fontSize);
  codeText.setAttribute('font-weight', '500');
  codeText.setAttribute('letter-spacing', '2');
  codeText.setAttribute('fill', '#000000');
  codeText.textContent = code;
  svg.appendChild(codeText);

  const serial = 'GCA' + Array.from(
    { length: 13 },
    () => Math.floor(Math.random() * 10)
  ).join('');
  const serialText = document.createElementNS(ns, 'text');
  serialText.setAttribute('x', cardW / 2);
  serialText.setAttribute('y', boxY + boxH + 40);
  serialText.setAttribute('text-anchor', 'middle');
  serialText.setAttribute(
    'font-family',
    '-apple-system, Helvetica Neue, Arial'
  );
  serialText.setAttribute('font-size', 11);
  serialText.setAttribute('fill', '#86868b');
  serialText.textContent = serial;
  svg.appendChild(serialText);

  return svg;
}

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

    const svg = buildCardSvg(card.code);

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

    footer
      .querySelector('.copy-btn')
      .addEventListener('click', async (event) => {
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
          showToast('Couldn’t copy — select and copy manually');
        }
      });

    node.appendChild(header);
    node.appendChild(svg);
    node.appendChild(footer);
    el.cardsArea.appendChild(node);
  }
}

let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

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
