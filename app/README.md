# Build Your Outfit

Build outfits from photos of your own clothes. Everything is stored in the browser (IndexedDB); there is no server. See `../BUILD_SPEC.md` for the full spec.

## Commands

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # storage + backup tests (Vitest + fake-indexeddb)
npm run build     # static site in dist/
npm run format    # Prettier
```

## Deploying

`dist/` is a static site. `/` and `/saved` are client-side routes, so the host must serve `index.html` for unknown paths:

- **Netlify:** `public/_redirects` is included.
- **Vercel:** `vercel.json` is included.
- **GitHub Pages:** copy `dist/index.html` to `dist/404.html` after building, and set Vite's `base` if the site isn't at the domain root.

## Layout

| Path | What's there |
|---|---|
| `src/storage/` | The only code that touches IndexedDB: schema + migrations (`db.ts`), reads/writes/soft deletes (`index.ts`), backup zip (`backup.ts`) |
| `src/state/` | React providers: app data + object URLs (`AppData`), the auto-saved canvas draft (`Draft`), backup export/import (`Backup`) |
| `src/lib/` | Photo pipeline, snapshot rendering, canvas geometry, pointer-event hooks (drag, press-and-hold), selection, a11y helpers |
| `src/components/` | UI pieces (canvas, wardrobe card and drawer, pop-ups, toasts, menus) |
| `src/pages/` | The builder (`/`) and saved outfits (`/saved`, `/saved/folder/:id`) |
| `src/styles/` | Design tokens and shared styles |
