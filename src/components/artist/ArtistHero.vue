<template>
  <DetailHero
    class="artist-hero"
    :class="{ 'artist-hero--phone': isPhone }"
    :item="item"
    :backdrop="backdrop"
    :height="440"
    :phone-height="340"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #main>
      <img
        v-if="artistLogo"
        class="artist-hero__logo"
        :src="artistLogo"
        alt=""
      />
      <h1 :class="artistLogo ? 'sr-only' : 'artist-hero__name'">
        {{ item.name }}
      </h1>

      <div class="artist-hero__actions">
        <DetailHeroPlayButton :item="item" />
        <DetailHeroButton
          v-if="api.supportsPlayMediaShuffle"
          :icon="Shuffle"
          :label="$t('shuffle')"
          :icon-only="isPhone && !isTablet"
          :disabled="!store.activePlayer"
          @click="api.playMedia(item, undefined, { shuffle: true })"
        />
        <DetailHeroButton
          v-if="radioRelevant(item)"
          :icon="Orbit"
          :label="$t('artist_radio')"
          :icon-only="isPhone && !isTablet"
          :disabled="!radioSupported(item)"
          @click="gotoRadio(item)"
        />
      </div>
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
      <div v-if="chipsShown" class="artist-hero__chips">
        <span class="artist-hero__chip">
          <template
            v-for="(provider, index) in providers"
            :key="provider.domain"
          >
            <span v-if="index > 0" class="artist-hero__chip-sep">·</span>
            <ProviderIcon :domain="provider.domain" :size="14" />
            {{ provider.name }}
          </template>
        </span>
      </div>
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { mappedServices } from "@/plugins/api/helpers";
import { ImageType, type Artist } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen, isTabletSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Orbit, Shuffle } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Artist;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const isPhone = computed(() => isPhoneSizedScreen());
const isTablet = computed(() => isTabletSizedScreen());

// wide art (fanart, then landscape) suits the hero; a square thumb is the
// last resort. No size is passed, so the server serves the original image.
const backdrop = computed(() => {
  if (!props.item) return undefined;
  return (
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE) ||
    getImageThumbForItem(props.item, ImageType.THUMB)
  );
});

const artistLogo = computed(() =>
  props.item ? getImageThumbForItem(props.item, ImageType.LOGO) : undefined,
);

// one chip per music service, however many accounts of it the artist is on
const providers = computed(() =>
  props.item ? mappedServices(props.item) : [],
);

const chipsShown = computed(() => providers.value.length > 0);
</script>

<style scoped>
.artist-hero__chips {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.artist-hero__chip {
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
.artist-hero__chip-sep {
  opacity: 0.4;
}
.artist-hero__logo {
  height: 80px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  object-position: left;
}
.artist-hero__name {
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
.artist-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.artist-hero--phone .artist-hero__chips {
  justify-content: flex-start;
}
.artist-hero--phone .artist-hero__name {
  font-size: 34px;
  letter-spacing: -0.8px;
}
.artist-hero--phone .artist-hero__logo {
  height: 56px;
}
.artist-hero--phone .artist-hero__actions {
  display: grid;
  grid-template-columns: minmax(0, 300px) repeat(2, max-content);
  align-items: center;
  align-self: stretch;
  gap: 10px;
  max-width: 100%;
  min-width: 0;
  white-space: nowrap;
}
.artist-hero--phone .artist-hero__actions > * {
  justify-self: start;
}
.artist-hero--phone .artist-hero__actions > :not(:first-child) {
  min-width: max-content;
}
.artist-hero--phone .artist-hero__actions > :first-child {
  justify-self: start;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.artist-hero--phone .artist-hero__actions :deep([data-slot="button-group"]) {
  display: flex;
  width: 100% !important;
  max-width: 300px;
  min-width: 0;
  overflow: hidden;
}
.artist-hero--phone
  .artist-hero__actions
  :deep([data-slot="button-group"] > [data-slot="button"]:first-child) {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.artist-hero--phone
  .artist-hero__actions
  :deep([data-slot="button-group"] > [data-slot="button"]:last-child) {
  flex: 0 0 auto;
}
.artist-hero--phone .artist-hero__actions :deep(.detail-hero-button > span) {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
