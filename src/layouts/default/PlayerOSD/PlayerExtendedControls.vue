<template>
  <SpeakerBtn
    v-if="props.player && props.player.isVisible"
    :color="props.player.color"
  />
  <QueueBtn
    v-if="props.queue && props.queue.isVisible"
    :color="props.queue.color"
  />
  <VolumeBtn
    v-if="props.volume && props.volume.isVisible"
    :color="props.volume.color"
    :volume-size="props.volume.volumeSize"
    :responsive-volume-size="props.volume.responsiveVolumeSize"
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
