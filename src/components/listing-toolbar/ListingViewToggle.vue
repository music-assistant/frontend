<template>
  <ButtonGroup :aria-label="$t('view.title')">
    <Button
      v-for="mode in VIEW_MODES"
      :key="mode.value"
      variant="outline"
      size="icon"
      :class="
        modelValue === mode.value
          ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary dark:bg-primary/15 dark:hover:bg-primary/20'
          : 'text-muted-foreground'
      "
      :title="$t(mode.label)"
      :aria-label="$t(mode.label)"
      :aria-pressed="modelValue === mode.value"
      @click="emit('update:modelValue', mode.value)"
    >
      <component :is="mode.icon" class="size-[18px]" />
    </Button>
  </ButtonGroup>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Grid3x3, LayoutGrid, LayoutList } from "@lucide/vue";

type ListingViewMode = "panel" | "panel_compact" | "list";

const VIEW_MODES = [
  { value: "panel", label: "view.panel", icon: LayoutGrid },
  { value: "panel_compact", label: "view.panel_compact", icon: Grid3x3 },
  { value: "list", label: "view.list", icon: LayoutList },
] as const;

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ListingViewMode];
}>();
</script>
