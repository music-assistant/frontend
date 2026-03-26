# Phase 3: Browse & Home Views

**Branch**: `shadcn-migration`
**Prereqs**: Phase 0 complete. Phase 2 recommended (ListItem, PanelviewItem).
**Impact**: Medium — main content views, not animation-critical

## Task List

### 3a: `src/views/HomeView.vue`
- **Vuetify used**: v-btn, v-icon, v-progress-circular, v-alert
- **`:deep()` count**: 1
- **Replace**: v-progress-circular → Spinner, v-alert → Alert (from Phase 0), v-btn → Button

### 3b: `src/components/ItemsListing.vue`
- **Vuetify used**: v-btn, v-text-field, v-snackbar, v-divider, v-alert, v-row, v-col
- **`:deep()` count**: 0
- **Replace**: v-text-field → Input, v-snackbar → toast() from sonner, v-row/v-col → flex/grid
- **Watch out for**: Search input with debounce, sort controls, infinite scroll

### 3c: `src/components/Toolbar.vue`
- **Vuetify used**: v-toolbar, v-btn, v-list-item, v-icon
- **`:deep()` count**: 0
- **Replace**: v-toolbar → `<div class="flex items-center h-14 px-4 border-b">`

### 3d: `src/components/InfoHeader.vue`
- **Vuetify used**: v-dialog, v-btn, v-icon, v-chip
- **`:deep()` count**: 2
- **Replace**: v-dialog → Dialog, v-chip → Badge

### 3e: `src/components/WidgetRow.vue`
- **Vuetify used**: v-btn, v-icon, v-chip, v-alert
- **`:deep()` count**: 0
- **Replace**: Standard component swaps

### 3f: `src/views/Search.vue`
- **Vuetify used**: v-text-field, v-chip
- **`:deep()` count**: 0
- **Replace**: v-text-field → Input, v-chip → Badge

### 3g: `src/views/BrowseView.vue`
- **Vuetify used**: v-btn, v-icon
- **`:deep()` count**: 0

### 3h: `src/views/GenreDetails.vue`
- **Vuetify used**: v-icon, v-chip
- **`:deep()` count**: 0

### 3i: `src/components/MediaItemThumb.vue`
- **Vuetify used**: v-img (if used), useTheme
- **Replace**: v-img → native `<img>` with loading/error states, useTheme → useIsDark

### 3j: `src/components/MediaItemImages.vue`
- **Vuetify used**: v-dialog, v-img, v-icon, v-row, v-col, v-btn
- **`:deep()` count**: 1

### 3k: `src/components/QualityDetailsBtn.vue`
- **Vuetify used**: v-btn, v-icon, v-chip
- **`:deep()` count**: 0

### 3l: `src/components/PlayerCard.vue`
- **Vuetify used**: v-icon, v-chip, v-list-item, v-progress-circular, v-img
- **`:deep()` count**: 0

### 3m: `src/components/PlayersWidgetRow.vue`
- **Vuetify used**: v-btn, v-icon
- **`:deep()` count**: 2

### 3n: `src/components/PlayerFilters.vue`
- **Vuetify used**: v-btn, v-icon, v-list-item
- **`:deep()` count**: 3

## Verification

- [ ] `yarn build` passes
- [ ] Home view loads with widgets
- [ ] Search works with results
- [ ] Browse view with grid/list toggle
- [ ] Album/artist/track detail pages render
- [ ] No `:deep()` selectors remain in any Phase 3 file
