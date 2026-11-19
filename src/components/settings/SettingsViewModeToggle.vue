<template>
  <Button
    variant="ghost"
    :size="size"
    :title="label"
    :aria-label="label"
    data-testid="view-mode-toggle"
    @click="emit('toggle')"
  >
    <List v-if="mode === 'list'" :class="iconClass" />
    <LayoutGrid v-else :class="iconClass" />
  </Button>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { $t } from "@/plugins/i18n";
import { LayoutGrid, List } from "@lucide/vue";
import { computed } from "vue";

/**
 * The button switching a settings list between its list and its card view,
 * showing the view it is in.
 */
const { mode, small = false } = defineProps<{
  mode: "list" | "card";
  // the size of a button in the header of a panel rather than in the toolbar
  small?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
}>();

const size = computed(() => (small ? "icon-sm" : "icon"));
const iconClass = computed(() => (small ? "size-4" : "size-5"));

const label = computed(() => {
  const next = mode === "list" ? "card" : "list";
  return $t("tooltip.view_mode_switch", [
    $t(`view.${mode}`),
    $t(`view.${next}`),
  ]);
});
</script>
