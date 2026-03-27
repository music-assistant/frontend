import { store } from '@/plugins/store';

<template>
  <!-- gradient background panel to make the footer player more elevated (and hide content behind it)-->
  <div
    v-if="store.mobileLayout"
    class="footer-gradient fixed w-full h-[180px] bottom-0"
    style="z-index: 999"
  ></div>

  <!-- bottom navigation for mobile layout -->
  <!-- add a tiny bit of bottom-padding to avoid overlap with (iOS) bottom bar -->
  <BottomNavigation v-if="store.mobileLayout" style="height: 60px" />

  <footer
    :class="[
      'py-0 px-0',
      store.mobileLayout
        ? 'mediacontrols-player-float'
        : 'mediacontrols-player-default',
    ]"
    :style="[
      store.mobileLayout && store.showPlayersMenu
        ? 'z-index: 999 !important;'
        : '',
      store.isInPWAMode && !store.isIngressSession
        ? 'margin-bottom: 10px;'
        : '',
    ]"
  >
    <Player :use-floating-player="store.mobileLayout" />
  </footer>
</template>

<script setup lang="ts">
import BottomNavigation from "@/components/navigation/BottomNavigation.vue";
import { store } from "@/plugins/store";
import Player from "./PlayerOSD/Player.vue";
</script>

<style>
.mediacontrols-player-float {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  margin: 5px;
  margin-bottom: 0px;
  width: calc(100% - 10px) !important;
  border-radius: 10px !important;
  z-index: 2001 !important;
}

.mediacontrols-player-default {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000 !important;
  background-color: var(--muted);
}

.footer-gradient {
  background: linear-gradient(
    0deg,
    color-mix(in srgb, var(--background) 90%, transparent) 0%,
    color-mix(in srgb, var(--background) 90%, transparent) 75%,
    transparent 100%
  );
}
</style>
