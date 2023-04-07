<template>
  <!-- shuffle button -->
  <v-btn
    v-if="
      props.buttonVisibility.shuffle
    "
    :disabled="
      !activePlayerQueue ||
        !activePlayerQueue?.active ||
        activePlayerQueue?.items == 0
    "
    variant="plain"
    icon
    @click="
      api.queueCommandShuffle(activePlayerQueue?.queue_id || '', activePlayerQueue?.shuffle_enabled
        ? false
        : true,)
    "
  >
    <v-icon
      :color="
        activePlayerQueue?.shuffle_enabled ? 'primary' : ''
      "
      icon="mdi-shuffle-variant"
    />
  </v-btn>
  <!-- prev button -->
  <v-btn
    v-if="props.buttonVisibility.previous"
    small
    icon
    variant="plain"
    :disabled="
      !activePlayerQueue ||
        !activePlayerQueue?.active ||
        activePlayerQueue?.items == 0
    "
    @click="api.queueCommandPrevious(activePlayerQueue!.queue_id)"
  >
    <v-icon icon="mdi-chevron-left" />
  </v-btn>
  <!-- play/pause button: only when MA queue is active -->
  <v-btn
    v-if="activePlayerQueue && activePlayerQueue?.active && props.buttonVisibility.play"
    icon
    x-large
    variant="plain"
    :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
    @click="api.queueCommandPlayPause(activePlayerQueue!.queue_id)"
  >
    <v-icon size="50">
      {{
        activePlayerQueue?.state == "playing" ? "mdi-pause" : "mdi-play"
      }}
    </v-icon>
  </v-btn>
  <!-- stop button: player is playing other source (not MA)-->
  <v-btn
    v-else-if="store.selectedPlayer?.state == PlayerState.PLAYING && props.buttonVisibility.play"
    icon
    x-large
    variant="plain"
    @click="api.queueCommandStop(store.selectedPlayer!.player_id)"
  >
    <v-icon size="50">
      mdi-stop
    </v-icon>
  </v-btn>
  <!-- play button: all other situations - resume the queue (disabled if queue is empty)-->
  <v-btn
    v-else-if="props.buttonVisibility.play"
    icon
    x-large
    variant="plain"
    :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
    @click="api.queueCommandPlay(activePlayerQueue?.queue_id || store.selectedPlayer!.player_id)"
  >
    <v-icon size="50">
      mdi-play
    </v-icon>
  </v-btn>
  <!-- next button -->
  <v-btn
    v-if="props.buttonVisibility.next"
    icon
    small
    variant="plain"
    :disabled="
      !activePlayerQueue ||
        !activePlayerQueue?.active ||
        activePlayerQueue?.items == 0
    "
    @click="api.queueCommandNext(activePlayerQueue!.queue_id)"
  >
    <v-icon icon="mdi-chevron-right" />
  </v-btn>
  <!-- repeat button -->
  <v-btn
    v-if="
      props.buttonVisibility.repeat
    "
    :disabled="
      !activePlayerQueue ||
        !activePlayerQueue?.active ||
        activePlayerQueue?.items == 0
    "
    variant="plain"
    icon
    @click="
      api.queueCommandRepeat(activePlayerQueue?.queue_id || '', 
                             activePlayerQueue?.repeat_mode == RepeatMode.OFF
                               ? RepeatMode.ONE
                               : activePlayerQueue?.repeat_mode == RepeatMode.ALL
                                 ? RepeatMode.OFF
                                 : RepeatMode.ALL,)
    "
  >
    <v-icon
      :color="
        activePlayerQueue?.repeat_mode == 'one'
          ? 'primary'
          : activePlayerQueue?.repeat_mode == 'all'
            ? 'primary'
            : ''
      "
      :icon="
        activePlayerQueue?.repeat_mode == 'one'
          ? 'mdi-repeat-once'
          : activePlayerQueue?.repeat_mode == 'all'
            ? 'mdi-repeat'
            : 'mdi-repeat-off'
      "
    />
  </v-btn>
</template>
  
<script setup lang="ts">
import { computed } from "vue";

import api from "@/plugins/api";
import { PlayerState, RepeatMode } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
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