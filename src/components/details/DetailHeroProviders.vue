<template>
  <!-- a phone header keeps to the item and how to play it -->
  <div v-if="providers.length && !isPhone" class="detail-hero-providers">
    <span class="detail-hero-providers__pill">
      <!-- each service keeps its icon and name together, so a list wider
           than the column wraps between services instead of overflowing -->
      <span
        v-for="(provider, index) in providers"
        :key="provider.domain"
        class="detail-hero-providers__provider"
      >
        <span v-if="index > 0" class="detail-hero-providers__sep">·</span>
        <ProviderIcon :domain="provider.domain" :size="14" />
        <span class="detail-hero-providers__name">{{ provider.name }}</span>
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { mappedServices } from "@/plugins/api/helpers";
import type { MediaItem } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { computed } from "vue";

export interface Props {
  item: MediaItem;
}
const props = defineProps<Props>();

// one entry per music service, however many accounts of it hold the item
const providers = computed(() => mappedServices(props.item));

const isPhone = computed(() => isPhoneSizedScreen());
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0 5px;
  max-width: 100%;
  min-height: 22px;
  padding: 2px 8px;
  border-radius: 11px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  font-weight: 500;
}
.detail-hero-providers__provider {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.detail-hero-providers__sep {
  opacity: 0.4;
}

.detail-hero--phone .detail-hero-providers,
.detail-hero--phone .detail-hero-providers__pill {
  justify-content: flex-start;
}

/* below a wide hero the names go, leaving a row of larger bare icons that line up
   flush under the genres above them.
   Keep the 1156px width in sync with DetailHeroButton's collapse breakpoint. */
@container detail-hero (max-width: 1156px) {
  .detail-hero-providers__name,
  .detail-hero-providers__sep {
    display: none;
  }
  .detail-hero-providers__pill {
    min-height: 0;
    padding: 0;
    background: none;
    gap: 10px;
  }
  /* enlarge the bare icons by overriding ProviderIcon's inherited size variable */
  .detail-hero-providers {
    --provider-icon-size: 20px;
  }
}
</style>
