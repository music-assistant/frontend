# Phase 2: Player Interaction Components

**Branch**: `shadcn-migration`
**Prereqs**: Phase 0 complete. Phase 1 recommended but not blocking.
**Impact**: High — visible during active player interaction (fullscreen, context menus, lists)

## Task List

### 2a: `src/layouts/default/PlayerOSD/PlayerFullscreen.vue`
- **Vuetify used**: v-dialog, v-btn, v-icon, v-list-item, v-chip, v-img, v-badge
- **`:deep()` count**: 13 (second highest in codebase)
- **Replace**: v-dialog → Dialog (or Sheet for bottom-up mobile), v-chip → Badge, v-img → native img, v-list-item → Item
- **Watch out for**:
  - Dialog open/close animation (currently slide-up). Use `<Sheet>` with `side="bottom"` for mobile.
  - `@after-leave` callback for lazy unmount — Dialog supports this via `onOpenChange`
  - `useDisplay()` — replace with `useBreakpoint()` from Phase 0
  - Queue list with virtual scrolling
  - Color palette extraction for background gradient
  - Lyrics viewer panel switching (tabs)
  - This is the largest single file in the migration

### 2b: `src/layouts/default/ItemContextMenu.vue`
- **Vuetify used**: v-menu, v-list, v-list-item, v-divider, v-icon
- **`:deep()` count**: 6
- **Replace**: v-menu → DropdownMenu, v-list → div, v-list-item → DropdownMenuItem, v-divider → DropdownMenuSeparator
- **Watch out for**: Dynamic menu items, nested submenus, keyboard navigation

### 2c: `src/layouts/default/PlayerSelect.vue`
- **Vuetify used**: v-menu, v-list, v-btn, v-icon, v-checkbox, v-switch
- **`:deep()` count**: 7
- **Replace**: v-menu → DropdownMenu or Popover, v-checkbox → Checkbox, v-switch → Switch
- **Watch out for**: Player grouping UI, sync group toggles

### 2d: `src/components/ListItem.vue`
- **Vuetify used**: v-list-item, v-icon
- **`:deep()` count**: 4
- **Replace**: v-list-item → Item from ui/item
- **Watch out for**: This is a base component used by many list views. Changes propagate widely. Test with browse views.

### 2e: `src/components/ListviewItem.vue`
- **Vuetify used**: v-btn, v-icon, v-chip
- **`:deep()` count**: 0
- **Replace**: v-btn → Button, v-icon → lucide, v-chip → Badge

### 2f: `src/components/PanelviewItem.vue`
- **Vuetify used**: v-btn, v-icon
- **`:deep()` count**: 1
- **Replace**: v-btn → Button, v-icon → lucide

### 2g: `src/components/PanelviewItemCompact.vue`
- **Vuetify used**: v-list-item, v-btn, v-icon
- **`:deep()` count**: 0
- **Replace**: v-list-item → Item, v-btn → Button

## Verification

- [ ] `yarn build` passes
- [ ] Open fullscreen player — animation, queue list, lyrics all work
- [ ] Right-click context menu on a track — all menu items present and functional
- [ ] Player selection dropdown works
- [ ] Browse view renders list items correctly
- [ ] Panel view renders items correctly
- [ ] No `:deep()` selectors remain in any Phase 2 file
