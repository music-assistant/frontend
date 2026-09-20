<template>
  <span class="row-source-badge">
    <ProviderIcon v-if="domain" :domain="domain" :size="12" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";

export interface Props {
  // e.g. "In your library" or "On Spotify"
  label: string;
  // provider domain for the leading icon, when a single provider feeds the row
  domain?: string;
}
defineProps<Props>();
</script>

<style scoped>
.row-source-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
