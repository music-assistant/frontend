<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #cover>
      <DetailHeroCover :item="item" />
    </template>

    <template v-if="item" #meta>
      <DetailHeroMetaLine v-if="item.artists.length" :icon="Music">
        <template v-for="(artist, index) in item.artists" :key="artist.uri">
          <span v-if="index > 0">,&nbsp;</span>
          <DetailHeroLink @click="gotoItem('artist', artist)">
            {{ artist.name }}
          </DetailHeroLink>
        </template>
      </DetailHeroMetaLine>
      <DetailHeroFacts
        v-if="item.album || albumFacts.length"
        :icon="Disc"
        :facts="albumFacts"
      >
        <template v-if="item.album" #lead>
          <DetailHeroLink @click="gotoItem('album', item.album)">
            {{ item.album.name }}
          </DetailHeroLink>
        </template>
      </DetailHeroFacts>
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" />
      <DetailHeroButton
        v-if="radioRelevant(item)"
        :icon="Orbit"
        :label="$t('track_radio')"
        :disabled="!radioSupported(item)"
        @click="gotoRadio(item)"
      />
      <DetailHeroSourceBadge :item="item" />
      <!-- the same chrome as the hero buttons, for the facts that are not actions -->
      <span
        v-if="hasAudioAnalysis"
        class="inline-flex flex-none items-center justify-center border border-white/25 bg-black/40"
        :class="isPhone ? 'size-11 rounded-[10px]' : 'size-9 rounded-lg'"
      >
        <AudioAnalysisMetadata :audio-metadata="item.audio_metadata" />
      </span>
      <span
        v-if="qualityLabel"
        class="ml-1 inline-flex h-[22px] flex-none items-center rounded-full bg-black/45 px-2 text-xs font-medium whitespace-nowrap"
      >
        {{ qualityLabel }}
      </span>
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import AudioAnalysisMetadata from "@/components/AudioAnalysisMetadata.vue";
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroCover from "@/components/details/DetailHeroCover.vue";
import DetailHeroFacts from "@/components/details/DetailHeroFacts.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroLink from "@/components/details/DetailHeroLink.vue";
import DetailHeroMetaLine from "@/components/details/DetailHeroMetaLine.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import {
  audioFormatLabel,
  bestAudioFormat,
  trackReleaseYear,
} from "@/components/track/trackData";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { formatDuration } from "@/helpers/utils";
import type { Track } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { Disc, Music, Orbit } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  item?: Track;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  // whether that artwork is the cover standing in for missing wide art
  blurBackdrop?: boolean;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const router = useRouter();

const isPhone = computed(() => isPhoneSizedScreen());

// "1998 · 4:31" after the album, without whatever the track does not have
const albumFacts = computed(() => {
  const track = props.item;
  if (!track) return [];
  const parts: string[] = [];
  const year = trackReleaseYear(track);
  if (year) parts.push(String(year));
  if (track.duration) parts.push(formatDuration(track.duration));
  return parts;
});

const hasAudioAnalysis = computed(() => {
  const metadata = props.item?.audio_metadata;
  return !!(metadata?.bpm || metadata?.musical_key || metadata?.energy_level);
});

const qualityLabel = computed(() => {
  const format = props.item && bestAudioFormat(props.item);
  return format ? audioFormatLabel(format) : undefined;
});

const gotoItem = function (
  name: "artist" | "album",
  target: { item_id: string; provider: string },
) {
  router.push({
    name,
    params: { itemId: target.item_id, provider: target.provider },
  });
};
</script>
