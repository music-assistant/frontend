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
    <!-- skip back button for audiobooks and podcast episodes -->
    <div v-if="showSkipControls" class="player-controls-elements">
      <SkipBackBtn
        :player-queue="store.activePlayerQueue"
        :skip-amount="skipAmount"
        class="media-controls-item"
        :size="20"
      />
    </div>
    <!-- play/pause button -->
    <div
      v-if="visibleComponents && visibleComponents.play?.isVisible"
      class="play-btn-wrapper"
    >
      <PlayBtn
        :player="store.activePlayer"
        :player-queue="store.activePlayerQueue"
        class="media-controls-item"
        :icon="visibleComponents.play.icon"
        :size="visibleComponents.play.size"
      />
    </div>
    <!-- skip forward button for audiobooks and podcast episodes -->
    <div v-if="showSkipControls" class="player-controls-elements">
      <SkipForwardBtn
        :player-queue="store.activePlayerQueue"
        :skip-amount="skipAmount"
        class="media-controls-item"
        :size="20"
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
import SkipBackBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipBackBtn.vue";
import SkipForwardBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipForwardBtn.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { itemSupportsPlayLog } from "@/plugins/api/helpers";
import { store } from "@/plugins/store";
import { computed } from "vue";
import RepeatBtn from "./PlayerControlBtn/RepeatBtn.vue";
import NextBtn from "./PlayerControlBtn/NextBtn.vue";
import PlayBtn from "./PlayerControlBtn/PlayBtn.vue";
import PreviousBtn from "./PlayerControlBtn/PreviousBtn.vue";
import ShuffleBtn from "./PlayerControlBtn/ShuffleBtn.vue";

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
      /** glyph size in px; the button box comes from `icon` */
      size?: number;
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

const { getPreference } = useUserPreferences();
const skipAmount = getPreference("audiobook_skip_seconds", 30);
const showSkipControls = computed(() =>
  itemSupportsPlayLog(store.curQueueItem?.media_item),
);
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
.play-btn-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
