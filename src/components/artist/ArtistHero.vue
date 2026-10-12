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
        <DetailHeroPlayButton
          class="artist-hero__play"
          shrink-label
          :item="item"
        />
        <DetailHeroButton
          :icon="Shuffle"
          :label="$t('shuffle')"
          :disabled="!store.activePlayer"
          @click="api.playMedia(item, undefined, { shuffle: true })"
        />
        <DetailHeroButton
          v-if="radioRelevant(item)"
          :icon="Orbit"
          :label="$t('artist_radio')"
          :disabled="!radioSupported(item)"
          @click="gotoRadio(item)"
        />
      </div>
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
      <DetailHeroProviders :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { ImageType, type Artist } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
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
</script>

<style scoped>
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
  flex-wrap: nowrap;
  gap: 8px;
  /* the shared main column aligns its items to the start, so claim the full
     width here to give the shrinking play button room to work within */
  align-self: stretch;
  min-width: 0;
}
/* the play button gives way so Shuffle and Endless keep their place on the row */
.artist-hero__play {
  min-width: 0;
}

.artist-hero--phone .artist-hero__name {
  font-size: 34px;
  letter-spacing: -0.8px;
}
.artist-hero--phone .artist-hero__logo {
  height: 56px;
}
.artist-hero--phone .artist-hero__actions {
  gap: 10px;
}
.artist-hero--phone .artist-hero__play {
  flex: 1;
}
</style>
