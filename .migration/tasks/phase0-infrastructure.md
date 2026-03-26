# Phase 0: Infrastructure Setup

**Branch**: `shadcn-migration`
**Prereqs**: None
**Must complete before**: All other phases

## Objective

Create the missing utility components and composables that other phases depend on.

## Tasks

### 0a: Alert Component

Create `src/components/ui/alert/` to replace `v-alert` (used in 9 files).

```bash
npx shadcn-vue@latest add alert
```

If shadcn-vue doesn't have alert, create manually with these variants:
- `default` — neutral info
- `destructive` — error/danger (red)
- `warning` — warning (amber)
- `info` — informational (blue)

Pattern: match the existing `<Badge>` variant approach using CVA.

Subcomponents needed: `Alert`, `AlertTitle`, `AlertDescription`.

### 0b: useIsDark Composable

Create `src/composables/useIsDark.ts` to replace `useTheme()` from Vuetify.

Currently used in 10 files to check `theme.current.value.dark` or `theme.global.current.value.dark`.

```typescript
import { useDark } from "@vueuse/core";

export function useIsDark() {
  const isDark = useDark();
  return { isDark };
}
```

Note: `@vueuse/core` is already installed (^14.2.1).

### 0c: useBreakpoint Composable

Create `src/composables/useBreakpoint.ts` to replace `useDisplay()` from Vuetify.

Currently used in 5 files to check `mobile.value`, `mdAndUp.value`, etc.

Must match Vuetify's custom breakpoints:
- xs: 0, sm: 340, md: 540, lg: 800, xl: 1280

```typescript
import { useMediaQuery } from "@vueuse/core";
import { computed } from "vue";

export function useBreakpoint() {
  const smAndUp = useMediaQuery("(min-width: 340px)");
  const mdAndUp = useMediaQuery("(min-width: 540px)");
  const lgAndUp = useMediaQuery("(min-width: 800px)");
  const xlAndUp = useMediaQuery("(min-width: 1280px)");
  const mobile = computed(() => !mdAndUp.value);

  return { smAndUp, mdAndUp, lgAndUp, xlAndUp, mobile };
}
```

### 0d: Icon Bridge Component

Check `src/components/Icon.vue` — if it only wraps `v-icon`, update it to:
1. Accept lucide icon components directly
2. Accept MDI icon names as fallback (renders inline SVG from `@mdi/js`)
3. Accept a `size` prop (number or "sm" | "md" | "lg")

This lets files migrate to lucide icons incrementally without a big-bang icon swap.

### 0e: Tailwind Breakpoint Configuration

Add custom breakpoints to `src/styles/style.css` matching Vuetify's thresholds:

```css
@theme {
  --breakpoint-sm: 340px;
  --breakpoint-md: 540px;
  --breakpoint-lg: 800px;
  --breakpoint-xl: 1280px;
}
```

This ensures `sm:`, `md:`, `lg:`, `xl:` Tailwind classes match the existing responsive behavior.

## Verification

```bash
yarn build
yarn lint
```

All existing functionality must still work — these are additive changes only.
