# U.A.U. Jigbo Technics — Tax Invoice

Static invoice tool. Runs entirely in the browser. No server, no database, no data sent anywhere.

## Files

| File          | Purpose                          |
|---------------|----------------------------------|
| `index.html`  | Rename `invoice.html` to this    |
| `invoice.css` | All styles                       |
| `invoice.js`  | All logic                        |
| `_headers`    | Security headers (Netlify/CF)    |

## Deploy to GitHub Pages

1. Create a new GitHub repo (can be private)
2. Upload `invoice.html` (rename to `index.html`), `invoice.css`, `invoice.js`
3. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**
4. Site will be live at `https://yourusername.github.io/reponame/`

## Security

- **CSP meta tag** — blocks inline scripts, external scripts, framing
- **No innerHTML** — all DOM built via `createElement` only
- **Input sanitization** — numeric fields stripped of non-numeric chars; tax rate clamped 0–100
- **Signature upload** — file type whitelist (PNG/JPG/GIF/WebP), 2MB size cap, data URI prefix validation
- **IIFE** — all JS wrapped, zero global scope leakage
- **No external dependencies** — no CDN, no analytics, no tracking
- **No data stored** — nothing is saved to localStorage, cookies, or any server
- **Cache-Control: no-store** — invoice data does not persist in browser cache

## Usage

- Fill in invoice fields directly in the browser
- Add/remove item rows and HSN rows as needed
- Enter tax rates (CGST/SGST/IGST) — totals calculate automatically
- Upload signature image (max 2MB, PNG/JPG only)
- Click **Print / Save PDF** to export
