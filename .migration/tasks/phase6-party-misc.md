# Phase 6: Party Mode & Miscellaneous

**Branch**: `shadcn-migration`
**Prereqs**: Phase 0 complete
**Impact**: Low — party mode is a separate feature, misc components are peripheral
**Can run in parallel with**: Phases 1-5

## Task List

### 6a: `src/views/PartyDashboardView.vue`
- **`:deep()` count**: 6
- **Vuetify used**: Various Vuetify components
- **Note**: Uses `useTheme()` — replace with `useIsDark()`

### 6b: `src/views/PartyGuestView.vue`
- **`:deep()` count**: 0
- **Vuetify used**: Minimal

### 6c: `src/components/party/PartyPlayerBadge.vue`
- **Vuetify used**: v-icon
- **Replace**: v-icon → lucide

### 6d: `src/components/party/PartyTrackCard.vue`
- **`:deep()` count**: 1
- **Vuetify used**: v-icon, v-chip

### 6e: `src/components/party/PartyQueueItem.vue`
- **`:deep()` count**: 1
- **Vuetify used**: v-icon

### 6f: `src/components/users/DisableUserDialog.vue`
- **Vuetify used**: v-dialog, v-card, v-btn

### 6g: `src/components/users/DeleteUserDialog.vue`
- **Vuetify used**: v-dialog, v-card, v-btn

### 6h: `src/views/UserProfile.vue`
- **Vuetify used**: Minimal (mostly uses shadcn already)

### 6i: `src/views/NotFound.vue`
- **Vuetify used**: Minimal

### 6j: `src/components/genre/` (batch)
- `GenreExclusionManager.vue` — v-divider
- `GenreAliasManager.vue` — v-divider
- `LinkAliasDialog.vue` — v-autocomplete

### 6k: `src/components/Chapters.vue`
- **Vuetify used**: v-chip, v-divider, v-list-item

### 6l: `src/components/LyricsViewer.vue`
- **Vuetify used**: Minimal (already uses ScrollArea, Spinner from shadcn)
- **Check**: May still reference Vuetify theme

### 6m: `src/components/MenuButton.vue`
- **Vuetify used**: v-btn, v-icon, v-menu, v-progress-circular

### 6n: `src/components/Button.vue`
- **Vuetify used**: v-btn, v-icon
- **`:deep()` count**: 2
- **Note**: This is a wrapper component — may be removable if all callers switch to shadcn Button directly

### 6o: `src/components/AddManualLink.vue`
- **Vuetify used**: v-dialog, v-card, v-text-field, v-btn, v-divider

### 6p: `src/components/Container.vue`
- **Vuetify used**: useTheme
- **Replace**: useTheme → useIsDark

## Verification

- [ ] `yarn build` passes
- [ ] Party dashboard loads
- [ ] Party guest view works
- [ ] User management dialogs work
- [ ] Genre management works
- [ ] Lyrics viewer works
- [ ] No `:deep()` selectors remain in any Phase 6 file
