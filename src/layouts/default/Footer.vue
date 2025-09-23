<template>
  <!-- gradient background panel to make the footer player more elevated (and hide content behind it)-->
  <div
    v-if="getBreakpointValue({ breakpoint: 'tablet' })"
    :class="$vuetify.theme.current.dark ? 'gradient-dark' : 'gradient-light'"
    :style="`
      position: fixed;
      width: 100%;
      height: 180px;
      bottom: 0px;
      z-index: 999;
    `"
  ></div>
  <BottomNavigation
    :height="bottomNavHeight"
    v-if="getBreakpointValue({ breakpoint: 'tablet' })"
  />
  <v-footer
    app
    color="default"
    :class="`py-0 px-0 ${
      getBreakpointValue({ breakpoint: 'tablet' })
        ? 'mediacontrols-player-float'
        : 'mediacontrols-player-default'
    }`"
  >
    <Player
      :use-floating-player="getBreakpointValue({ breakpoint: 'tablet' })"
    />
  </v-footer>
</template>

<script setup lang="ts">
import { getBreakpointValue } from "@/plugins/breakpoint";
import Player from "./PlayerOSD/Player.vue";
import { store } from "@/plugins/store";
import { computed } from "vue";
import BottomNavigation from "@/components/navigation/BottomNavigation.vue";

const bottomNavHeight = computed(() => {
  if (store.isInStandaloneMode) {
    // for iOS standalone we need extra padding at the bottom due to the apphandle
    return 100;
  }
  return 80;
});
</script>

<style>
.mediacontrols-player-float {
  display: flex;
  flex-direction: column;
  margin: 10px;
  margin-bottom: 0;
  width: calc((100% - 20px) - 0px) !important;
  border-radius: 10px !important;
}

.gradient-dark {
  background: linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.9) 75%,
    rgba(255, 255, 255, 0) 100%
  );
}
.gradient-light {
  background: linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.9) 75%,
    rgba(255, 255, 255, 0) 100%
  );
}

.v-bottom-navigation--active {
  box-shadow: none;
}
</style>
