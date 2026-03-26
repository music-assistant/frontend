# Phase 4: Login & Auth

**Branch**: `shadcn-migration`
**Prereqs**: Phase 0 complete
**Impact**: Medium — self-contained view, but has the most `:deep()` selectors (25)
**Can run in parallel with**: Phases 1-3 (no shared components)

## Task List

### 4a: `src/views/Login.vue`
- **Vuetify used**: v-app, v-main, v-container, v-row, v-col, v-card (+ title/text/actions), v-progress-circular, v-btn, v-text-field, v-chip, v-alert, v-dialog, v-icon, v-select, v-img, v-divider
- **`:deep()` count**: **25** (highest in codebase)
- **This is the file where the 33.6% Recalculate Style was measured**

#### Key `:deep()` selectors to eliminate:
```css
:deep(.v-field) { border-radius }
:deep(.v-field--variant-outlined .v-field__outline__start) { border-radius }
:deep(.v-field--variant-outlined .v-field__outline__end) { border-radius }
:deep(.v-card) { color }
:deep(.v-card-title), :deep(.v-card-text), :deep(.text-h4), :deep(.text-h6), :deep(.text-body-2) { color }
:deep(.v-field__input) { color }
:deep(.v-label) { color }
:deep(.v-field__field) { background }
:deep(.v-field--focused .v-field__field) { background }
:deep(.v-btn.v-btn--size-x-large) { font-size, letter-spacing, height }
/* ... and more */
```

All of these become unnecessary with shadcn — you style the components directly.

#### Replacement plan:
- v-app + v-main + v-container → `<div class="min-h-screen flex items-center justify-center">`
- v-card → Card
- v-progress-circular → Spinner
- v-text-field → Input (with Field wrapper for labels)
- v-select → Select
- v-dialog → Dialog
- v-btn → Button
- v-alert → Alert
- v-chip → Badge
- v-divider → Separator
- Custom CSS variables (--fg, --bg, --input-bg, etc.) → Tailwind theme classes

#### Watch out for:
- Login flow has multiple steps (auto-connect, select-mode, login, connecting, reconnecting, error)
- OAuth flow with external redirects
- Server discovery with manual URL input
- Ingress mode detection
- The file is very large (~500 lines template, ~1300 lines script) — work carefully

## Verification

- [ ] `yarn build` passes
- [ ] Login page renders correctly in dark and light themes
- [ ] Auto-connect flow works
- [ ] Manual server URL entry works
- [ ] Username/password login works
- [ ] OAuth login redirect works
- [ ] Reconnecting spinner displays
- [ ] Error states display correctly
- [ ] All 25 `:deep()` selectors are gone
- [ ] Measure "Recalculate Style" on reconnect screen — should be dramatically lower
