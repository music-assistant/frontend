<template>
  <QueueBtn v-if="props.visibleComponents && props.visibleComponents.queue?.isVisible" />
  <SpeakerBtn v-if="props.visibleComponents && props.visibleComponents.player?.isVisible" />
  <VolumeBtn
    v-if="props.visibleComponents && props.visibleComponents.volume?.isVisible"
    :volume-size="props.volumeSize"
    :responsive-volume-size="props.responsiveVolumeSize"
  />
</template>

<script setup lang="ts">
import QueueBtn from './PlayerControlBtn/QueueBtn.vue';
import SpeakerBtn from './PlayerControlBtn/SpeakerBtn.vue';
import VolumeBtn from './PlayerControlBtn/VolumeBtn.vue';

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  volumeSize?: string;
  responsiveVolumeSize?: boolean;
  showQueueDialog?: boolean;
  visibleComponents?: {
    queue?: {
      isVisible?: boolean;
    };
    player?: {
      isVisible?: boolean;
    };
    volume?: {
      isVisible?: boolean;
    };
  };
}

const props = withDefaults(defineProps<Props>(), {
  volumeSize: '150px',
  responsiveVolumeSize: true,
  showQueueDialog: false,
  visibleComponents: () => ({
    queue: { isVisible: true },
    player: { isVisible: true },
    volume: { isVisible: true },
  }),
});
</script>
