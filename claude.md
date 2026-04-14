# Apple Gift Card Scanner — Build Specification

## Problem

When redeeming Apple gift cards on iPhone/iPad, Apple gives two options:
1. **Use Camera** — scans a physical gift card and reads the code automatically
2. **Enter Code Manually** — type the 16-character code (e.g. `XXVP9XZYFMQMR2X8`) by hand

The user buys gift cards online and receives codes via email. They have no physical card to scan, so they're forced to manually type long codes every time. This tool generates a screen-displayable image that Apple's camera scanner will recognize as a real gift card, so the user can just point their iPad at their screen and scan.

## How Apple's Camera Scanner Works (Critical Technical Details)

Apple does **NOT** use a barcode or QR code. Their scanner uses a proprietary OCR system built into the `CoreRecognition.framework`. Here's exactly what it looks for:

### 1. The Scancardium Font
- Apple uses a **proprietary font called "Scancardium"** (version 2.0, TTF, ~6KB)
- The scanner **only** triggers its recognition engine when it detects the visual characteristics of this specific font
- Standard fonts like Courier, Monaco, SF Mono, etc. will **NOT** work — the scanner ignores them entirely
- The font is stored on macOS at: `/System/Library/PrivateFrameworks/CoreRecognition.framework/Resources/Fonts/Scancardium_2.0.ttf`
- It is available for download from this GitHub repo: https://github.com/hughmandeville/homekit_code (inside the `fonts/` directory)
- Also available as a zip from: https://github.com/hoobs-org/hoobs-core/files/3464602/Scancardium.zip

### 2. The Surrounding Box
- The code must be displayed **inside a rectangular bordered box**
- The box must have a **width-to-height ratio of exactly 3:1**
- The border must be solid black on white background

### 3. Exact Proportions (relative to box height = 1.0)
| Element | Factor |
|---|---|
| Box height | 1.0 (base unit) |
| Box width | 3.0 × height |
| Border thickness | 0.045 × height |
| Font size (cap height) | 0.34 × height |
| Code centered vertically and horizontally inside the box | — |

#### Concrete Example
If box height = 120px:
- Box width = 360px
- Border thickness = 5.4px (~5px)
- Font size = ~40.8px (~41px) — this is the visual cap height, so the CSS font-size may need to be slightly larger depending on the font's metrics. Test and adjust.

### 4. Source & Credit
This was reverse-engineered by Equinux (makers of Mail Designer Pro) in 2017. Full write-up: https://blog.equinux.com/2017/07/cracking-the-code-behind-apples-app-store-promo-card-design/

## What to Build

A **single-page, client-side website** (HTML/CSS/JS or React) that:

1. Loads the Scancardium font
2. Lets the user paste one or more gift card codes
3. Generates a scannable card for each code, following the exact specs above
4. Displays cards on screen so the user can point their iPad camera at the monitor

**No server, no database, no backend.** Everything runs in the browser.

## Font Loading Strategy

The font is not on any public CDN. Use this approach:

### Primary: Load from GitHub Pages
The font is hosted at:
```
https://hughmandeville.github.io/homekit_code/fonts/Scancardium_2.0.ttf
```
Attempt to load it via `@font-face` or `FontFace` API from this URL on page load.

### Fallback: User uploads the font file
If the remote load fails (CORS, network issues, etc.), show a clean UI asking the user to:
1. Download the font from the GitHub repo (provide link)
2. Drag & drop or file-pick the `.ttf` file into the page
3. Load it into the page via `FontFace` API

### Font loading state
- Show a clear status indicator: "Loading font..." → "Font ready ✓" or "Font failed — please upload manually"
- **Do NOT allow card generation until the font is confirmed loaded** — without Scancardium, the scanner won't work

## Card Display Specifications

Each generated card should display:

### The Scannable Code Box (this is what the camera reads)
- White rectangle with black border
- 3:1 width-to-height ratio
- Border thickness = 0.045 × height
- Code text in Scancardium font, size = 0.34 × height
- Code centered in the box both horizontally and vertically
- **No other text or decoration inside this box** — just the code
- High contrast: pure black text (#000) on pure white background (#FFF) with black border (#000)

### The Surrounding Card (decorative, Apple-style)
- Wrap the scannable box in a nice Apple-style card design (see Design section)
- Show the code in a readable format below or above the scan box as well (for the user's reference)
- Include a "Copy Code" button as fallback

## Design Requirements — Apple Brand Feel

The entire page should feel like it came from Apple. Study Apple's design language:

### Color Palette
- **Background**: Light neutral — `#F5F5F7` (Apple's signature light gray)
- **Cards**: Pure white `#FFFFFF` with subtle shadow
- **Text**: `#1D1D1F` (Apple's near-black)
- **Secondary text**: `#86868B` (Apple's gray)
- **Accent/buttons**: `#0071E3` (Apple's blue) with hover `#0077ED`
- **Success states**: `#34C759` (Apple's green)
- **Destructive/error**: `#FF3B30` (Apple's red)

### Typography
- Use **SF Pro** font family for all UI text (not for the scannable code — that must be Scancardium)
- Load from: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700` as a fallback since SF Pro isn't on Google Fonts. Or use the system font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`
- Font weights: 400 (body), 500 (medium labels), 600 (semibold headings), 700 (bold hero)
- Clean, generous line-height (1.47 for body, 1.1 for headings)

### Layout & Spacing
- Generous whitespace everywhere — Apple never feels cramped
- Max content width ~680px, centered
- Card border-radius: 18px (Apple's rounded corner style)
- Padding inside cards: 32px+
- Spacing between elements: 16px, 24px, 32px scale

### Shadows & Depth
- Cards: `0 2px 12px rgba(0,0,0,0.08)` — subtle, not dramatic
- Hover states: slightly elevated shadow
- No gradients on backgrounds — flat and clean

### Buttons
- Rounded: `border-radius: 980px` (Apple's pill shape)
- Primary: filled blue `#0071E3`, white text, padding `12px 24px`
- Secondary: text-only or light outline
- Smooth transitions: `transition: all 0.2s ease`

### Icons
- Use minimal SF Symbol-style icons if needed
- Apple logo (SVG) in the header — the classic apple silhouette

### Animation
- Subtle fade-in for cards when generated
- Smooth transitions on hover/focus states
- Nothing flashy or bouncy — Apple is calm and confident

## Page Structure

### Header
- Small Apple logo (SVG)
- Title: "Gift Card Scanner" in clean semibold text
- Subtitle: one-line explanation like "Generate scannable codes for quick camera redemption"

### Font Status Bar
- Compact bar showing font load status
- Green checkmark when loaded, or upload prompt if failed

### Input Area
- Clean textarea with placeholder text: "Paste your gift card codes here, one per line"
- Helper text below: "Enter 16-character codes like XXVP9XZYFMQMR2X8"
- "Generate" button — Apple blue pill button
- "Clear All" link/button when cards exist

### Cards Area
- Each card displays:
  - The scannable box (white box, black border, Scancardium font code)
  - The code in readable format for the user
  - "Copy Code" button
  - Small "Remove" button (×)
- Cards should be large enough that when displayed on a laptop/monitor screen, an iPad held 4-7 inches away can read them

### Footer (minimal)
- Small text: "All processing happens in your browser. No data is sent anywhere."
- Link to the Equinux article for the curious

## Code Validation
- Apple gift card codes are 16 alphanumeric characters (uppercase letters and numbers)
- They typically start with X
- Accept codes with or without spaces/dashes (strip them before display)
- Show inline validation: highlight invalid codes

## Important Implementation Notes

1. **The scannable box must be EXACTLY to spec.** The 3:1 ratio, border thickness, and font size proportions are what trigger Apple's scanner. If these are off, the camera won't recognize it. Test with real values.

2. **Make the scannable box large on screen.** Apple's docs say hold the card 4-7 inches (10-18cm) from the camera. The box needs to be big enough that from that distance, the camera can resolve the characters. Aim for a box at least 400px wide on screen.

3. **High contrast is critical.** The scan area must be pure black on pure white. No gray, no transparency, no colored backgrounds bleeding through.

4. **The decorative card wrapper is separate from the scan area.** The Apple-style design is for the surrounding card/page. The actual scan box inside must be plain black-on-white with the exact border specs.

5. **Test the font loading thoroughly.** If Scancardium isn't loaded and a fallback font renders instead, the scanner will NOT work. Gate the generate button behind confirmed font load.

6. **Make it responsive** but optimize for the use case: displaying on a laptop/desktop screen while scanning with a mobile device. The cards should be large.

7. **No localStorage** if building as a React artifact for Claude.ai — use in-memory state only. If building as a standalone HTML file, localStorage is fine for remembering codes between sessions.
