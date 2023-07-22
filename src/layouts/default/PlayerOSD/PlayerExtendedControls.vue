<template>
  <QueueBtn v-if="props.queue && props.queue.isVisible" />
  <SpeakerBtn v-if="props.player && props.player.isVisible" />
  <VolumeBtn
    v-if="props.volume && props.volume.isVisible"
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
  };
  player?: {
    isVisible?: boolean;
  };
  volume?: {
    isVisible?: boolean;
    volumeSize?: string;
    responsiveVolumeSize?: boolean;
  };
}

const props = withDefaults(defineProps<Props>(), {
  queue: () => ({ isVisible: true, showQueueDialog: false }),
  player: () => ({ isVisible: true }),
  volume: () => ({ isVisible: true, volumeSize: '150px', responsiveVolumeSize: false }),
});
</script>
