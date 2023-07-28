<template>
  <BottomNavigation v-if="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })" :height="store.isInStandaloneMode ? 100 : 80" />
  <v-footer
    bottom
    fixed
    :class="`d-flex flex-column ${
      getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })
        ? 'mediacontrols-player-float'
        : 'mediacontrols-player-default'
    }`"
    :style="store.isInStandaloneMode ? 'bottom: 105px' : 'bottom: 85px'"
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
</script>

<style>
.mediacontrols-player-float {
  width: 100%;
  border-top-style: ridge;
  padding: 0px !important;
  left: 5px !important;
  width: calc((100% - 10px) - 0px) !important;
  border-radius: 10px;
}

.mediacontrols-player-default {
  width: 100%;
  border-top-style: ridge;
  padding: 0px;
}
</style>