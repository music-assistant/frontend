<template>
  <div class="player-controls">
    <!-- shuffle button -->
    <v-btn
      v-if="
        props.activePlayerQueue &&
        props.activePlayerQueue?.active &&
        props.buttonVisibility.shuffle
      "
      :disabled="!props.activePlayerQueue || !props.activePlayerQueue?.active"
      :size="props.smallBtnIcon.button"
      variant="plain"
      icon
      @click="
        api.playerQueueSettings(props.activePlayerQueue?.queue_id, {
          shuffle_enabled: props.activePlayerQueue?.settings.shuffle_enabled
            ? false
            : true,
        })
      "
    >
      <v-icon
        :size="props.smallBtnIcon.icon"
        :color="
          props.activePlayerQueue?.settings.shuffle_enabled ? 'accent' : ''
        "
        :icon="mdiShuffleVariant"
      />
    </v-btn>
    <!-- previous track -->
    <v-btn
      v-if="
        props.activePlayerQueue &&
        props.activePlayerQueue?.active &&
        props.buttonVisibility.previous
      "
      :disabled="
        !props.activePlayerQueue ||
        !props.activePlayerQueue?.active ||
        props.activePlayerQueue?.items == 0
      "
      :size="props.smallBtnIcon.button"
      icon
      variant="plain"
      @click="api.queueCommandPrevious(props.activePlayerQueue?.queue_id)"
    >
      <v-icon :size="props.smallBtnIcon.icon" :icon="mdiChevronLeft" />
    </v-btn>
    <!-- play/pause button: only when MA queue is active -->
    <v-btn
      v-if="
        props.activePlayerQueue &&
        props.activePlayerQueue?.active &&
        props.buttonVisibility.play
      "
      :disabled="props.activePlayerQueue && props.activePlayerQueue?.items == 0"
      :size="props.smallBtnIcon.button"
      style="align-content: center"
      icon
      variant="plain"
      @click="api.queueCommandPlayPause(props.activePlayerQueue?.queue_id)"
    >
      <v-icon :size="props.largeBtnIcon.icon">
        {{ props.activePlayerQueue?.state == 'playing' ? mdiPause : mdiPlay }}
      </v-icon>
    </v-btn>
    <!-- stop button: player is playing other source (not MA)-->
    <v-btn
      v-else-if="
        store.selectedPlayer?.state == PlayerState.PLAYING &&
        props.buttonVisibility.play
      "
      :size="props.largeBtnIcon.button"
      icon
      variant="plain"
      @click="api.queueCommandStop(props.activePlayerQueue?.queue_id)"
    >
      <v-icon :size="props.largeBtnIcon.icon">
        {{ mdiStop }}
      </v-icon>
    </v-btn>
    <!-- play button: all other situations - resume the queue (disabled if queue is empty)-->
    <v-btn
      v-else-if="props.buttonVisibility.play"
      :disabled="props.activePlayerQueue && props.activePlayerQueue?.items == 0"
      :size="props.largeBtnIcon.button"
      style="align-content: center"
      variant="plain"
      @click="api.queueCommandPlay(props.activePlayerQueue?.queue_id)"
    >
      <v-icon :size="props.largeBtnIcon.icon">
        {{ mdiPlay }}
      </v-icon>
    </v-btn>
    <!-- next track -->
    <v-btn
      v-if="
        props.activePlayerQueue &&
        props.activePlayerQueue?.active &&
        props.buttonVisibility.next
      "
      :disabled="
        !props.activePlayerQueue ||
        !props.activePlayerQueue?.active ||
        props.activePlayerQueue?.items == 0
      "
      :size="props.smallBtnIcon.button"
      icon
      small
      variant="plain"
      @click="api.queueCommandNext(props.activePlayerQueue?.queue_id)"
    >
      <v-icon :size="props.smallBtnIcon.icon" :icon="mdiChevronRight" />
    </v-btn>
    <!-- repeat button -->
    <v-btn
      v-if="
        props.activePlayerQueue &&
        props.activePlayerQueue?.active &&
        props.buttonVisibility.repeat
      "
      :size="props.smallBtnIcon.button"
      variant="plain"
      small
      icon
      @click="
        api.playerQueueSettings(props.activePlayerQueue?.queue_id, {
          repeat_mode:
            props.activePlayerQueue?.settings.repeat_mode == 'off'
              ? 'one'
              : props.activePlayerQueue?.settings.repeat_mode == 'all'
              ? 'off'
              : 'all',
        })
      "
    >
      <v-icon
        :size="props.smallBtnIcon.icon"
        :color="
          props.activePlayerQueue?.settings.repeat_mode == 'one'
            ? 'accent'
            : props.activePlayerQueue?.settings.repeat_mode == 'all'
            ? 'accent'
            : ''
        "
        :icon="
          props.activePlayerQueue?.settings.repeat_mode == 'one'
            ? mdiRepeatOnce
            : props.activePlayerQueue?.settings.repeat_mode == 'all'
            ? mdiRepeat
            : mdiRepeatOff
        "
      />
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiRepeat,
  mdiRepeatOnce,
  mdiRepeatOff,
  mdiShuffleVariant,
  mdiPlay,
  mdiPause,
  mdiStop,
} from '@mdi/js';
import { api, PlayerState, type PlayerQueue } from '@/plugins/api';
import { store } from '@/plugins/store';

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  activePlayerQueue?: PlayerQueue;
  buttonVisibility?: {
    repeat: boolean;
    shuffle: boolean;
    play: boolean;
    previous: boolean;
    next: boolean;
  };
  smallBtnIcon: {
    button: number;
    icon: number;
  };
  largeBtnIcon: {
    button: number;
    icon: number;
  };
}

const props = withDefaults(defineProps<Props>(), {
  smallBtnIcon: () => ({ button: 40, icon: 24 }),
  largeBtnIcon: () => ({ button: 60, icon: 50 }),
  buttonVisibility: () => ({
    repeat: true,
    shuffle: true,
    play: true,
    previous: true,
    next: true,
  }),
});
</script>

<style scoped>
.player-controls {
  display: inline-flex;
}
</style>
