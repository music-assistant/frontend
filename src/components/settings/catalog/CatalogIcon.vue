<template>
  <!-- the icon of the community catalog is a data URI, so it is only ever an image -->
  <img
    v-if="icon"
    :src="icon"
    alt=""
    class="shrink-0 object-contain"
    :style="{ width: `${size}px`, height: `${size}px` }"
    data-testid="catalog-icon-image"
  />
  <ProviderIcon v-else :domain="domain" :size="size" />
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";

interface Props {
  domain: string;
  size: number;
  // the icon the community catalog gives, which the server does not serve itself
  icon?: string | null;
}

defineProps<Props>();
</script>
