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
    <div v-if="visibleComponents && visibleComponents.play?.isVisible">
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
import { ResponsiveIconProps } from "@/components/mods/ResponsiveIcon.vue";
import RepeatBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue";
import ShuffleBtn from "./PlayerControlBtn/ShuffleBtn.vue";
import PlayBtn from "./PlayerControlBtn/PlayBtn.vue";
import PreviousBtn from "./PlayerControlBtn/PreviousBtn.vue";
import NextBtn from "./PlayerControlBtn/NextBtn.vue";
import { store } from "@/plugins/store";

// properties
export interface Props {
  visibleComponents?: {
    repeat?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
    };
    shuffle?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
    };
    play?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
    };
    previous?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
    };
    next?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
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
</style>
