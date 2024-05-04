<template>
  <BottomNavigation
    v-if="store.navigationMenuStyle == 'horizontal'"
    :height="bottomNavHeight"
  />
  <v-footer
    bottom
    fixed
    :class="`d-flex flex-column ${
      useFloatingPlayer
        ? 'mediacontrols-player-float'
        : 'mediacontrols-player-default'
    }`"
    :style="`bottom: ${footerMarginBottom}px;`"
    elevation="15"
    app
  >
    <Player :use-floating-player="useFloatingPlayer" />
  </v-footer>
</template>

<script setup lang="ts">
import BottomNavigation from './BottomNavigation.vue';
import Player from './PlayerOSD/Player.vue';
import { store } from '@/plugins/store';
import { computed } from 'vue';
import { getBreakpointValue } from '@/plugins/breakpoint';

const useFloatingPlayer = computed(() => {
  return (
    !getBreakpointValue('bp3') || store.navigationMenuStyle == 'horizontal'
  );
});

const bottomNavHeight = computed(() => {
  if (store.navigationMenuStyle != 'horizontal') return 0;
  if (store.isInStandaloneMode) {
    // for iOS standalone we need extra padding at the bottom due to the apphandle
    return 100;
  }
  return 80;
});

const footerMarginBottom = computed(() => {
  if (useFloatingPlayer.value) return bottomNavHeight.value + 5;
  return 0;
});
</script>

<style>
.mediacontrols-player-float {
  width: 100%;
  padding: 0px !important;
  left: 5px !important;
  width: calc((100% - 10px) - 0px) !important;
  border-radius: 10px !important;
  border-color: #00000058;
  border-style: solid;
  border-width: thin;
}

.mediacontrols-player-default {
  width: 100%;
  border-top-style: ridge;
  padding: 0px;
}
</style>
