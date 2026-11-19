<template>
  <RouterLink
    :to="to"
    class="view-all-link"
    :aria-label="name ? $t('tooltip.view_all', { name }) : undefined"
  >
    {{ $t("view_all") }}
  </RouterLink>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineProps<{
  to: RouteLocationRaw;
  // what the link opens in full, for screen readers
  name?: string;
}>();
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
