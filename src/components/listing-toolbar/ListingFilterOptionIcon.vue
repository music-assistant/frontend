<template>
  <component
    :is="option.icon"
    v-if="option.icon"
    class="size-5 shrink-0 text-muted-foreground"
    aria-hidden="true"
  />
  <ProviderIcon v-else-if="option.domain" :domain="option.domain" :size="20" />
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import type { ListingFilterOption } from "@/helpers/listing_filters";

defineProps<{
  option: ListingFilterOption;
}>();
</script>
