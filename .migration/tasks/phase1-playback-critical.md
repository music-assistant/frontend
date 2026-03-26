# Phase 1: Playback-Critical Path

**Branch**: `shadcn-migration`
**Prereqs**: Phase 0 complete
**Impact**: Highest — these components are always visible and animating during playback

## Why This Phase Matters

These components are rendered continuously during music playback. Their `:deep()` selectors and Vuetify internals directly contribute to the "Recalculate Style" CPU cost measured at 33.6%+ on every animation frame.

## Task List

### 1a: `src/layouts/default/PlayerOSD/Player.vue`
- **Vuetify used**: v-footer, v-btn, v-icon
- **`:deep()` count**: 3
- **Replace**: v-btn → Button, v-icon → lucide icons
- **Watch out for**: This is the main player bar visible at all times. The footer wrapper may need to stay as a plain `<footer>` with equivalent positioning CSS.

### 1b: `src/components/VolumeControl.vue`
- **Vuetify used**: v-slider, v-list-item, v-icon, v-divider
- **`:deep()` count**: 4
- **Replace**: v-slider → Slider from ui/slider or custom range input, v-list-item → Item, v-divider → Separator, v-icon → lucide
- **Watch out for**: Volume slider needs smooth dragging behavior. Test with actual audio playing.

### 1c: `src/components/navigation/BottomNavigation.vue`
- **Vuetify used**: v-bottom-navigation, v-btn, v-icon
- **`:deep()` count**: 0
- **Replace**: Build custom `<nav>` with `fixed bottom-0 w-full` and flex layout for nav items
- **Watch out for**: Active state styling, safe-area-inset for iOS

### 1d: `src/components/navigation/AppSidebar.vue`
- **Vuetify used**: v-icon (through sidebar)
- **`:deep()` count**: 8
- **Replace**: Already uses shadcn Sidebar. Focus on eliminating the 8 `:deep()` selectors.
- **Watch out for**: Sidebar collapse/expand state, mobile drawer behavior

### 1e: `src/layouts/default/Footer.vue`
- **Vuetify used**: v-footer, v-bottom-navigation
- **`:deep()` count**: 0
- **Replace**: v-footer → `<footer>` with equivalent z-index and positioning CSS
- **Watch out for**: The gradient overlay div, z-index stacking with bottom navigation

### 1f: `src/layouts/default/PlayerOSD/PlayerTrackDetails.vue`
- **Vuetify used**: v-btn, v-icon
- **`:deep()` count**: 0
- **Replace**: v-btn → Button, v-icon → lucide
- **Watch out for**: Click handler to open fullscreen player, MarqueeText integration

## Per-File Process

1. Read the file completely
2. Identify every Vuetify component tag and import
3. Replace template tags using the mapping in MIGRATION.md
4. Replace `<style scoped>` — eliminate ALL `:deep()` selectors
5. Replace Vuetify imports with shadcn-vue / lucide imports
6. Run `yarn build` — fix any type errors
7. Run `yarn lint` — fix formatting
8. Visually verify in browser (both themes)

## Verification

After all Phase 1 files are done:
- [ ] `yarn build` passes
- [ ] `yarn lint` passes
- [ ] Play music — player bar renders correctly
- [ ] Volume control works (drag slider, mute/unmute)
- [ ] Bottom navigation works on mobile viewport
- [ ] Sidebar collapses and expands
- [ ] Dark theme and light theme both look correct
- [ ] No `:deep()` selectors remain in any Phase 1 file
