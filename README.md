# Redeem Apple Gift Cards Without Typing

A tiny website that turns Apple gift card codes you received by email into images your iPhone or iPad camera can scan — so you never have to type a 16‑character code again.

**Live site:** *(set up GitHub Pages and the URL appears here — typically `https://<your-user>.github.io/<repo>/`)*

## The problem

When you redeem an Apple gift card on iPhone or iPad, Apple offers two choices:

1. **Use Camera** — point it at a physical card and the code is captured instantly.
2. **Enter Code Manually** — type the 16 characters by hand.

If you bought the card online, you only got the code in an email. No card, no scanning — so you're stuck typing something like `XXVP9XZYFMQMR2X8` every single time. This tool generates an image on your computer screen that Apple's camera scanner recognizes as if it were a real card. Point your iPad at the screen, done.

## How to use it

1. Open the site on a laptop or desktop.
2. Wait for the "Scancardium font loaded" confirmation (usually instant).
3. Paste one or more codes into the box — one per line. Spaces and dashes are fine.
4. Click **Generate**. A scannable card appears for each code.
5. On your iPhone/iPad, open the App Store, tap your profile picture, choose **Redeem Gift Card or Code**, then **Use Camera**.
6. Point the camera at a card on your screen, 4–7 inches away. It reads the code immediately.

There's also a **Copy code** button on every card as a fallback.

## Is this safe?

Yes. Everything runs locally in your browser:

- No server, no database, no analytics, no tracking.
- Your gift card codes never leave your computer.
- The entire site is three static files: `index.html`, `styles.css`, `app.js`, plus a font file.

You can verify this yourself — open the browser dev tools Network tab while you use it. After the initial page load, nothing is sent anywhere.

## How Apple's camera scanner actually works (for the curious)

Apple's scanner is **not** a QR code or barcode reader. It's a custom OCR system in the private `CoreRecognition.framework`, and it only triggers when it spots the visual signature of one specific font Apple uses on their own gift cards:

- **The font is called Scancardium** (version 2.0). It ships with macOS in a private framework folder and nowhere else. Standard monospaced fonts like Courier, Monaco, or SF Mono don't work — the scanner just ignores them.
- **The code must be inside a bordered box with a width-to-height ratio of exactly 3:1.**
- **The border thickness is ~4.5% of the box height.**
- **The font cap height is ~34% of the box height**, centered inside the box.
- The whole thing must be pure black on pure white, high contrast.

If any of those are off, the scanner doesn't engage. This site follows the exact proportions, uses the real Scancardium font loaded from a local file, and renders each card at a size large enough for a camera held a few inches from your monitor to resolve the characters.

The research behind all of this was done by **Equinux** (the team behind Mail Designer Pro) back in 2017. Full write‑up and the original reverse‑engineering story:

<https://blog.equinux.com/2017/07/cracking-the-code-behind-apples-app-store-promo-card-design/>

## Technical notes

- Pure vanilla HTML/CSS/JS, no build step.
- The Scancardium font is loaded via the [FontFace API](https://developer.mozilla.org/en-US/docs/Web/API/FontFace) from the local `fonts/` folder.
- If the font fails to load for any reason, the UI asks you to upload the `.ttf` file manually before letting you generate cards. The generate button stays disabled until Scancardium is confirmed available — without that font, the scanner won't trigger.
- Code validation accepts 16 uppercase alphanumeric characters, after stripping spaces and dashes.
- No `localStorage`, no cookies, no state persistence — reloading the page clears everything.

## Running locally

Just open `index.html` in a browser — but because of how browsers handle local fonts over `file://`, it's better to serve the folder:

```bash
# Python 3
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

## Credits

- **Scancardium font** — Apple Inc., distributed via their public `CoreRecognition.framework`. Mirrored for convenient download in this repo by [hughmandeville/homekit_code](https://github.com/hughmandeville/homekit_code).
- **Reverse engineering** — Equinux, 2017. [Original blog post](https://blog.equinux.com/2017/07/cracking-the-code-behind-apples-app-store-promo-card-design/).
- Built with the help of [Claude Code by Anthropic](https://claude.com/claude-code).

## License

MIT. Do whatever you want with it.
