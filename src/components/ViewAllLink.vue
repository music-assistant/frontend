<template>
  <RouterLink :to="to" class="view-all-link" :aria-label="ariaLabel">
    {{ label }}
  </RouterLink>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

const props = defineProps<{
  to: RouteLocationRaw;
  // what the link opens in full, for screen readers
  name?: string;
  // how many items it opens, shown with the label when known
  count?: number;
}>();

const label = computed(() =>
  props.count === undefined
    ? $t("view_all")
    : $t("view_all_count", { count: props.count }),
);
const ariaLabel = computed(() => {
  if (!props.name) return undefined;
  return props.count === undefined
    ? $t("tooltip.view_all", { name: props.name })
    : $t("tooltip.view_all_count", { name: props.name, count: props.count });
});
</script>

<style scoped>
.view-all-link {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  white-space: nowrap;
}
.view-all-link:hover,
.view-all-link:focus-visible {
  text-decoration: underline;
}
</style>
