<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    @edit-rows="emit('edit-rows')"
  >
    <template v-if="item" #cover>
      <DetailHeroCover :item="item" />
    </template>

    <template v-if="item" #meta>
      <DetailHeroMetaLine :icon="PodcastIcon">
        <DetailHeroLink @click="gotoPodcast">
          {{ item.podcast.name }}
        </DetailHeroLink>
      </DetailHeroMetaLine>
      <!-- wraps on a narrow phone rather than running past the edge -->
      <div
        v-if="releaseDate || item.duration || episodeNumber"
        class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
      >
        <span
          v-if="episodeNumber"
          class="inline-flex items-center gap-1.5 whitespace-nowrap"
          :title="episodeNumber.label"
        >
          <span aria-hidden="true">{{ episodeNumber.short }}</span>
          <span class="sr-only">{{ episodeNumber.label }}</span>
        </span>
        <span
          v-if="releaseDate"
          class="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Calendar :size="16" class="flex-none" aria-hidden="true" />
          {{ releaseDate }}
        </span>
        <span
          v-if="item.duration"
          class="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Timer :size="16" class="flex-none" aria-hidden="true" />
          {{ formatDuration(item.duration) }}
        </span>
      </div>
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" :parent-item="parentPodcast" />
      <template v-if="showSteppers">
        <DetailHeroButton
          :icon="ChevronLeft"
          :label="$t('previous_episode')"
          icon-only
          :disabled="!hasPrevious"
          @click="emit('previous')"
        />
        <DetailHeroButton
          :icon="ChevronRight"
          :label="$t('next_episode')"
          icon-only
          :disabled="!hasNext"
          @click="emit('next')"
        />
      </template>
      <!-- holds its place while unplayed, so the transcript button keeps its position -->
      <DetailHeroPlayedState :item="item" />
      <DetailHeroButton
        v-if="showTranscript"
        :icon="Captions"
        :label="$t('transcript')"
        :icon-only="isPhone"
        @click="emit('transcript')"
      />
    </template>

    <template v-if="item" #aside>
      <!-- episodes carry no genres of their own, so they show the podcast's -->
      <DetailHeroGenres v-if="parentPodcast" :item="parentPodcast" />
      <DetailHeroProviders :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroCover from "@/components/details/DetailHeroCover.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroLink from "@/components/details/DetailHeroLink.vue";
import DetailHeroMetaLine from "@/components/details/DetailHeroMetaLine.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroPlayedState from "@/components/details/DetailHeroPlayedState.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import {
  episodeReleaseDate,
  podcastEpisodeNumber,
} from "@/components/podcast/podcastEpisodeData";
import { formatDuration } from "@/helpers/utils";
import type { Podcast, PodcastEpisode } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import {
  Calendar,
  Captions,
  ChevronLeft,
  ChevronRight,
  PodcastIcon,
  Timer,
} from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  item?: PodcastEpisode;
  // the podcast the episode belongs to, which gives the play menu its options
  // for playing on from the episode and the hero its genres
  parentPodcast?: Podcast;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  // whether that artwork is the cover standing in for missing wide art
  blurBackdrop?: boolean;
  // shows the previous/next buttons, which hasPrevious and hasNext enable
  showSteppers?: boolean;
  hasPrevious?: boolean;
  hasNext?: boolean;
  showTranscript?: boolean;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "previous"): void;
  (e: "next"): void;
  (e: "transcript"): void;
  (e: "edit-rows"): void;
}>();

const router = useRouter();

const isPhone = computed(() => isPhoneSizedScreen());

// empty when the episode has no (valid) publish date
const releaseDate = computed(() =>
  props.item ? episodeReleaseDate(props.item) : "",
);

const episodeNumber = computed(() =>
  props.item ? podcastEpisodeNumber(props.item) : undefined,
);

const gotoPodcast = function () {
  const podcast = props.parentPodcast ?? props.item?.podcast;
  if (!podcast) return;
  router.push({
    name: "podcast",
    params: { itemId: podcast.item_id, provider: podcast.provider },
  });
};
</script>
