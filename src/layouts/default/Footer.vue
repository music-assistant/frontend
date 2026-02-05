<template>
  <!-- Hide footer entirely when on party view with controls disabled -->
  <template v-if="!hideFooter">
    <!-- gradient background panel to make the footer player more elevated (and hide content behind it)-->
    <div
      v-if="store.mobileLayout"
      :class="$vuetify.theme.current.dark ? 'gradient-dark' : 'gradient-light'"
      :style="`
        position: fixed;
        width: 100%;
        height: 180px;
        bottom: 0px;
        z-index: 999;
      `"
    ></div>
    <BottomNavigation v-if="store.mobileLayout" :height="bottomNavHeight" />
    <v-footer
      app
      color="default"
      :class="`py-0 px-0 ${
        store.mobileLayout
          ? 'mediacontrols-player-float'
          : 'mediacontrols-player-default'
      }`"
    >
      <Player :use-floating-player="store.mobileLayout" />
    </v-footer>
  </template>
</template>

<script setup lang="ts">
import Player from "./PlayerOSD/Player.vue";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import BottomNavigation from "@/components/navigation/BottomNavigation.vue";
import api from "@/plugins/api";

const route = useRoute();

// Party mode config for show_player_controls setting
const partyModeShowControls = ref(false);

// Fetch party mode config when entering party route
watch(
  () => route.path,
  async (path) => {
    if (path === "/party") {
      try {
        const config = (await api.sendCommand("party_mode/config")) as {
          show_player_controls?: boolean;
        };
        partyModeShowControls.value = config?.show_player_controls ?? false;
      } catch {
        partyModeShowControls.value = false;
      }
    }
  },
  { immediate: true },
);

// Hide footer when on party view and controls are disabled
const hideFooter = computed(() => {
  return route.path === "/party" && !partyModeShowControls.value;
});

const bottomNavHeight = computed(() => {
  if (store.isInPWAMode) {
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
  margin-bottom: 5px;
  width: calc(100% - 20px) !important;
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
