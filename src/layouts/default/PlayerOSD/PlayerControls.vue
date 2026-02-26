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
    <!-- play/pause button -->
    <div
      v-if="visibleComponents && visibleComponents.play?.isVisible"
      class="play-btn-wrapper"
    >
      <PlayBtn
        :player="store.activePlayer"
        :player-queue="store.activePlayerQueue"
        class="media-controls-item"
        icon-style="circle"
        :icon="visibleComponents.play.icon"
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
