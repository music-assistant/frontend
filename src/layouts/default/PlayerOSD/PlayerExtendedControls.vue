<template>
  <ActivePlayerPopover
    v-if="!store.mobileLayout && player && player.isVisible"
    auto-show
    align="end"
    arrow-offset="30px"
  >
    <template #trigger>
      <SpeakerBtn :color="player.color" />
    </template>
  </ActivePlayerPopover>
  <QueueBtn
    v-if="queue && queue.isVisible"
    :color="queue.color"
    style="padding-left: 15px; padding-right: 20px"
  />
  <PlayerVolume
    v-if="volume && volume.isVisible && store.activePlayer"
    :player="store.activePlayer"
    :width="volume.volumeSize || '150px'"
    :allow-wheel="true"
    :prefer-group-volume="true"
  />
</template>

<script setup lang="ts">
import ActivePlayerPopover from "@/components/ActivePlayerPopover.vue";
import { store } from "@/plugins/store";
import PlayerVolume from "./PlayerVolume.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import SpeakerBtn from "./PlayerControlBtn/SpeakerBtn.vue";

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  queue?: {
    isVisible?: boolean;
    showQueueDialog?: boolean;
    color?: string;
  };
  player?: {
    isVisible?: boolean;
    color?: string;
  };
  volume?: {
    isVisible?: boolean;
    volumeSize?: string;
    responsiveVolumeSize?: boolean;
    color?: string;
  };
}

withDefaults(defineProps<Props>(), {
  queue: () => ({ isVisible: true, showQueueDialog: false }),
  player: () => ({ isVisible: true }),
  volume: () => ({
    isVisible: true,
    volumeSize: "150px",
    responsiveVolumeSize: false,
  }),
});
</script>
