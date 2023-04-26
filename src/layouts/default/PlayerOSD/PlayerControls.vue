<template>
  <div style="display: inline-flex">
    <!-- shuffle button -->
    <ButtonIcon
      v-if="props.buttonVisibility.shuffle"
      :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
      @click="
        api.queueCommandShuffle(activePlayerQueue?.queue_id || '', activePlayerQueue?.shuffle_enabled ? false : true)
      "
    >
      <v-icon :color="activePlayerQueue?.shuffle_enabled ? 'primary' : ''" icon="mdi-shuffle-variant"
    /></ButtonIcon>
    <!-- prev button -->
    <ButtonIcon
      v-if="props.buttonVisibility.previous"
      :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
      @click="api.queueCommandPrevious(activePlayerQueue!.queue_id)"
    >
      <v-icon icon="mdi-skip-previous-outline"
    /></ButtonIcon>
    <!-- play/pause button: only when MA queue is active -->
    <ButtonIcon
      v-if="activePlayerQueue && activePlayerQueue?.active && props.buttonVisibility.play"
      :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
      @click="api.queueCommandPlayPause(activePlayerQueue!.queue_id)"
    >
      <v-icon size="50">
        {{ activePlayerQueue?.state == 'playing' ? 'mdi-pause-circle' : 'mdi-play-circle' }}
      </v-icon>
    </ButtonIcon>
    <!-- stop button: player is playing other source (not MA)-->
    <ButtonIcon
      v-else-if="store.selectedPlayer?.state == PlayerState.PLAYING && props.buttonVisibility.play"
      @click="api.queueCommandStop(store.selectedPlayer!.player_id)"
    >
      <v-icon size="50"> mdi-stop </v-icon>
    </ButtonIcon>
    <!-- play button: all other situations - resume the queue (disabled if queue is empty)-->
    <ButtonIcon
      v-else-if="props.buttonVisibility.play"
      :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
      @click="api.queueCommandPlay(activePlayerQueue?.queue_id || store.selectedPlayer!.player_id)"
    >
      <v-icon size="50" icon="mdi-play-circle"></v-icon>
    </ButtonIcon>
    <!-- next button -->
    <ButtonIcon
      v-if="props.buttonVisibility.next"
      :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
      @click="api.queueCommandNext(activePlayerQueue!.queue_id)"
    >
      <v-icon icon="mdi-skip-next-outline"></v-icon>
    </ButtonIcon>
    <!-- repeat button -->
    <ButtonIcon
      v-if="props.buttonVisibility.repeat"
      :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
      @click="
        api.queueCommandRepeat(
          activePlayerQueue?.queue_id || '',
          activePlayerQueue?.repeat_mode == RepeatMode.OFF
            ? RepeatMode.ONE
            : activePlayerQueue?.repeat_mode == RepeatMode.ALL
            ? RepeatMode.OFF
            : RepeatMode.ALL,
        )
      "
    >
      <v-icon
        :color="
          activePlayerQueue?.repeat_mode == 'one' ? 'primary' : activePlayerQueue?.repeat_mode == 'all' ? 'primary' : ''
        "
        :icon="
          activePlayerQueue?.repeat_mode == 'one'
            ? 'mdi-repeat-once'
            : activePlayerQueue?.repeat_mode == 'all'
            ? 'mdi-repeat'
            : 'mdi-repeat-off'
        "
      />
    </ButtonIcon>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { PlayerState, RepeatMode } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import ButtonIcon from '@/components/ButtonIcon.vue';

// properties
export interface Props {
  buttonVisibility?: {
    repeat?: boolean;
    shuffle?: boolean;
    play?: boolean;
    previous?: boolean;
    next?: boolean;
  };
}

const props = withDefaults(defineProps<Props>(), {
  buttonVisibility: () => ({
    repeat: true,
    shuffle: true,
    play: true,
    previous: true,
    next: true,
  }),
});

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
</script>
