# Phase 5: Settings Views

**Branch**: `shadcn-migration`
**Prereqs**: Phase 0 complete
**Impact**: Low — only visible when user opens settings, not during playback
**Can run in parallel with**: Phases 1-4 (settings views are self-contained)

## Task List

Files ordered by `:deep()` count (highest impact first):

### 5a: `src/views/settings/Settings.vue`
- **`:deep()` count**: 11
- **Vuetify used**: v-list, v-list-item, v-list-subheader, v-icon, v-btn, v-chip
- **Replace**: v-list → div with role="list", v-list-item → Item, v-list-subheader → heading div

### 5b: `src/views/settings/SystemConfig.vue`
- **`:deep()` count**: 7
- **Vuetify used**: v-list-item, v-icon, v-btn

### 5c: `src/views/settings/Players.vue`
- **`:deep()` count**: 6
- **Vuetify used**: v-row, v-col, v-chip, v-icon, v-btn

### 5d: `src/views/settings/EditConfig.vue`
- **`:deep()` count**: 5
- **Vuetify used**: v-dialog, v-card, v-text-field, v-btn, v-icon, v-switch, v-expansion-panels

### 5e: `src/views/settings/EditPlayer.vue`
- **`:deep()` count**: 3
- **Vuetify used**: v-dialog, v-card, v-text-field, v-btn, v-icon, v-chip, v-switch, v-alert, v-progress-circular

### 5f: `src/views/settings/EditProvider.vue`
- **`:deep()` count**: 2
- **Vuetify used**: v-card, v-btn, v-text-field, v-alert, v-progress-circular

### 5g: `src/views/settings/Providers.vue`
- **`:deep()` count**: 2
- **Vuetify used**: v-row, v-col, v-chip, v-icon, v-btn, v-list-item

### 5h: `src/views/settings/AddProviderDetails.vue`
- **`:deep()` count**: 2
- **Vuetify used**: v-card, v-btn, v-progress-circular

### 5i: `src/views/settings/BackgroundTasks.vue`
- **`:deep()` count**: 1
- **Vuetify used**: v-row, v-col, v-icon, v-progress-circular

### 5j: `src/views/settings/ConfigEntryField.vue`
- **`:deep()` count**: 0
- **Vuetify used**: v-text-field, v-select, v-switch, v-checkbox, v-btn, v-divider, v-alert
- **Note**: This is a reusable field component — many settings views depend on it. Migrate carefully.

### 5k: `src/views/settings/PlayerOptionField.vue`
- **`:deep()` count**: 0
- **Vuetify used**: v-text-field, v-select, v-switch

### 5l: `src/views/settings/EditCoreConfig.vue`
- **`:deep()` count**: 0
- **Vuetify used**: v-icon, v-progress-circular

### 5m: `src/views/settings/AddPlayerGroup.vue`
- **`:deep()` count**: 0
- **Vuetify used**: v-card, v-text-field, v-btn, v-select, v-checkbox, v-divider

### 5n: `src/views/settings/RemoteAccessSettings.vue`
- **`:deep()` count**: 0
- **Vuetify used**: v-card, v-btn, v-chip, v-alert, v-progress-circular, v-text-field, v-icon

### 5o: `src/views/settings/EditPlayerDsp.vue`
- **`:deep()` count**: 0
- **Vuetify used**: v-btn, v-icon, v-dialog, v-expansion-panels, v-slider

### 5p: `src/views/settings/About.vue`
- **`:deep()` count**: 0
- **Vuetify used**: v-icon, v-img, v-btn

### 5q: `src/components/SettingsPlayerCard.vue`
- **`:deep()` count**: 3
- **Vuetify used**: v-card, v-icon, v-btn, v-chip, v-list-item

### 5r: `src/components/ProviderDetails.vue`
- **Vuetify used**: v-card, v-divider, v-chip, v-btn

### 5s: DSP Components (batch)
- `src/components/dsp/DSPPipeline.vue` — v-timeline, v-btn, v-icon, useTheme
- `src/components/dsp/DSPParametricEQ.vue` — v-slider, v-btn, v-icon, v-chip, v-row, v-col, useTheme
- `src/components/dsp/DSPSlider.vue` — v-slider, v-text-field

## Key Dependency: ConfigEntryField (5j)

`ConfigEntryField.vue` is used by multiple settings views. Migrate it early in this phase, then the other settings views become simpler since they won't need to handle those form controls individually.

## Verification

- [ ] `yarn build` passes
- [ ] Settings main page loads with all sections
- [ ] Can edit a player configuration and save
- [ ] Can add/remove a provider
- [ ] Can edit core configuration
- [ ] System config page loads
- [ ] Background tasks page loads
- [ ] DSP settings work (sliders, pipeline visualization)
- [ ] No `:deep()` selectors remain in any Phase 5 file
