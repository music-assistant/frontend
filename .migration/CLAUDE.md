# Migration Agent Instructions

You are working on the `shadcn-migration` branch of the Music Assistant frontend.
Your job is to migrate Vue components from Vuetify to shadcn-vue.

## Critical Rules

1. **Read MIGRATION.md first** — it has the component mapping table, examples, and rules
2. **Read the task file for your assigned phase** — it lists exact files and what to replace
3. **One file at a time** — migrate, build, lint, verify before moving to the next file
4. **Template and style changes ONLY** — do NOT change component logic, computed properties, watchers, events, or store interactions
5. **Eliminate ALL `:deep()` selectors** in every file you touch
6. **Eliminate ALL Vuetify component tags** (`v-btn`, `v-card`, etc.) in every file you touch
7. **Run `yarn build` after every file** — do not continue if it fails
8. **Run `yarn lint` after every file** — let it auto-fix

## Existing shadcn Components

Located in `src/components/ui/`. Check what exists before creating anything new.
Use `import { ComponentName } from "@/components/ui/component-name"` syntax.

## Utility Function

```typescript
import { cn } from "@/lib/utils";
// Use cn() for conditional Tailwind classes:
cn("base-class", condition && "conditional-class", props.className)
```

## Theme Colors (Tailwind CSS Variables)

Use these instead of Vuetify theme colors:
- `bg-background` / `text-foreground` — main bg/text
- `bg-card` / `text-card-foreground` — card surfaces
- `bg-primary` / `text-primary-foreground` — primary accent
- `bg-muted` / `text-muted-foreground` — secondary text
- `bg-destructive` / `text-destructive-foreground` — error/danger
- `border` — default border color

## Common Patterns

### Replacing v-btn
```vue
<!-- Before -->
<v-btn color="primary" variant="outlined" @click="fn">
  <v-icon start>mdi-plus</v-icon> Label
</v-btn>

<!-- After -->
<Button variant="outline" @click="fn">
  <Plus class="mr-2 h-4 w-4" /> Label
</Button>
```

### Replacing v-icon
```vue
<!-- Before -->
<v-icon>mdi-play</v-icon>

<!-- After -->
<Play class="h-5 w-5" />
```
Import from `lucide-vue-next`.

### Replacing v-dialog
```vue
<!-- Before -->
<v-dialog v-model="open" max-width="500">
  <v-card>...</v-card>
</v-dialog>

<!-- After -->
<Dialog v-model:open="open">
  <DialogContent class="max-w-[500px]">...</DialogContent>
</Dialog>
```

### Replacing conditional classes
```vue
<!-- Before -->
<div :class="{ 'some-vuetify-class': condition }">

<!-- After -->
<div :class="cn('base', condition && 'conditional-tw-class')">
```
