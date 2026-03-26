# Phase 7: Vuetify Removal & Final Cleanup

**Branch**: `shadcn-migration`
**Prereqs**: ALL other phases complete — every file must be migrated first
**Impact**: Final — removes Vuetify entirely

## Pre-Flight Check

Before starting this phase, verify:

```bash
# No Vuetify component tags remain anywhere
grep -r '<v-' src/ --include='*.vue' | grep -v 'v-if\|v-else\|v-for\|v-show\|v-model\|v-slot\|v-bind\|v-on\|v-html\|v-text\|v-memo\|v-once\|v-pre\|v-cloak' | wc -l
# Should be 0

# No :deep() selectors remain
grep -r ':deep(' src/ --include='*.vue' | wc -l
# Should be 0

# No vuetify imports remain in app code
grep -r "from 'vuetify\|from \"vuetify" src/ --include='*.ts' --include='*.vue' | wc -l
# Should be 0 (vuetify.ts itself will be deleted)

# No --v-theme references remain
grep -r '\-\-v-theme' src/ --include='*.vue' --include='*.css' --include='*.scss' --include='*.ts' | wc -l
# Should be 0
```

## Tasks

### 7a: Remove Vuetify Plugin

1. Delete `src/plugins/vuetify.ts`
2. Remove Vuetify import from `src/plugins/index.ts` (or wherever plugins are registered)
3. Remove `app.use(vuetify)` from main app setup
4. Remove `v-app` wrapper from root component (App.vue) — replace with plain `<div>`

### 7b: Remove Vuetify Packages

```bash
yarn remove vuetify @mdi/font material-design-icons-iconfont
```

Keep `@mdi/js` if the Icon bridge still uses it for unmapped icons. Otherwise remove it too.

### 7c: Clean Up Styles

1. Delete `src/styles/settings.scss` (Vuetify variable overrides)
2. Remove from `src/styles/style.css`:
   - Any `--v-theme-*` variable references
   - Any Vuetify-specific color mappings
3. Remove from `src/styles/global.css`:
   - Any Vuetify class overrides (`.v-*` selectors)
4. Remove `"vuetify/styles"` import from any file

### 7d: Clean Up Types

1. Remove `declare module "vuetify/lib/util/colors"` from `src/vite-env.d.ts`
2. Remove any Vuetify type imports

### 7e: Clean Up Icon Fonts

Remove CSS imports:
- `@mdi/font/css/materialdesignicons.css`
- `material-design-icons-iconfont/dist/material-design-icons.css`

These are large CSS files that add to initial load time.

### 7f: Update Build Configuration

1. Check `vite.config.ts` for any Vuetify-specific plugins or manual chunk configuration
2. Remove Vuetify from manual chunks in build config
3. Check for any Vuetify-related PostCSS or SASS configuration

### 7g: Final Verification

```bash
yarn build    # Must succeed with zero errors
yarn lint     # Must pass
yarn test:run # Must pass
```

Then manually verify:
- [ ] App loads and connects
- [ ] Login flow works
- [ ] Music playback works (play, pause, seek, volume, skip)
- [ ] Player fullscreen works
- [ ] Settings pages work
- [ ] Both light and dark themes work
- [ ] Mobile and desktop layouts work
- [ ] Bundle size is smaller than before (check build output)

### 7h: Performance Measurement

Run the same profiling methodology from the original investigation:
1. Open app with `?perf` query string
2. Play music
3. Record 5-second performance profile
4. Compare "Recalculate Style" percentage against the pre-migration baseline
5. Document the improvement

Expected: "Recalculate Style" should drop significantly since all 134 `:deep()` selectors are gone.
