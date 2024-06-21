<template>
  <SpeakerBtn v-if="player && player.isVisible" :color="player.color" />
  <QueueBtn
    v-if="queue && queue.isVisible"
    :color="player.color"
    style="padding-left: 15px; padding-right: 20px"
  />
  <VolumeBtn
    v-if="volume && volume.isVisible"
    :color="volume.color"
    :volume-size="volume.volumeSize"
    :responsive-volume-size="volume.responsiveVolumeSize"
  />
</template>

<script setup lang="ts">
import QueueBtn from './PlayerControlBtn/QueueBtn.vue';
import SpeakerBtn from './PlayerControlBtn/SpeakerBtn.vue';
import VolumeBtn from './PlayerControlBtn/VolumeBtn.vue';

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

const props = withDefaults(defineProps<Props>(), {
  queue: () => ({ isVisible: true, showQueueDialog: false }),
  player: () => ({ isVisible: true }),
  volume: () => ({
    isVisible: true,
    volumeSize: '150px',
    responsiveVolumeSize: false,
  }),
});
</script>
