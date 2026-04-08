<template>
  <div class="extended-controls">
    <div v-if="store.activePlayer" class="extended-controls__label">
      <PlayerNameLabel clickable :icon-size="20" />
    </div>
    <div class="extended-controls__buttons">
      <PlayerTrackMenu v-if="contextMenu && contextMenu.isVisible" />
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
    </div>
  </div>
</template>

<script setup lang="ts">
import PlayerNameLabel from "@/components/PlayerNameLabel.vue";
import { store } from "@/plugins/store";
import PlayerTrackMenu from "./PlayerControlBtn/PlayerTrackMenu.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import PlayerVolume from "./PlayerVolume.vue";

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
  contextMenu?: {
    isVisible?: boolean;
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
  contextMenu: () => ({ isVisible: true }),
});
</script>

<style scoped>
.extended-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.extended-controls__label {
  padding-bottom: 2px;
  align-self: flex-end;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.extended-controls__buttons {
  display: flex;
  align-items: center;
}
</style>
