# Anon Computer — Marketing Site

Public site for **anoncomputer.com**: download Anon Browser. No Coinclave / silicon tease — the page is the product.

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

Platform buttons point at GitHub Releases:

`https://github.com/Schellbach/anon-browser/releases/latest`

Update `src/lib/downloads.ts` when Windows/Linux builds ship, or when you host DMGs on a CDN.

## Brand

- **Mark:** Annona (sugar apple) silhouette — `public/anon-mark.png`
- **App icon:** `public/icon.png`
- **Fonts:** Instrument Sans + IBM Plex Mono (`public/fonts/`)
- **Accents:** copper `#C17F59`, seal green `#3D8B6E`
- **Tone:** Ship the browser. No roadmap bait.
