# Spec: A–Z Alphabet Quick-Jump Scrollbar for Library Views

## Goal

Add a vertical A–Z index bar down the right side of the Artists, Albums and
Tracks library views (and any alphabetically-sortable list). Tapping a letter
jumps the list to the first item in that letter's bucket.

Each view is wired by passing a `loadLetterIndex` callback to `ItemsListing`,
backed by a per-type server command (`music/<type>/library_items/letter_index`):
`getLibraryArtistsLetterIndex`, `getLibraryAlbumsLetterIndex`,
`getLibraryTracksLetterIndex`.

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

> **CONTRACT (as implemented):**
> Offsets are **always computed in ascending order**, regardless of the
> `order_by` direction. Each bucket's `offset` is the **0-based index of the
> bucket's first item in the ascending sort** (implemented server-side as
> `MIN(ROW_NUMBER() OVER (ORDER BY sort_key ASC) - 1)` per bucket). The `total`
> item count is returned alongside. **The frontend handles reversal** for
> `_desc` sorts: the displayed top row of a bucket in descending order is
> `total - asc_offset_of_next_bucket`. This keeps the offsets in one canonical
> orientation and uses the exact same collation as the list query, so they line
> up with real row positions.

**Response:** buckets with their ascending offsets, plus the total count.
Example for either `order_by=sort_name` or `sort_name_desc` (offsets are the
same ascending values; the frontend reverses for `_desc`):

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

To get a bucket's first **displayed** row index, the frontend computes:
`order_by` ascending → `offset`; descending → `total - nextBucketAscOffset`
(where `nextBucketAscOffset` is the ascending offset of the next bucket, or
`total` for the last bucket).

**Server-side rules:**

- Bucket by the **same field used for sorting** (`sort_name` when
  `order_by=sort_name`, else `name`) so the index lines up with row positions.
- **Use the exact collation the library list query uses** — this is the
  overriding constraint, because offsets must be real row positions. MA's
  library listing sorts by a **binary comparison over a normalized ASCII key**
  (lowercased, diacritics folded via `unidecode`, non-alphanumerics removed) —
  **not** `localeCompare`. The index therefore folds diacritics (e.g. "Ä" → "A"
  bucket) and is not locale/numeric-aware, matching the list. The frontend must
  **not** re-sort the list with `localeCompare` and expect offsets to match.
- Anything not starting A–Z collapses into a single `#` bucket (top for
  ascending, bottom for descending).
- Only include letters that actually have items (so the bar can grey-out / skip
  empties). Returning all 26 with the offset of the next non-empty bucket is an
  acceptable alternative — see "Empty letters" below.
- Offsets are always ascending (see CONTRACT above); the frontend reverses for
  `_desc` sorts. The server does not need to special-case `_desc`.

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

The server returns ascending offsets; the frontend builds a per-letter target
**display index** (`labelTargets`) — ascending → `offset`, descending →
`total - nextBucketAscOffset`. The bar shows the **full A–Z** (plus `#` when
present) in display order, with empty letters dimmed but still clickable. Fetch
the index whenever `isAlphaSort`, the filters, or `sortBy` change (the same
signature that triggers a full `loadData`). Cache per sort+filter signature to
avoid refetching on every scroll.

### 3. Jump-to-letter behaviour

On tapping a letter, resolve it to the nearest **available** letter (scan
forward/down the bar to the next non-empty letter; if none, back up to the last
non-empty one), then jump to that letter's target display index `D`:

1. **Ensure the target row is loaded.** Paging is incremental, so loop
   `loadNextPage` until `pagedItems.length > D` (or `allItemsReceived`).
2. **Scroll to the row — by measurement, not estimate.** The list is virtualized
   with *measured* (not fixed) row heights, so `index * 70` drifts further down
   the list. Instead, tag every rendered row with `data-listing-item="index"`
   and home in: estimate a scroll position, let the virtualizer render, measure
   the real row height from rendered rows, re-estimate, and once the target row
   is in the DOM, animate `.content-section` so the measured row sits exactly at
   the top. Panel/compact modes render every item, so the target is measured
   directly. The eased `scrollElement(contentSection, …)` helper does the final
   animation.

### 4. The bar component

New presentational child, e.g. `src/components/AlphabetIndexBar.vue`:

- Props: `letters` (`{ label, available }[]` in display order, built by parent).
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
2. Build buckets client-side from `sort_name ?? name` of `pagedItems`. The list
   already arrives in the server's order, so bucket purely by the leading
   character of each item **without re-sorting** — do not apply `localeCompare`,
   as that would diverge from the server's normalized-ASCII order and misplace
   the jumps. Fold the leading char (uppercase, treat non-A–Z as `#`) to match
   the server's diacritic folding as closely as the client can.
3. Jump by index as above.

**Trade-off:** for large libraries (thousands of items) this is many sequential
50-item requests up front. Acceptable for small/medium libraries; the
letter-index endpoint is the scalable answer. The two can share all UI/scroll
code — only the bucket source differs, so starting with the fallback and
swapping in the endpoint later is low-risk.

---

## Open questions / decisions

1. ~~**Descending from server or client?**~~ **RESOLVED** — server returns
   always-ascending offsets + `total`; the **frontend** reverses for `_desc`
   (display index = `total - nextBucketAscOffset`).
2. ~~**Empty letters:**~~ **RESOLVED** — the bar shows the full A–Z (and `#`
   when present); empty letters are dimmed but clickable and snap to the nearest
   available letter (forward, else back to the last available).
3. **`#` bucket** for non-alpha leading chars (numbers, symbols, accented
   characters not folded to A–Z): rendered at top (asc) / bottom (desc) when the
   server returns it.
4. ~~**Panel-mode precision:**~~ **RESOLVED** — all view modes use the same
   measure-the-rendered-row approach (`data-listing-item` + measured offset),
   which self-corrects for variable row/card heights.
5. ~~**Collation parity:**~~ **RESOLVED** — the index uses the same collation as
   the library list query: MA's binary comparison over a normalized ASCII key
   (lowercased, `unidecode` diacritic folding, non-alphanumerics removed), **not**
   `localeCompare`. Offsets are guaranteed to match real row positions. Locale/
   numeric-aware ordering would be a larger change to `library_items` sorting
   itself (not the index) and is out of scope here.

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
