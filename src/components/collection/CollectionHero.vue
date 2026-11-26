<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    blur-backdrop
    :editable-rows="false"
  >
    <!-- the stack of covers carries its own shape and shadow -->
    <template v-if="item" #cover>
      <MediaCollectionThumb :item="item" />
    </template>

    <template v-if="item" #meta>
      <AudiobookCredits :authors="authors" :narrators="narrators" />
      <DetailHeroFacts :icon="BookAudio" :facts="facts" />
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" />
      <DetailHeroPlayedState v-if="playedState" :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import AudiobookCredits from "@/components/audiobook/AudiobookCredits.vue";
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroFacts from "@/components/details/DetailHeroFacts.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroPlayedState from "@/components/details/DetailHeroPlayedState.vue";
import MediaCollectionThumb from "@/components/MediaCollectionThumb.vue";
import { formatTotalDuration } from "@/helpers/duration";
import { getPlayedState } from "@/helpers/played_state";
import {
  getAudiobookCollectionArtists,
  getImageThumbForItem,
} from "@/helpers/utils";
import {
  ImageType,
  type Audiobook,
  type MediaCollection,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { BookAudio } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: MediaCollection<Audiobook>;
}
const props = defineProps<Props>();

// no button follows the badge, so an unplayed collection leaves the play button its room
const playedState = computed(() =>
  props.item ? getPlayedState(props.item) : undefined,
);

// the first cover of the stack is blurred behind the hero
const backdrop = computed(() =>
  getImageThumbForItem(props.item, ImageType.THUMB),
);

const authors = computed(() =>
  props.item
    ? getAudiobookCollectionArtists(props.item, (book) => book.authors)
    : [],
);

const narrators = computed(() =>
  props.item
    ? getAudiobookCollectionArtists(props.item, (book) => book.narrators)
    : [],
);

// "Collection · 5 audiobooks · 42 h 10 min", without whatever is unknown
const facts = computed(() => {
  const parts = [$t("collection")];
  const count = props.item?.metadata.total_items;
  if (count) {
    parts.push($t("n_audiobooks", count, { named: { count } }));
  }
  const duration = props.item?.metadata.duration;
  if (duration) parts.push(formatTotalDuration(duration));
  return parts;
});
</script>
