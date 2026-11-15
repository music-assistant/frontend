<template>
  <!-- the icon of the community catalog is a data URI, so it is only ever an image -->
  <img
    v-if="imageIcon"
    :src="imageIcon"
    alt=""
    class="shrink-0 object-contain"
    :style="{ width: `${size}px`, height: `${size}px` }"
    data-testid="catalog-icon-image"
  />
  <ProviderIcon v-else :domain="domain" :size="size" />
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { getCommunityIconUrl } from "@/helpers/community_catalog";
import { computed } from "vue";

interface Props {
  domain: string;
  size: number;
  // the icon the community catalog gives, which the server does not serve itself
  icon?: string | null;
}

const props = defineProps<Props>();

const imageIcon = computed(() => getCommunityIconUrl(props.icon));
</script>
