# Spec: A–Z Alphabet Quick-Jump Scrollbar for Library Views

## Goal

Add a vertical A–Z index bar down the right side of the Artists and Albums
library views (and ideally any alphabetically-sortable list). Tapping a letter
jumps the list to the first item in that letter's bucket.

Requirements from the request:

- Visible **only** when the active sort is alphabetical — i.e. sort key
  `name` **or** `sort_name`.
- The letter order **reverses** (Z→A) when a descending sort is active
  (sort key ending in `_desc`).
- Applies to both the Artist and Album views; should generalise to all view
  modes (`list`, `panel`, `panel_compact`).

## Background — how the views work today

| Concern | Location | Notes |
|---|---|---|
| Artists view | `src/views/LibraryArtists.vue` | Thin wrapper around `ItemsListing` |
| Albums view | `src/views/LibraryAlbums.vue` | Thin wrapper around `ItemsListing` |
| Shared list component | `src/components/ItemsListing.vue` | Single component powers all library lists |
| Sort keys (artists) | `LibraryArtists.vue:37` | `name`, `name_desc`, `sort_name`, `sort_name_desc`, `timestamp_added(_desc)`, `last_played(_desc)`, `play_count(_desc)` |
| Sort keys (albums) | `LibraryAlbums.vue:37` | as above + `year(_desc)`, `artist_name(_desc)` |
| Active sort | `params.value.sortBy` (`ItemsListing.vue:~290`) | plain string, e.g. `"sort_name_desc"` |
| View modes | `viewMode` ref (`ItemsListing.vue:372`) | `"list"` \| `"panel"` \| `"panel_compact"` |
| List rendering | `ItemsListing.vue:128` | Vuetify `v-virtual-scroll`, fixed **70px** row height |
| Panel rendering | `ItemsListing.vue:80` / `106` | Vuetify `v-row`/`v-col` CSS grid, variable height |
| Paging | `ItemsListing.vue:1152` (`loadPagedData`) | **Server-side**, 50 items/page (`limit` default 50) |
| Infinite scroll | `ItemsListing.vue:725` (`loadNextPage`) | Appends next 50 on scroll; `allItemsReceived` flag |
| Load-all helper | `ItemsListing.vue:745` (`loadAllItems`) | Loops `loadNextPage` until all received |
| Scroll helper | `src/helpers/utils.ts` (`scrollElement`) | Eased programmatic scroll, already imported |
| Scroll container | `.content-section` in `src/layouts/default/View.vue:10` | `overflow-y: auto` |
| Item shape | `src/plugins/api/interfaces.ts` (`_MediaItemBase`) | every item has `name` + optional `sort_name` |
| Count endpoints | `src/plugins/api/index.ts:522/531` | `music/artists/count`, `music/albums/count` |

**The core problem:** the list is server-paginated (50 at a time). The frontend
does **not** hold the full list, so it cannot know what scroll offset "M" lives
at. Jumping needs either (a) loading everything first, or (b) a backend that can
report where each letter starts. This spec covers **(b), the letter-index
endpoint**, which scales to large libraries — with notes on the frontend-only
fallback.

---

## Proposed backend change (repo: `music-assistant/server`)

> Out of scope for the frontend session; documented here as the contract the
> frontend will code against.

### New command: `<media_type>/library_items/letter_index`

Returns, for a given media type + sort + filter set, the **0-based offset of the
first item** for each leading character bucket, in **ascending** order.

**Request params** (mirror the existing `library_items` filter params so the
index matches what the list actually shows):

```jsonc
{
  "favorite":            false,            // bool, optional
  "search":              "",               // string, optional
  "order_by":            "sort_name_desc", // "name(_desc)" | "sort_name(_desc)"
  "album_artists_only":  false,            // artists only
  "album_types":         [...],            // albums only
  "provider":            "...",            // optional
  "genre":               [...]             // optional
}
```

> **LOCKED CONTRACT (resolves former open question #1 — descending):**
> The endpoint receives the **full `order_by` string including any `_desc`
> suffix** and MUST return the buckets **in the same order, with `offset` values
> that are the actual 0-based row positions for that sort**. In other words, for
> `sort_name_desc` the first bucket is `Z` at offset 0, then `Y`, etc. The
> frontend renders the returned buckets verbatim and jumps straight to
> `bucket.offset` — it performs **no** reversal or offset arithmetic of its own.
> This keeps the frontend dumb and guarantees the index always lines up with the
> exact rows the list query returns for the same params.

**Response:** ordered list of buckets in the **requested sort order**. Server
owns bucketing rules so the frontend stays dumb. Example for `order_by=sort_name`
(ascending):

```jsonc
{
  "buckets": [
    { "label": "#", "offset": 0 },     // non-alpha / numeric leading chars
    { "label": "A", "offset": 12 },
    { "label": "B", "offset": 47 },
    // ... letters that have at least one item
    { "label": "Z", "offset": 980 }
  ],
  "total": 1024
}
```

For `order_by=sort_name_desc` the same library returns the buckets reversed,
with offsets recomputed for the descending row order:

```jsonc
{
  "buckets": [
    { "label": "Z", "offset": 0 },
    { "label": "Y", "offset": 44 },
    // ...
    { "label": "A", "offset": 1012 },
    { "label": "#", "offset": 1024 - countOfNonAlpha }
  ],
  "total": 1024
}
```

**Server-side rules:**

- Bucket by the **same field used for sorting** (`sort_name` when
  `order_by=sort_name`, else `name`) so the index lines up with row positions.
- Use the same locale/collation the list query uses (the frontend currently
  uses `localeCompare` with `{ numeric: true }` for client-side sorts —
  `ItemsListing.vue:1561`).
- Anything not starting A–Z collapses into a single `#` bucket (top for
  ascending, bottom for descending).
- Only include letters that actually have items (so the bar can grey-out / skip
  empties). Returning all 26 with the offset of the next non-empty bucket is an
  acceptable alternative — see "Empty letters" below.
- Honour the `_desc` suffix per the LOCKED CONTRACT above: return buckets in the
  requested order with offsets that are real row positions for that sort.

---

## Frontend implementation plan (`src/components/ItemsListing.vue`)

### 1. API client methods (`src/plugins/api/index.ts`)

```ts
getLibraryArtistsLetterIndex(
  favorite?: boolean, search?: string, order_by?: string,
  album_artists_only?: boolean, provider?: string | string[],
  genre?: number | number[],
): Promise<{ buckets: { label: string; offset: number }[]; total: number }> {
  return this.sendCommand("music/artists/library_items/letter_index", { ... });
}
// + getLibraryAlbumsLetterIndex (album_types instead of album_artists_only)
```

Expose the call to `ItemsListing` the same way data loading is injected: add an
optional prop, e.g. `loadLetterIndex?: (params: LoadDataParams) => Promise<LetterIndex>`,
set in `LibraryArtists.vue` / `LibraryAlbums.vue` next to the existing
`loadPagedData`. Views that don't pass it simply never show the bar.

### 2. Visibility + ordering logic (computed)

```ts
const ALPHA_SORTS = ["name", "sort_name"];
const baseSortKey  = computed(() => params.value.sortBy.replace(/_desc$/, ""));
const isAlphaSort  = computed(() => ALPHA_SORTS.includes(baseSortKey.value));

const showAlphabetBar = computed(() =>
  isAlphaSort.value && !!props.loadLetterIndex && letterBuckets.value.length > 1
);
```

Per the LOCKED CONTRACT the server already returns buckets in the requested
order (Z→A for `_desc`), so the bar renders `letterBuckets` **verbatim** — no
client-side reversal. Fetch `letterBuckets` whenever `isAlphaSort`, the filters,
or `sortBy` change (the same signature that triggers a full `loadData`). Cache
per sort+filter signature to avoid refetching on every scroll.

### 3. Jump-to-letter behaviour

On tapping a bucket with `offset = O`:

1. **Ensure the target page is loaded.** Because paging is incremental, page in
   up to `O` first: loop `loadNextPage` until `pagedItems.length > O` (or
   `allItemsReceived`). For descending, translate `O` to its display index
   first.
2. **Scroll to the row.**
   - **`list` mode** — fixed 70px rows: `scrollTop = displayIndex * 70`. Use the
     existing `scrollElement(contentSection, scrollTop, 0)` helper
     (`utils.ts`). The `v-virtual-scroll` reacts to container scroll, so this
     "just works" once items are loaded.
   - **`panel` / `panel_compact` modes** — variable/grid heights, no fixed row
     height. Two options:
     - (a) Compute the grid row: `Math.floor(displayIndex / columns) * rowHeight`,
       where `columns` comes from the existing `panelViewItemResponsive()` helper
       and `rowHeight` from a measured card. Approximate but smooth.
     - (b) After paging in the target item, `scrollIntoView()` on the rendered
       element keyed by item id (`:key` already set per item). More robust for
       variable heights; recommended for panel modes.

### 4. The bar component

New presentational child, e.g. `src/components/AlphabetIndexBar.vue`:

- Props: `buckets` (already reversed by parent), `disabledLabels?`.
- Fixed-position vertical strip pinned to the right of the scroll area; absolute
  within `ItemsListing`'s content wrapper so it floats over the list.
- Emits `jump(label)` → parent runs the jump logic above.
- Touch-friendly: support drag along the strip (pointer move → highlight + jump)
  in addition to tap, matching iOS-style fast-scroller UX.
- Hidden via `v-if="showAlphabetBar"`.
- Account for the `padding-bottom: 90px` on `.content-section`
  (`View.vue:92`) and the player bar so the strip isn't obscured.

### 5. Styling / responsive

- Narrow (~16–22px) strip, letters centered, current-section letter emphasised.
- Hide on very short lists (`letterBuckets.length <= 1`).
- Consider hiding on touch-small viewports if it crowds content, or overlay only
  while scrolling.

---

## Frontend-only fallback (no server change)

If the endpoint can't land soon, ship a degraded version:

1. When the bar is first shown (alpha sort active), call the existing
   `loadAllItems()` (`ItemsListing.vue:745`) to pull the whole list.
2. Build buckets client-side from `sort_name ?? name` of `pagedItems`, reusing
   the existing `localeCompare({ numeric: true })` ordering
   (`ItemsListing.vue:1561`).
3. Jump by index as above.

**Trade-off:** for large libraries (thousands of items) this is many sequential
50-item requests up front. Acceptable for small/medium libraries; the
letter-index endpoint is the scalable answer. The two can share all UI/scroll
code — only the bucket source differs, so starting with the fallback and
swapping in the endpoint later is low-risk.

---

## Open questions / decisions

1. ~~**Descending from server or client?**~~ **RESOLVED** — see LOCKED CONTRACT:
   the endpoint accepts the full `order_by` (incl. `_desc`) and returns buckets
   already ordered with real row offsets. The frontend renders verbatim.
2. **Empty letters:** skip them, or show greyed-out and snap to the next
   non-empty bucket? Recommend showing all A–Z greyed where empty for a stable
   bar height; requires the endpoint to report which letters exist.
3. **`#` bucket** for non-alpha leading chars (numbers, symbols, accented
   characters not folded to A–Z): include at top (asc) / bottom (desc).
4. **Panel-mode precision:** approve `scrollIntoView` (option b) vs computed
   grid offset (option a). Recommend `scrollIntoView` for panel modes.
5. **Collation parity:** confirm the server query and the index use identical
   collation so offsets are exact.

---

## Effort estimate

| Piece | Effort |
|---|---|
| Server `letter_index` command (separate repo) | ~0.5–1 day |
| API client methods + prop wiring | ~0.5 day |
| Visibility/reverse logic + bucket fetch/cache | ~0.5 day |
| `AlphabetIndexBar.vue` (incl. drag UX) | ~0.5–1 day |
| Jump logic — list mode | ~0.25 day |
| Jump logic — panel/compact modes | ~0.5 day |
| Styling/responsive + QA across view modes | ~0.5 day |

**Frontend total:** ~2.5–3 days. **+ backend:** ~0.5–1 day in the server repo.
Fallback-only (no backend) trims to ~2 days but with the large-library caveat.
