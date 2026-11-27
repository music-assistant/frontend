<template>
  <div
    role="group"
    :aria-label="$t('view.view_as')"
    class="inline-flex shrink-0 gap-0.5 rounded-(--radius-lg) bg-muted p-[3px]"
    data-testid="view-mode-tabs"
  >
    <!-- the pills of ProviderLabelFilter, with only the view it is in raised -->
    <Button
      v-for="option in OPTIONS"
      :key="option.mode"
      type="button"
      variant="ghost"
      size="icon-sm"
      :class="
        cn(
          'h-[30px] w-8 rounded-[7px] text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent',
          mode === option.mode &&
            'bg-background text-foreground shadow-sm hover:bg-background dark:bg-input/30 dark:hover:bg-input/30',
        )
      "
      :aria-label="$t(option.label)"
      :title="$t(option.label)"
      :aria-pressed="mode === option.mode"
      :data-view="option.mode"
      @click="pick(option.mode)"
    >
      <component :is="option.icon" class="size-4" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { $t } from "@/plugins/i18n";
import { LayoutGrid, List } from "@lucide/vue";
import { markRaw } from "vue";

type ViewMode = "list" | "card";

/**
 * The two pills switching a settings list between its list and its card
 * view, the one it is in raised.
 */
const { mode } = defineProps<{
  mode: ViewMode;
}>();

const emit = defineEmits<{
  // the other view was picked
  (e: "toggle"): void;
}>();

const OPTIONS = [
  { mode: "list", label: "view.list", icon: markRaw(List) },
  { mode: "card", label: "view.card", icon: markRaw(LayoutGrid) },
] as const;

const pick = function (picked: ViewMode) {
  if (picked !== mode) emit("toggle");
};
</script>
