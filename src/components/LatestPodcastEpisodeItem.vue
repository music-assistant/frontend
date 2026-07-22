<template>
  <ListItem
    :link="episode.is_playable"
    :show-menu-btn="episode.is_playable"
    class="latest-episode-row"
    :class="{ 'latest-episode-row--disabled': !episode.is_playable }"
    @click.stop="onClick"
    @menu.stop="onMenu"
  >
    <template #prepend>
      <div
        class="media-thumb latest-episode-thumb"
        :class="{ 'is-playable': episode.is_playable }"
        @click.stop="onPlayAreaClick"
      >
        <MediaItemThumb size="50" :item="episode" />
        <span v-if="episode.is_playable" class="latest-episode-play">
          <Play :size="16" fill="currentColor" :stroke-width="0" />
        </span>
      </div>
    </template>

    <template #title>
      <div class="ma-line-clamp-1 font-medium">{{ episode.name }}</div>
    </template>

    <template #subtitle>
      <div class="flex items-center gap-1 ma-line-clamp-1 text-sm opacity-70">
        <span class="ma-line-clamp-1">{{ podcastName }}</span>
        <span v-if="releaseDate" aria-hidden="true">•</span>
        <span v-if="releaseDate" class="whitespace-nowrap">{{
          releaseDate
        }}</span>
      </div>
    </template>

    <template #append>
      <span
        v-if="episode.duration && !$vuetify.display.mobile"
        class="track-duration whitespace-nowrap text-sm opacity-70"
      >
        {{ formatDuration(episode.duration) }}
      </span>

      <Check
        v-if="episode.fully_played"
        class="ml-3 h-5 w-5 opacity-70"
        role="img"
        :aria-label="$t('item_fully_played')"
      />
      <Clock
        v-else-if="episode.resume_position_ms"
        class="ml-3 h-5 w-5 opacity-70"
        role="img"
        :aria-label="$t('item_in_progress')"
      />
    </template>
  </ListItem>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Check, Clock, Play } from "@lucide/vue";
import ListItem from "@/components/ListItem.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import {
  formatDuration,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/utils";
import { formatEpisodeReleaseDate } from "@/helpers/podcast_latest";
import type { PodcastEpisode } from "@/plugins/api/interfaces";

export interface Props {
  episode: PodcastEpisode;
}

const props = defineProps<Props>();

const { locale } = useI18n();

const podcastName = computed(() => props.episode.podcast?.name ?? "");

const releaseDate = computed(() =>
  formatEpisodeReleaseDate(props.episode, locale.value),
);

const onClick = (evt: Event): void => {
  // Unavailable/non-playable episodes must not act as links or start playback.
  if (!props.episode.is_playable) return;
  const mouseEvt = evt as MouseEvent;
  handlePlayBtnClick(props.episode, mouseEvt.clientX, mouseEvt.clientY);
};

const onPlayAreaClick = (evt: Event): void => {
  if (!props.episode.is_playable) return;
  const mouseEvt = evt as MouseEvent;
  handlePlayBtnClick(props.episode, mouseEvt.clientX, mouseEvt.clientY);
};

const onMenu = (evt: Event): void => {
  const mouseEvt = evt as MouseEvent;
  handleMenuBtnClick(
    props.episode,
    mouseEvt.clientX,
    mouseEvt.clientY,
    undefined,
    true,
  );
};
</script>

<style scoped>
.latest-episode-thumb {
  position: relative;
}

/* non-playable rows are not links: no pointer affordance on row or artwork */
.latest-episode-row--disabled,
.latest-episode-row--disabled .latest-episode-thumb {
  cursor: default;
}

.latest-episode-play {
  display: none;
}

@media (hover: hover) {
  .latest-episode-play {
    position: absolute;
    inset: 0;
    margin: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: rgb(var(--v-theme-primary));
    color: #fff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;
    z-index: 1;
  }

  .latest-episode-thumb.is-playable {
    cursor: pointer;
  }

  .latest-episode-row:hover .latest-episode-thumb.is-playable :deep(.v-img) {
    filter: blur(4px) brightness(0.35);
  }

  .latest-episode-row:hover .latest-episode-play {
    opacity: 1;
  }
}
</style>
