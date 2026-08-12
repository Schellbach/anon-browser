# Anon Computer ⸻ Marketing Site

Public site for **anoncomputer.com**: download Anon Browser. No Coinclave / silicon tease ⸻ the page is the product.

## Run

```bash
cd site
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy (Netlify)

Site name: **anonbrowser** (separate from `anon-computer` / Coinclave).

```bash
cd site
npm run build
netlify deploy --prod --dir dist --no-build
```

- Production: https://anonbrowser.netlify.app  
- Custom domain: https://anoncomputer.com  
- Admin: https://app.netlify.com/projects/anonbrowser

## Downloads

`src/lib/downloads.ts` points macOS / Linux CTAs at versioned GitHub Release
assets (see repo `docs/05-packaging.md`). Push a `v*` tag to publish those
files via the Preview release workflow.

Until a release exists, those URLs 404 — cut `v0.3.0` (or bump `VERSION`) first.

Windows remains “Coming soon.” After notarized Mac builds ship, update the macOS
`detail` string and optionally keep the same asset name.

## Brand

- **Mark:** Annona (sugar apple) silhouette ⸻ `public/anon-mark.png`
- **App icon:** `public/icon.png`
- **Fonts:** Instrument Sans + IBM Plex Mono (`public/fonts/`)
- **Accents:** seal green `#2F6F58` / `#3D8B6E`
- **Tone:** Ship the browser. No roadmap bait.
