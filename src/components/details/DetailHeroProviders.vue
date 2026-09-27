<template>
  <div v-if="providers.length" class="detail-hero-providers">
    <span class="detail-hero-providers__pill">
      <template v-for="(provider, index) in providers" :key="provider.domain">
        <span v-if="index > 0" class="detail-hero-providers__sep">·</span>
        <ProviderIcon :domain="provider.domain" :size="14" />
        <span class="detail-hero-providers__name">{{ provider.name }}</span>
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { mappedServices } from "@/plugins/api/helpers";
import type { MediaItem } from "@/plugins/api/interfaces";
import { computed } from "vue";

export interface Props {
  item: MediaItem;
}
const props = defineProps<Props>();

// one entry per music service, however many accounts of it hold the item
const providers = computed(() => mappedServices(props.item));
</script>

<style scoped>
.detail-hero-providers {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.detail-hero-providers__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.detail-hero-providers__sep {
  opacity: 0.4;
}

.detail-hero--phone .detail-hero-providers {
  justify-content: flex-start;
}

/* below a wide hero the names go, leaving a row of larger bare icons that line up
   flush under the genres above them.
   Keep the 1100px width in sync with DetailHeroButton's collapse breakpoint. */
@container detail-hero (max-width: 1100px) {
  .detail-hero-providers__name,
  .detail-hero-providers__sep {
    display: none;
  }
  .detail-hero-providers__pill {
    height: auto;
    padding: 0;
    background: none;
    gap: 10px;
  }
  /* ProviderIcon sizes itself inline from its prop, so lift the bare icons here */
  .detail-hero-providers :deep(.provider-icon-wrapper),
  .detail-hero-providers :deep(.provider-icon-wrapper > div) {
    width: 20px !important;
    height: 20px !important;
  }
}
</style>
