<template>
  <!-- a phone header keeps to the item and how to play it -->
  <div v-if="providers.length && !isPhone" class="detail-hero-providers">
    <span class="detail-hero-providers__pill">
      <template v-for="(provider, index) in providers" :key="provider.domain">
        <span v-if="index > 0" class="detail-hero-providers__sep">·</span>
        <!-- a service with a page for the item opens it in a new tab -->
        <component
          :is="provider.href ? 'a' : 'span'"
          class="detail-hero-providers__service inline-flex items-center gap-[5px]"
          :class="{ [LINK_CLASS]: provider.href }"
          :href="provider.href"
          :target="provider.href ? '_blank' : undefined"
          :rel="provider.href ? 'noopener noreferrer' : undefined"
          :aria-label="provider.href ? provider.name : undefined"
        >
          <ProviderIcon :domain="provider.domain" :size="14" />
          <span class="detail-hero-providers__name group-hover:underline">{{
            provider.name
          }}</span>
        </component>
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { isWebUrl } from "@/helpers/utils";
import { mappedServices } from "@/plugins/api/helpers";
import type { MediaItem } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { computed } from "vue";

export interface Props {
  item: MediaItem;
}
const props = defineProps<Props>();

const LINK_CLASS =
  "group text-inherit no-underline focus-visible:rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--v-theme-primary))]";

// one entry per music service, however many accounts of it hold the item
// a local file's link is its path, which a browser cannot open
const providers = computed(() =>
  mappedServices(props.item).map((service) => ({
    ...service,
    href: isWebUrl(service.url) ? service.url : undefined,
  })),
);

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
   Keep the 1156px width in sync with DetailHeroButton's collapse breakpoint. */
@container detail-hero (max-width: 1156px) {
  .detail-hero-providers__name,
  .detail-hero-providers__sep {
    display: none;
  }
  /* with the names gone, a link shows it is pointed at by dimming */
  a.detail-hero-providers__service:hover {
    opacity: 0.8;
  }
  .detail-hero-providers__pill {
    height: auto;
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
