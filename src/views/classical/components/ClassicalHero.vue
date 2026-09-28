<template>
  <DetailHero
    class="classical-hero"
    :class="{ 'classical-hero--phone': isPhone }"
    :item="item"
    :backdrop="backdrop"
    :height="440"
    :phone-height="340"
    hide-menu
  >
    <template v-if="item" #main>
      <img v-if="logo" class="classical-hero__logo" :src="logo" alt="" />
      <h1 :class="logo ? 'sr-only' : 'classical-hero__name'">
        {{ item.name }}
      </h1>

      <div v-if="$slots.meta" class="classical-hero__meta">
        <slot name="meta"></slot>
      </div>
    </template>

    <template v-if="item" #aside>
      <div class="classical-hero__genre">{{ $t("classical") }}</div>
      <DetailHeroProviders :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import { ImageType, type Artist } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

export interface Props {
  item?: Artist;
}
const props = defineProps<Props>();

const isPhone = computed(() => isPhoneSizedScreen());

// wide art (fanart, then landscape) suits the hero; a square thumb is the
// last resort
const backdrop = computed(() => {
  if (!props.item) return undefined;
  return (
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE) ||
    getImageThumbForItem(props.item, ImageType.THUMB)
  );
});

const logo = computed(() =>
  props.item ? getImageThumbForItem(props.item, ImageType.LOGO) : undefined,
);
</script>

<style scoped>
.classical-hero__logo {
  height: 80px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  object-position: left;
}
.classical-hero__name {
  margin: 0;
  font-size: 48px;
  font-weight: 500;
  letter-spacing: -1.2px;
  line-height: 1.05;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.classical-hero__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
  min-width: 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.classical-hero__genre {
  min-width: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.classical-hero--phone .classical-hero__name {
  font-size: 34px;
  letter-spacing: -0.8px;
}
.classical-hero--phone .classical-hero__logo {
  height: 56px;
}
.classical-hero--phone .classical-hero__meta {
  font-size: 14px;
}
</style>
