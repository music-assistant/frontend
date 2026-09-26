<template>
  <!-- bg-secondary paints Vuetify's own teal, so the pill takes the muted
       surface instead (same treatment as the rows editor's hidden badge) -->
  <Badge
    as="span"
    variant="secondary"
    class="gap-1.5 bg-muted text-muted-foreground"
  >
    <ProviderIcon v-if="domain" :domain="domain" :size="12" />
    {{ label }}
  </Badge>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";

export interface Props {
  // e.g. "In your library" or "On Spotify"
  label: string;
  // provider domain for the leading icon, when a single provider feeds the row
  domain?: string;
}
defineProps<Props>();
</script>
