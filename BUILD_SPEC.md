# Build Your Outfit — build spec

A web app for building outfits from photos of your own clothes. You add photos of your pieces to a wardrobe, drag them onto a tall canvas to put an outfit together, and save outfits into folders. **Everything is saved in the browser**, so photos, categories, outfits and folders are still there after a reload or a restart. There's no server and no accounts.

This is a redesign of `reference/original-wardrobe-designer.html`, a single-file app built earlier. Keep its core idea: drag pieces onto a canvas, move and resize them, and save a snapshot. Replace its look and behavior with what's in this spec and in `design-mockups/`.

---

## 1. What's in this folder

| Path | What it is |
|---|---|
| `BUILD_SPEC.md` | This file. It's the source of truth for behavior. |
| `design-mockups/*.html` | Static mockups of each screen. Open them in a browser. They are fixed 1280px frames for visual reference only; don't copy their absolutely-positioned layout. Take colors, type, spacing, radii and component shapes from them. |
| `reference/original-wardrobe-designer.html` | The old app. Useful for the resize-handle math and the canvas-snapshot approach. Its styling and HTML5 drag-and-drop should **not** be reused (see §6). |

Mockup index:

1. `01-builder.html`: main screen, with the canvas and the wardrobe card using category tabs
2. `02-save-outfit-popup.html`: pop-up for naming the outfit and picking a folder
3. `03-wardrobe-select-to-delete.html`: wardrobe in selection mode, with a Cancel / Delete all bar
4. `04-full-wardrobe-drawer.html`: expanded wardrobe with search and a grid grouped by category
5. `05-add-a-piece-popup.html`: pop-up for adding a photo, with name, category and "+ New category"
6. `06-saved-outfits-folders.html`: saved outfits page with a folders row and an outfits grid
7. `07-saved-outfits-select-to-delete.html`: saved outfits in selection mode

---

## 2. Tech stack

- **Vite + React + TypeScript.** Plain CSS or CSS modules with the design tokens below as CSS custom properties. No UI kit.
- **IndexedDB** for storage, through the small [`idb`](https://www.npmjs.com/package/idb) wrapper.
- Deploys as a static site (Netlify, Vercel or GitHub Pages). No backend.
- Keep every storage call behind one module (`src/storage/`), so the UI never touches IndexedDB directly.

---

## 3. Design tokens

**Fonts** (Google Fonts):
- Display/titles: **Fraunces**, italic, weight 600 (page titles 42px, pop-up titles 28px, section titles 22–24px).
- Everything else: **DM Sans**, 400/500/600.

**Colors**

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#fff6f9` | page background (blush), including the side margins |
| `--surface` | `#ffffff` | canvas, cards, pop-ups |
| `--surface-soft` | `#fffafc` | thumbnail backgrounds |
| `--border` | `#f1e4ea` | tiles, cards |
| `--border-pink` | `#f4d3e0` | canvas and wardrobe card outline |
| `--dot-grid` | `#f6d5e2` | canvas dot pattern (1.2px dots every 22px) |
| `--ink` | `#4a2a37` | body text; the selection bar background |
| `--muted` | `#9a6b7e` | small caps labels, dates, hints |
| `--accent` | `#d81b60` | primary buttons, selected tabs, selection borders |
| `--accent-text` | `#c2185b` | titles, pink text on white |
| `--accent-ink` | `#b0174f` | secondary pink buttons and links |
| `--dashed` | `#eaa3c0` | dashed "add" tiles |
| `--lilac-border` / `--lilac-ink` | `#cdb3e0` / `#6a3f8a` | "Saved outfits" button |
| `--scrim` | `rgba(74,42,55,0.32)` | pop-up backdrop |

Whimsical accents: two small four-point sparkles beside page titles (gold `#f5b83d` on the left, sky `#6bb8dc` on the right). Folders each get an accent color from pink `#ff6b9d`, blue `#5b9bd5`, lilac `#c9a0dc`, gold `#f5b83d` or mint `#7fd1ae`, assigned in rotation.

**Shape:** pill buttons (`border-radius: 999px`, 44px tall for primary actions). Canvas radius 28px, cards 20–24px, tiles 16px, pop-ups 26px. Soft shadows only on the primary button, pop-ups and the selection bar. No emoji; use inline SVG icons.

**Layout:** a single centered column, **max-width 640px**, with blush margins on either side on desktop. On phones the column is full width with 16px side padding. The page header (title centered, "Saved outfits" pinned top-right) spans the full width.

---

## 4. Screens and behavior

### 4.1 Builder (`01-builder.html`)

- **Header:** "Build your outfit" centered, with sparkles. A **"Saved outfits"** pill sits in the top-right of the page.
- **Canvas:** a tall rectangle (about 640×760 on desktop, a 5:6 aspect ratio or taller on mobile), white with the dot grid.
  - **"Clear all"** (small outlined pill) in the top-right corner of the canvas. It removes every piece from the canvas and has an undo toast.
  - **"Save outfit"** (primary pink pill) in the bottom-right corner of the canvas. It opens the save pop-up and is disabled when the canvas is empty.
  - Empty state: a centered muted line, "Drag pieces from your wardrobe to start an outfit".
  - Placed pieces can be **moved** by dragging, and **resized** from 3 corner handles with the aspect ratio locked (minimum 50px). They're **removed** with a small × at the top-right. Handles and × show only on the selected (last tapped) piece, which gets a dashed pink outline. Tapping empty canvas deselects. The last-touched piece comes to the front.
  - The canvas in progress (a "draft") is saved automatically, so a reload doesn't lose it (see §5).
- **Wardrobe card** under the canvas:
  - **Row 1:** category tabs (`All 25`, `Tops 7`, `Bottoms 5`, …) as pills with counts, scrolling sideways with a fade on the right. On the right are two icon buttons, **Search** and **Expand**, and both open the full wardrobe drawer (Search also focuses its search field).
  - **Row 2:** a dashed **"Add photo"** tile, then the pieces in the selected tab, scrolling sideways. A round › arrow button scrolls it on desktop.
  - Drag a tile onto the canvas to place a copy (see §6 for touch handling). A tap on a tile (no drag) also works: it drops the piece near the canvas center.

### 4.2 Save outfit pop-up (`02-save-outfit-popup.html`)

- A small thumbnail preview of the canvas, an **Outfit name** field (required, prefilled "Outfit N" with the text selected), and **Add to folder (optional)** chips for each folder plus a dashed **"+ New folder"** chip.
- "+ New folder" turns into an inline text field. Enter creates the folder and selects it.
- **Cancel** / **Save outfit**. Saving stores the outfit (§5), closes the pop-up, and shows a toast: "Saved to *Weekend*" or "Outfit saved". The canvas stays as it is.
- Esc and clicking the scrim both cancel. Focus is trapped inside the pop-up.

### 4.3 Full wardrobe drawer (`04-full-wardrobe-drawer.html`)

- A sheet slides up from the bottom and covers the lower part of the page, with a scrim behind it. The top of the canvas stays visible.
- Header: "Wardrobe · N pieces", an **Add photo** pill, and a **collapse** button (arrows-in icon) that closes the drawer back to the compact card.
- A **search field** filters pieces by name and by category name as you type. Empty results say "Nothing matches '…'".
- Category tabs (the same as the compact card) scroll the grid to that section or filter it.
- A grid of pieces **grouped by category** with small caps headers ("TOPS · 7"), 7 columns on desktop and 4 on phones.
- Dragging a piece from the drawer onto the visible part of the canvas places it. Tapping a piece places it at the canvas center and closes the drawer.

### 4.4 Add a piece pop-up (`05-add-a-piece-popup.html`)

- Opens from any "Add photo" button. First a file picker (`accept="image/*"`, multiple allowed; on phones this offers the camera).
- For each chosen photo the pop-up shows: a preview, **Name (optional)**, and **Category** chips (all categories plus a dashed **"+ New category"** chip). "+ New category" becomes an inline field; Enter creates the category and selects it.
- A category is **required**. It defaults to the tab currently open in the wardrobe (or none if "All").
- **Cancel** / **Add to wardrobe**. With several photos, show "1 of 3" and a "Skip" link, or a list with a category picker per photo.
- On add: downscale and store the image (§5.3), then switch the wardrobe to that piece's category tab so the new piece is visible.

### 4.5 Deleting wardrobe pieces (`03-wardrobe-select-to-delete.html`)

- **Press and hold** (about 500ms, with no movement) on any wardrobe tile enters selection mode with that piece selected. After that, **single taps** toggle other pieces.
- In selection mode, unselected tiles show an empty circle in the corner and selected ones show a pink border with a white check on a pink circle. Dragging onto the canvas is disabled.
- A dark pill **pops up** above the wardrobe: "*N* selected", **Cancel**, **Delete all**. Delete all deletes the selected pieces (not the whole wardrobe) after a confirmation if any of them is used in a saved outfit ("2 pieces are used in saved outfits. Those outfits will keep their picture."). Cancel, Esc, or deselecting everything exits selection mode.
- Show an undo toast for about 6 seconds after deleting (soft delete, then purge).

### 4.6 Saved outfits (`06-saved-outfits-folders.html`)

- Header: "← Back to builder" pill top-left, "Saved outfits" title centered.
- **Folders** row: a grid of folder tiles (icon in the folder's accent color, name, "N outfits") plus a dashed **"+ New folder"** tile, which opens a small pop-up asking for a name.
- Tapping a folder opens a **folder view**: the same page with the title set to the folder name, a back link to "All outfits", and only that folder's outfits. (Not mocked; match the saved-outfits page.)
- **All outfits** grid, 3 columns on desktop and 2 on phones. Each card shows the saved snapshot on the dot-grid background, with the **name** and the **date** below.
- Tapping a card opens a larger preview with the name (rename in place), folder (move with chips), and "Load into builder". Loading replaces the canvas with that outfit's layout; if the canvas has unsaved work, confirm first.
- Hint text at the top right of the grid: "Press and hold an outfit to select".

### 4.7 Deleting saved outfits (`07-saved-outfits-select-to-delete.html`)

This works exactly like §4.5: press and hold, then tap to add more, with the same pop-up bar reading "*N* selected / Cancel / Delete all" and an undo toast.

### 4.8 Not designed yet: please design these consistently with the mockups

- Small naming pop-ups for New folder and New category (reuse the save pop-up's style).
- Renaming and deleting folders and categories. Suggestion: press and hold a folder or tab for a small menu with Rename / Delete. Deleting a category with pieces in it asks where those pieces should move. Deleting a folder moves its outfits back to "All".
- Empty states: an empty wardrobe ("Add your first piece"), no saved outfits yet, an empty folder.
- The storage warning banner (§5.4).

---

## 5. Data and persistence

### 5.1 Database

IndexedDB database `outfit-builder`, version 1. Object stores:

```ts
type ID = string; // crypto.randomUUID()

interface Category { id: ID; name: string; order: number; createdAt: number; }
// Seed on first run: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories

interface Piece {
  id: ID;
  name?: string;
  categoryId: ID;
  image: Blob;        // downscaled original, see 5.3
  thumb: Blob;        // ~256px for wardrobe tiles
  width: number;      // natural size of `image`, for aspect ratio
  height: number;
  createdAt: number;
  deletedAt?: number; // soft delete for undo; purged later
}

interface Folder { id: ID; name: string; color: string; order: number; createdAt: number; }

interface PlacedPiece {
  pieceId: ID;
  // stored as fractions of the canvas size (0–1) so outfits survive
  // different screen sizes
  x: number; y: number; w: number; h: number;
  z: number;
}

interface Outfit {
  id: ID;
  name: string;
  folderId: ID | null;
  layout: PlacedPiece[];
  snapshot: Blob;     // PNG/WebP render of the canvas at save time
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

interface Draft { id: 'current'; layout: PlacedPiece[]; updatedAt: number; }
```

Stores: `categories`, `pieces` (index on `categoryId`), `folders`, `outfits` (index on `folderId`), `draft` (a single record).

### 5.2 Rules

- **Every change is written straight away**: adding, deleting or renaming a piece, category, folder or outfit. The draft canvas is written with about a 300ms debounce after moves and resizes.
- On load, read everything from IndexedDB before first render (show a quiet loading state), then use object URLs (`URL.createObjectURL`) for images. Revoke them when a piece is removed.
- An outfit keeps its **own snapshot**, so it still shows correctly if one of its pieces is later deleted. Its `layout` is only used by "Load into builder"; missing pieces are skipped with a notice.
- Deletes are soft (`deletedAt`) for the undo toast, then purged after the toast closes or on the next app start.
- Put a schema version and migration hook in the storage module now, even though v1 needs none.

### 5.3 Photos

- On upload, decode the image, **correct its orientation** (use `createImageBitmap` with `imageOrientation: 'from-image'`), and downscale so the long edge is at most **1200px**. Store it as WebP (quality 0.85), falling back to PNG. PNG keeps transparency for cut-out photos.
- Make a **~256px thumbnail** for wardrobe tiles and the drawer.
- Build outfit snapshots by drawing each placed piece's image onto an offscreen canvas at its saved position, the way the original app did, on the white dot-grid background.

### 5.4 Keeping data safe

- Call `navigator.storage.persist()` on first save, so the browser is less likely to clear data when space is low. If it's refused, show a one-time gentle note.
- Add **Export backup** and **Import backup** (in a small ⋯ menu in the header). They produce or read one `.zip` holding `data.json` plus the image files. Browser storage lives on one device and can be wiped by clearing site data, so this is the safety net.
- Catch `QuotaExceededError` on writes and show "Storage is full: delete some pieces or export a backup".

---

## 6. Interaction details

- Use **Pointer Events** (`pointerdown` / `pointermove` / `pointerup` with `setPointerCapture`) for everything: dragging from the wardrobe, moving and resizing on the canvas, and press-and-hold. Don't use HTML5 drag-and-drop, which doesn't work on phones. While dragging from the wardrobe, show a floating "ghost" copy of the tile under the finger.
- Tell press-and-hold apart from drag and scroll: start a 500ms timer on `pointerdown` and cancel it if the pointer moves more than 8px. Use `touch-action: pan-x` on the wardrobe strip, so sideways scrolling still works, and `touch-action: none` on canvas items.
- Keyboard: tiles and canvas pieces are focusable. Enter places a piece; arrow keys nudge the selected canvas piece (Shift for bigger steps), +/- resize it, and Delete removes it. Esc closes pop-ups, the drawer and selection mode.
- Use real `<button>`s and `<a>`s, `aria-label` on icon-only buttons, `aria-pressed` on tabs and chips, and `role="dialog"` with `aria-modal` on pop-ups.

---

## 7. Suggested build order

1. Set up the project, design tokens, fonts and the page shell (header, centered column, both routes: `/` builder and `/saved`).
2. Storage module plus seed categories, and tests for its read/write functions.
3. Add a piece pop-up with the photo pipeline, and the wardrobe card with tabs and a sideways-scrolling strip.
4. Canvas: placing, moving, resizing, removing, Clear all, and the auto-saved draft.
5. Save outfit pop-up with snapshot and folders; saved outfits page and folder view.
6. Selection mode and deleting, with undo, in both places.
7. Full wardrobe drawer with search.
8. Backup export/import, `storage.persist()`, empty states and the quota error.
9. Mobile pass at 390px wide, and a keyboard/screen-reader pass.

## 8. Done when

- [ ] Adding 25+ photos across categories, then reloading, shows all of them in the right tabs.
- [ ] Deleting pieces or outfits, then reloading, keeps them gone; undo within the toast restores them.
- [ ] A new category or folder survives a reload.
- [ ] A half-built outfit on the canvas survives a reload.
- [ ] Saved outfits show the same picture after one of their pieces is deleted.
- [ ] Everything works with touch on a phone: drag onto the canvas, move, resize, press-and-hold, and sideways scrolling of the tabs and strip.
- [ ] Exporting a backup, clearing site data, then importing the backup brings everything back.
- [ ] It looks like the mockups: blush margins, a centered 640px column, Fraunces italic titles and pink pill buttons.
