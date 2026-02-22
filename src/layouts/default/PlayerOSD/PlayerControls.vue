<template>
  <div v-if="visibleComponents" class="player-controls">
    <!-- shuffle button -->
    <div
      v-if="visibleComponents && visibleComponents.shuffle?.isVisible"
      class="player-controls-elements"
    >
      <ShuffleBtn
        :player-queue="store.activePlayerQueue"
        class="media-controls-item"
        :icon="visibleComponents.shuffle.icon"
      />
    </div>
    <!-- prev button -->
    <div
      v-if="visibleComponents && visibleComponents.previous?.isVisible"
      class="player-controls-elements"
    >
      <PreviousBtn
        :player="store.activePlayer"
        :player-queue="store.activePlayerQueue"
        class="media-controls-item"
        :icon="visibleComponents.previous.icon"
      />
    </div>
    <!-- skip back button for audiobooks/podcasts -->
    <div v-if="isAudiobookOrPodcast" class="player-controls-elements">
      <SkipBackBtn
        :player-queue="store.activePlayerQueue"
        :cur-queue-item="store.curQueueItem"
        :skip-amount="skipAmount"
        class="media-controls-item"
      />
    </div>
    <!-- play/pause button -->
    <div v-if="visibleComponents && visibleComponents.play?.isVisible">
      <PlayBtn
        :player="store.activePlayer"
        :player-queue="store.activePlayerQueue"
        class="media-controls-item"
        icon-style="circle"
        :icon="visibleComponents.play.icon"
      />
    </div>
    <!-- skip forward button for audiobooks/podcasts -->
    <div v-if="isAudiobookOrPodcast" class="player-controls-elements">
      <SkipForwardBtn
        :player-queue="store.activePlayerQueue"
        :cur-queue-item="store.curQueueItem"
        :skip-amount="skipAmount"
        class="media-controls-item"
      />
    </div>
    <!-- next button -->
    <div
      v-if="visibleComponents && visibleComponents.next?.isVisible"
      class="player-controls-elements"
    >
      <NextBtn
        :player="store.activePlayer"
        :player-queue="store.activePlayerQueue"
        :icon="visibleComponents.next.icon"
        static-height="24px"
        static-width="24px"
      />
    </div>
    <!-- repeat button -->
    <div
      v-if="visibleComponents && visibleComponents.repeat?.isVisible"
      class="player-controls-elements"
    >
      <RepeatBtn
        :player-queue="store.activePlayerQueue"
        :icon="visibleComponents.repeat.icon"
        static-height="24px"
        static-width="24px"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IconProps } from "@/components/Icon.vue";
import RepeatBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue";
import { store } from "@/plugins/store";
import NextBtn from "./PlayerControlBtn/NextBtn.vue";
import PlayBtn from "./PlayerControlBtn/PlayBtn.vue";
import PreviousBtn from "./PlayerControlBtn/PreviousBtn.vue";
import ShuffleBtn from "./PlayerControlBtn/ShuffleBtn.vue";
import SkipForwardBtn from "./PlayerControlBtn/SkipForwardBtn.vue";
import SkipBackBtn from "./PlayerControlBtn/SkipBackBtn.vue";
import { MediaType } from "@/plugins/api/interfaces";
import { computed } from "vue";

// properties
export interface Props {
  visibleComponents?: {
    repeat?: {
      isVisible?: boolean;
      icon?: IconProps;
    };
    shuffle?: {
      isVisible?: boolean;
      icon?: IconProps;
    };
    play?: {
      isVisible?: boolean;
      icon?: IconProps;
    };
    previous?: {
      isVisible?: boolean;
      icon?: IconProps;
    };
    next?: {
      isVisible?: boolean;
      icon?: IconProps;
    };
  };
}

withDefaults(defineProps<Props>(), {
  visibleComponents: () => ({
    repeat: { isVisible: true },
    shuffle: { isVisible: true },
    play: { isVisible: true },
    previous: { isVisible: true },
    next: { isVisible: true },
  }),
});

// Check if current media is audiobook or podcast
const isAudiobookOrPodcast = computed(() => {
  const mediaType = store.curQueueItem?.media_item?.media_type;
  return (
    mediaType === MediaType.AUDIOBOOK ||
    mediaType === MediaType.PODCAST ||
    mediaType === MediaType.PODCAST_EPISODE
  );
});

// Get configured skip amount from settings
const skipAmount = computed(() => {
  return parseInt(
    localStorage.getItem("frontend.settings.audiobook_skip_seconds") || "30",
  );
});
</script>

<style>
.player-controls {
  display: flex;
  justify-content: center;
}
.player-controls-elements {
  width: 46px;
  height: 46px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
