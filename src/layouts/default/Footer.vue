<template>
  <BottomNavigation v-if="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })" :height="bottomNavHeight" />
  <v-footer
    bottom
    fixed
    :class="`d-flex flex-column ${
      getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })
        ? 'mediacontrols-player-float'
        : 'mediacontrols-player-default'
    }`"
    :style="`bottom: ${footerMarginBottom}px;`"
    elevation="5"
    app
    :dark="true"
  >
    <Player />
  </v-footer>
</template>

<script setup lang="ts">
import { getBreakpointValue } from '@/plugins/breakpoint';
import BottomNavigation from './BottomNavigation.vue';
import Player from './PlayerOSD/Player.vue';
import { store } from '@/plugins/store';
import { computed } from 'vue';

const bottomNavHeight = computed(() => {
  if (store.isInStandaloneMode) {
    // for iOS standalone we need extra padding at the bottom due to the apphandle
    return 100;
  }
  return 80;
});

const footerMarginBottom = computed(() => {
  if (!getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })) return 0;
  return bottomNavHeight.value + 5;
});
</script>

<style>
.mediacontrols-player-float {
  width: 100%;
  border-top-style: ridge;
  padding: 0px !important;
  left: 5px !important;
  width: calc((100% - 10px) - 0px) !important;
  border-radius: 10px !important;
}

.mediacontrols-player-default {
  width: 100%;
  border-top-style: ridge;
  padding: 0px;
}
</style>
