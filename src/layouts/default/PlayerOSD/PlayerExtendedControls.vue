<template>
  <ActivePlayerPopover
    v-if="!store.mobileLayout && player && player.isVisible"
    auto-show
    align="end"
    child-element-id="extended-controls-speaker-button"
  />

  <SpeakerBtn id="extended-controls-speaker-button" :color="player.color" />

  <QueueBtn
    v-if="queue && queue.isVisible"
    :color="queue.color"
    :style="{
      'padding-left': '15px',
      'padding-right': isTrackMenuVisible ? '0px' : '20px',
    }"
  />
  <PlayerTrackMenu />
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
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed } from "vue";
import PlayerTrackMenu from "./PlayerControlBtn/PlayerTrackMenu.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import SpeakerBtn from "./PlayerControlBtn/SpeakerBtn.vue";
import PlayerVolume from "./PlayerVolume.vue";

const isTrackMenuVisible = computed(
  () => store.curQueueItem?.media_item?.media_type === MediaType.TRACK,
);

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
