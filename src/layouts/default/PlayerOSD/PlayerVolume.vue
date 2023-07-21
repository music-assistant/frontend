<template>
  <v-slider
    v-bind="playerVolumeProps"
    @touchstart="isThumbHidden = false"
    @touchend="isThumbHidden = true"
    @mouseenter="isThumbHidden = false"
    @mouseleave="isThumbHidden = true"
  >
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in ($slots as unknown)" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-slider>
</template>

<script lang="ts">
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import { computed, ref } from 'vue';

export default {
  props: {
    width: String,
    height: String,
    style: String,
    isPowered: Boolean,
  },
  setup(props, ctx) {
    const isThumbHidden = ref(true);

    // computed properties
    const activePlayerQueue = computed(() => {
      if (store.selectedPlayer) {
        return api.queues[store.selectedPlayer.active_source];
      }
      return undefined;
    });
    const curQueueItem = computed(() => {
      if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
      return undefined;
    });

    const playerVolumeDefaults = computed(() => ({
      class: 'player-volume',
      hideDetails: true,
      trackSize: 2,
      thumbSize: isThumbHidden.value ? 0 : 10,
      step: 2,
      elevation: 0,
      disabled:
        !props.isPowered ||
        !activePlayerQueue.value ||
        !activePlayerQueue.value?.active ||
        activePlayerQueue.value?.items == 0,
      style: `width: ${props.width}; height:${props.height}; display: inline-grid; ${props.style}`,
    }));

    const playerVolumeProps = computed(() => ({
      ...playerVolumeDefaults.value,
      ...ctx,
    }));

    return { isThumbHidden, playerVolumeProps };
  },
};
</script>
