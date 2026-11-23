<template>
  <div v-if="visibleComponents" class="player-controls">
    <!-- shuffle button -->
    <div
      v-if="visibleComponents && visibleComponents.shuffle?.isVisible"
      class="player-controls-elements"
    >
      <SkipBtn
        v-if="showSkip"
        :player-queue="store.activePlayerQueue"
        direction="back"
      />
      <ShuffleBtn
        v-else
        :player="store.activePlayer"
        :player-queue="store.activePlayerQueue"
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
        :class="visibleComponents.play.buttonClass"
        :size="visibleComponents.play.size"
        :spinner-gap="visibleComponents.play.spinnerGap"
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
      />
    </div>
    <!-- repeat button -->
    <div
      v-if="visibleComponents && visibleComponents.repeat?.isVisible"
      class="player-controls-elements"
    >
      <SkipBtn
        v-if="showSkip"
        :player-queue="store.activePlayerQueue"
        direction="forward"
      />
      <RepeatBtn
        v-else
        :player="store.activePlayer"
        :player-queue="store.activePlayerQueue"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSkipControls } from "@/composables/useSkipControls";
import RepeatBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue";
import { store } from "@/plugins/store";
import NextBtn from "./PlayerControlBtn/NextBtn.vue";
import PlayBtn from "./PlayerControlBtn/PlayBtn.vue";
import PreviousBtn from "./PlayerControlBtn/PreviousBtn.vue";
import ShuffleBtn from "./PlayerControlBtn/ShuffleBtn.vue";
import SkipBtn from "./PlayerControlBtn/SkipBtn.vue";

// properties
export interface Props {
  visibleComponents?: {
    repeat?: {
      isVisible?: boolean;
    };
    shuffle?: {
      isVisible?: boolean;
    };
    play?: {
      isVisible?: boolean;
      /** classes for the button box, such as its size */
      buttonClass?: string;
      /** glyph size in px */
      size?: number;
      /** space in px between the button's edge and the loading ring */
      spinnerGap?: number;
    };
    previous?: {
      isVisible?: boolean;
    };
    next?: {
      isVisible?: boolean;
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

const { showSkip } = useSkipControls();
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
