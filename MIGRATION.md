# Vuetify to shadcn-vue Migration Guide

## Why

Vuetify's opaque component model forces the use of `:deep()` CSS selectors to customize internals. The browser must re-evaluate **all** `:deep()` selectors on every animation frame, causing excessive "Recalculate Style" CPU cost (measured at 33.6% for a single spinner). With 134 `:deep()` selectors across 30 files, this is a systemic performance tax on the entire app.

shadcn-vue components are transparent — you own the markup and apply Tailwind utility classes directly. No `:deep()` needed. Style recalculation becomes trivial.

## Current State

- **Vuetify**: 704+ component instances across 66 files, 134 `:deep()` selectors across 30 files
- **shadcn-vue**: 43 component directories already exist in `src/components/ui/`, 30 actively used
- **Tailwind CSS v4**: Already configured with CSS variables and theme integration
- **reka-ui**: Already installed (headless primitives underlying shadcn-vue)
- **Icons**: Currently MDI (Material Design Icons). shadcn config uses lucide. Both available.

## Rules for Migration

### DO

- Migrate one component at a time — each file is a self-contained unit of work
- Run `yarn build` after every file to catch type errors immediately
- Run `yarn lint` to auto-fix formatting
- Preserve all existing functionality, props, events, and slots
- Keep the same component file name and location (only template/style changes)
- Use existing `src/components/ui/` shadcn components wherever possible
- Use the `cn()` utility from `@/lib/utils` for conditional classes
- Use Tailwind CSS variables (defined in `src/styles/style.css`) for theming
- Preserve all `data-testid` or `aria-*` attributes
- Preserve all i18n `$t()` calls exactly as-is
- Keep component script logic unchanged — only template and style sections change

### DO NOT

- Do NOT change multiple files in a single commit unless they are tightly coupled
- Do NOT change any component logic, computed properties, watchers, or event handlers
- Do NOT change the API plugin, store, composables, or helpers
- Do NOT remove Vuetify from `package.json` until every file is migrated
- Do NOT change routing, navigation guards, or app initialization
- Do NOT introduce new dependencies without discussion
- Do NOT migrate and refactor simultaneously — migration is a 1:1 swap only

### Verification Checklist (per file)

```
[ ] yarn build succeeds (no type errors)
[ ] yarn lint passes
[ ] Visual appearance matches original (check both light and dark theme)
[ ] All interactive behavior works (clicks, hover, focus, keyboard)
[ ] All `:deep()` selectors in the file are eliminated
[ ] No Vuetify component tags remain in the file (v-btn, v-card, etc.)
[ ] No `vuetify` imports remain in the file (useTheme, useDisplay, etc.)
```

## Component Mapping Reference

### Layout & Structure

| Vuetify | shadcn-vue / Tailwind | Notes |
|---------|----------------------|-------|
| `v-app` | `<div class="min-h-screen bg-background text-foreground">` | App root wrapper |
| `v-main` | `<main>` | Main content area |
| `v-container` | `<div class="container mx-auto px-4">` | Centered container |
| `v-row` | `<div class="flex flex-wrap gap-4">` or `grid` | Flexbox/grid row |
| `v-col` | `<div class="flex-1">` with breakpoint classes | Grid column |
| `v-spacer` | `<div class="flex-1">` or `ml-auto` | Flex spacer |
| `v-divider` | `<Separator />` from `@/components/ui/separator` | Exists |
| `v-sheet` | `<div>` with Tailwind bg/padding | Simple surface |
| `v-responsive` | Native CSS `aspect-ratio` | |

### Navigation & Chrome

| Vuetify | shadcn-vue / Tailwind | Notes |
|---------|----------------------|-------|
| `v-toolbar` | `<div class="flex items-center h-14 px-4 border-b">` | Manual layout |
| `v-app-bar` | Same as toolbar, `sticky top-0 z-50` | |
| `v-navigation-drawer` | `<Sidebar>` from `@/components/ui/sidebar` | Exists, already used |
| `v-bottom-navigation` | Custom `<nav>` with `fixed bottom-0` | Manual build |
| `v-footer` | `<footer>` with Tailwind | |
| `v-tabs` / `v-tab` | `<Tabs>` from `@/components/ui/tabs` | Exists |

### Data Display

| Vuetify | shadcn-vue / Tailwind | Notes |
|---------|----------------------|-------|
| `v-card` | `<Card>` from `@/components/ui/card` | Exists |
| `v-card-title` | `<CardTitle>` | Exists |
| `v-card-text` | `<CardContent>` | Exists |
| `v-card-actions` | `<CardFooter>` | Exists |
| `v-card-subtitle` | `<CardDescription>` | Exists |
| `v-list` | `<div role="list">` or use `<Command>` for searchable | |
| `v-list-item` | `<Item>` from `@/components/ui/item` | Exists |
| `v-list-subheader` | `<div class="text-sm font-medium text-muted-foreground px-4 py-2">` | |
| `v-chip` | `<Badge>` from `@/components/ui/badge` | Exists |
| `v-badge` | `<Badge>` with absolute positioning | |
| `v-avatar` | `<Avatar>` from `@/components/ui/avatar` | Exists |
| `v-img` | `<img>` with Tailwind classes + loading state | |
| `v-icon` | `<Icon>` — see Icon Migration section below | |
| `v-tooltip` | `<Tooltip>` from `@/components/ui/tooltip` | Exists |
| `v-progress-circular` | `<Spinner>` from `@/components/ui/spinner` | Exists |
| `v-progress-linear` | `<Progress>` from `@/components/ui/progress` | Exists |
| `v-virtual-scroll` | `@tanstack/vue-virtual` or native CSS | Evaluate |
| `v-infinite-scroll` | IntersectionObserver pattern | Manual |
| `v-timeline` | Custom Tailwind layout | Manual build |
| `v-expansion-panels` | `<Accordion>` from `@/components/ui/accordion` | Exists |
| `v-data-table` | `<Table>` from `@/components/ui/table` | Exists, uses @tanstack/vue-table |
| `v-breadcrumbs` | `<Breadcrumb>` from `@/components/ui/breadcrumb` | Exists |
| `v-skeleton-loader` | `<Skeleton>` from `@/components/ui/skeleton` | Exists |

### Actions & Inputs

| Vuetify | shadcn-vue / Tailwind | Notes |
|---------|----------------------|-------|
| `v-btn` | `<Button>` from `@/components/ui/button` | Exists |
| `v-text-field` | `<Input>` from `@/components/ui/input` | Exists |
| `v-textarea` | `<Textarea>` from `@/components/ui/textarea` | Exists |
| `v-select` | `<Select>` from `@/components/ui/select` | Exists |
| `v-autocomplete` | `<Command>` with `<CommandInput>` | Exists |
| `v-combobox` | `<Command>` + `<Popover>` pattern | |
| `v-checkbox` | `<Checkbox>` from `@/components/ui/checkbox` | Exists |
| `v-switch` | `<Switch>` from `@/components/ui/switch` | Exists |
| `v-radio-group` | `<RadioGroup>` from `@/components/ui/radio-group` | Exists |
| `v-slider` | `<Slider>` from `@/components/ui/slider` | Exists |
| `v-number-field` | `<NumberField>` from `@/components/ui/number-field` | Exists |
| `v-form` | `<form>` with `@tanstack/vue-form` | Already available |

### Overlays & Feedback

| Vuetify | shadcn-vue / Tailwind | Notes |
|---------|----------------------|-------|
| `v-dialog` | `<Dialog>` from `@/components/ui/dialog` | Exists |
| `v-menu` | `<DropdownMenu>` from `@/components/ui/dropdown-menu` | Exists |
| `v-overlay` | `<Dialog>` or custom `fixed inset-0` div | |
| `v-snackbar` | `<Sonner>` / `toast()` from `@/components/ui/sonner` | Exists |
| `v-alert` | `<Alert>` — needs creation, or use `<Card>` variant | Create |

### Vuetify Composable Replacements

| Vuetify | Replacement | Notes |
|---------|------------|-------|
| `useTheme()` | Read CSS variable or use `useColorMode()` from `@vueuse/core` | 10 files |
| `useDisplay()` | `useMediaQuery()` from `@vueuse/core` or Tailwind breakpoints | 5 files |
| `$vuetify.theme.current.dark` | Check `<html>` class or CSS variable | Template refs |
| `v-ripple` directive | Remove (shadcn doesn't use ripple) or CSS-only ripple | 1 file |

## Icon Migration

The app currently uses MDI icons via `<v-icon>` (184 instances, 37 files). The shadcn config specifies lucide as the icon library.

**Strategy**: Create a bridge `<Icon>` component that accepts both MDI and lucide icon names during the transition period.

The app already has `src/components/Icon.vue` — check if it can serve as this bridge. If not, create one that:

```vue
<template>
  <component :is="resolvedIcon" :size="size" :class="cn('shrink-0', $attrs.class)" />
</template>
```

Maps `mdi-*` names to lucide equivalents. Unmapped icons fall back to MDI via `@mdi/js` + inline SVG.

**Common icon mappings needed** (audit actual usage for full list):

| MDI | Lucide |
|-----|--------|
| mdi-play | Play |
| mdi-pause | Pause |
| mdi-skip-next | SkipForward |
| mdi-skip-previous | SkipBack |
| mdi-volume-high | Volume2 |
| mdi-volume-off | VolumeX |
| mdi-close | X |
| mdi-menu | Menu |
| mdi-magnify | Search |
| mdi-cog | Settings |
| mdi-heart | Heart |
| mdi-shuffle | Shuffle |
| mdi-repeat | Repeat |
| mdi-chevron-left | ChevronLeft |
| mdi-chevron-right | ChevronRight |
| mdi-chevron-down | ChevronDown |
| mdi-check | Check |
| mdi-plus | Plus |
| mdi-delete | Trash2 |
| mdi-pencil | Pencil |
| mdi-information | Info |
| mdi-alert | AlertTriangle |

## Migration Phases

### Phase 0: Infrastructure (do first)
Create missing shadcn components and utilities needed by the migration.

**Files to create/modify:**
- [ ] `src/components/ui/alert/` — Alert component (maps to v-alert)
- [ ] `src/components/Icon.vue` — Icon bridge component (if not already suitable)
- [ ] `src/composables/useIsDark.ts` — Replace `useTheme()` usage
- [ ] `src/composables/useBreakpoint.ts` — Replace `useDisplay()` usage

### Phase 1: Playback-Critical Path (highest CPU impact)
These components are **always visible and animating** during music playback.

| Priority | File | Vuetify Components | `:deep()` count |
|----------|------|--------------------|-----------------|
| 1a | `src/layouts/default/PlayerOSD/Player.vue` | v-footer, v-btn, v-icon | 3 |
| 1b | `src/components/VolumeControl.vue` | v-slider, v-list-item, v-icon, v-divider | 4 |
| 1c | `src/components/navigation/BottomNavigation.vue` | v-bottom-navigation, v-btn, v-icon | 0 |
| 1d | `src/components/navigation/AppSidebar.vue` | v-icon (via Sidebar) | 8 |
| 1e | `src/layouts/default/Footer.vue` | v-footer, v-bottom-navigation | 0 |
| 1f | `src/layouts/default/PlayerOSD/PlayerTrackDetails.vue` | v-btn, v-icon | 0 |

### Phase 2: Player Fullscreen & Context Menu
Visible during active interaction with the player.

| Priority | File | Vuetify Components | `:deep()` count |
|----------|------|--------------------|-----------------|
| 2a | `src/layouts/default/PlayerOSD/PlayerFullscreen.vue` | v-dialog, v-btn, v-icon, v-list-item, v-chip, v-img | 13 |
| 2b | `src/layouts/default/ItemContextMenu.vue` | v-menu, v-list, v-list-item, v-divider, v-icon | 6 |
| 2c | `src/layouts/default/PlayerSelect.vue` | v-menu, v-list, v-btn, v-icon | 7 |
| 2d | `src/components/ListItem.vue` | v-list-item, v-icon | 4 |
| 2e | `src/components/ListviewItem.vue` | v-btn, v-icon, v-chip | 0 |
| 2f | `src/components/PanelviewItem.vue` | v-btn, v-icon | 1 |
| 2g | `src/components/PanelviewItemCompact.vue` | v-list-item, v-btn, v-icon | 0 |

### Phase 3: Browse & Home Views
Main content views.

| Priority | File | Vuetify Components | `:deep()` count |
|----------|------|--------------------|-----------------|
| 3a | `src/views/HomeView.vue` | v-btn, v-icon, v-progress-circular, v-alert | 1 |
| 3b | `src/components/ItemsListing.vue` | v-btn, v-text-field, v-snackbar, v-divider, v-alert | 0 |
| 3c | `src/components/Toolbar.vue` | v-toolbar, v-btn, v-list-item, v-icon | 0 |
| 3d | `src/components/InfoHeader.vue` | v-dialog, v-btn, v-icon, v-chip | 2 |
| 3e | `src/components/WidgetRow.vue` | v-btn, v-icon, v-chip, v-alert | 0 |
| 3f | `src/views/Search.vue` | v-text-field, v-chip | 0 |
| 3g | `src/views/BrowseView.vue` | v-btn, v-icon | 0 |
| 3h | `src/views/GenreDetails.vue` | v-icon, v-chip | 0 |

### Phase 4: Login & Auth
Self-contained view with the most `:deep()` selectors.

| Priority | File | Vuetify Components | `:deep()` count |
|----------|------|--------------------|-----------------|
| 4a | `src/views/Login.vue` | v-progress-circular, v-card, v-btn, v-text-field, v-chip, v-alert, v-dialog, v-icon, v-select | **25** |

### Phase 5: Settings Views
Lower priority — not visible during playback.

| File | `:deep()` count |
|------|-----------------|
| `src/views/settings/Settings.vue` | 11 |
| `src/views/settings/SystemConfig.vue` | 7 |
| `src/views/settings/Players.vue` | 6 |
| `src/views/settings/EditConfig.vue` | 5 |
| `src/views/settings/EditPlayer.vue` | 3 |
| `src/views/settings/EditProvider.vue` | 2 |
| `src/views/settings/EditCoreConfig.vue` | 0 |
| `src/views/settings/Providers.vue` | 2 |
| `src/views/settings/AddProviderDetails.vue` | 2 |
| `src/views/settings/AddPlayerGroup.vue` | 0 |
| `src/views/settings/BackgroundTasks.vue` | 1 |
| `src/views/settings/RemoteAccessSettings.vue` | 0 |
| `src/views/settings/ConfigEntryField.vue` | 0 |
| `src/views/settings/PlayerOptionField.vue` | 0 |
| `src/views/settings/EditPlayerDsp.vue` | 0 |
| `src/views/settings/About.vue` | 0 |

### Phase 6: Party Mode & Misc
| File | `:deep()` count |
|------|-----------------|
| `src/views/PartyGuestView.vue` | 0 |
| `src/views/PartyDashboardView.vue` | 6 |
| `src/components/party/PartyPlayerBadge.vue` | 0 |
| `src/components/party/PartyTrackCard.vue` | 1 |
| `src/components/party/PartyQueueItem.vue` | 1 |
| `src/components/dsp/DSPPipeline.vue` | 0 |
| `src/components/dsp/DSPParametricEQ.vue` | 0 |
| `src/components/dsp/DSPSlider.vue` | 0 |

### Phase 7: Cleanup
- [ ] Remove `vuetify` from `package.json`
- [ ] Remove `src/plugins/vuetify.ts`
- [ ] Remove `@mdi/font` and `material-design-icons-iconfont` packages
- [ ] Remove `vuetify/styles` import
- [ ] Remove all Vuetify CSS variable references (`--v-theme-*`) from `src/styles/`
- [ ] Remove `v-app` wrapper from root
- [ ] Clean up any remaining `$vuetify` template references
- [ ] Update `src/styles/style.css` to remove Vuetify color variable mappings
- [ ] Update `src/styles/settings.scss` (Vuetify overrides — delete entirely)
- [ ] Final `yarn build && yarn lint && yarn test:run`

## How to Migrate a Single File

### Example: Migrating a simple button usage

**Before** (Vuetify):
```vue
<template>
  <v-btn color="primary" variant="outlined" size="small" @click="doThing">
    <v-icon start>mdi-plus</v-icon>
    Add Item
  </v-btn>
</template>

<style scoped>
:deep(.v-btn__content) {
  font-weight: 600;
}
</style>
```

**After** (shadcn-vue):
```vue
<template>
  <Button variant="outline" size="sm" @click="doThing">
    <Plus class="mr-2 h-4 w-4" />
    Add Item
  </Button>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-vue-next";
</script>
```

Note: the `:deep()` style is gone — you style the button content directly with Tailwind classes on the `<Button>` itself.

### Example: Migrating a dialog

**Before**:
```vue
<v-dialog v-model="showDialog" max-width="500">
  <v-card>
    <v-card-title>Title</v-card-title>
    <v-card-text>Content here</v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn @click="showDialog = false">Cancel</v-btn>
      <v-btn color="primary" @click="confirm">OK</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

**After**:
```vue
<Dialog v-model:open="showDialog">
  <DialogContent class="max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <p>Content here</p>
    <DialogFooter>
      <Button variant="outline" @click="showDialog = false">Cancel</Button>
      <Button @click="confirm">OK</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Example: Migrating a list

**Before**:
```vue
<v-list>
  <v-list-item v-for="item in items" :key="item.id" @click="select(item)">
    <template #prepend>
      <v-icon>{{ item.icon }}</v-icon>
    </template>
    <v-list-item-title>{{ item.name }}</v-list-item-title>
    <v-list-item-subtitle>{{ item.description }}</v-list-item-subtitle>
  </v-list-item>
</v-list>
```

**After**:
```vue
<div role="list" class="flex flex-col gap-1">
  <Item v-for="item in items" :key="item.id" @click="select(item)">
    <ItemMedia>
      <Icon :name="item.icon" class="h-5 w-5" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ item.name }}</ItemTitle>
      <ItemDescription>{{ item.description }}</ItemDescription>
    </ItemContent>
  </Item>
</div>
```

## Vuetify Theme → Tailwind CSS Variables

The app already has dual theme support in `src/styles/style.css`. During migration, replace Vuetify theme references:

| Vuetify reference | Tailwind equivalent |
|-------------------|-------------------|
| `rgb(var(--v-theme-primary))` | `hsl(var(--primary))` |
| `rgb(var(--v-theme-background))` | `hsl(var(--background))` |
| `rgb(var(--v-theme-surface))` | `hsl(var(--card))` |
| `rgb(var(--v-theme-on-surface))` | `hsl(var(--foreground))` |
| `rgb(var(--v-theme-fg))` | `hsl(var(--foreground))` |
| `rgb(var(--v-theme-panel))` | `hsl(var(--card))` |
| `rgb(var(--v-theme-overlay))` | `hsl(var(--muted))` |
| `$vuetify.theme.current.dark` | `document.documentElement.classList.contains('dark')` |

## Breakpoint Migration

| Vuetify breakpoint | px value | Tailwind equivalent |
|-------------------|----------|-------------------|
| xs | 0 | (default) |
| sm | 340px | `sm:` (customize in Tailwind config if needed) |
| md | 540px | `md:` (customize — Tailwind default is 768px) |
| lg | 800px | `lg:` (customize — Tailwind default is 1024px) |
| xl | 1280px | `xl:` |

**Important**: The Vuetify breakpoints are non-standard. You'll need to customize Tailwind's breakpoints in `src/styles/style.css` or create a `useBreakpoint()` composable that matches the current thresholds.

## Testing Strategy

### Automated
- `yarn build` — catches all TypeScript and template compilation errors
- `yarn lint` — catches formatting and linting issues
- `yarn test:run` — runs existing unit tests (currently minimal)

### Manual (required per phase)
- [ ] Light theme + dark theme visual check
- [ ] Mobile layout (< 540px) check
- [ ] Desktop layout check
- [ ] Keyboard navigation (Tab, Enter, Escape on dialogs/menus)
- [ ] Music playback: play/pause/seek/volume all functional
- [ ] Player fullscreen open/close with animation
- [ ] Context menu on tracks/albums/artists
- [ ] Settings pages load and save correctly

### Recommended: Add visual regression baseline
Before starting migration, capture screenshots of key views to compare against:
1. Home view (desktop + mobile)
2. Player bar (playing state)
3. Player fullscreen
4. Settings page
5. Login / reconnect screen
6. Browse view with items
