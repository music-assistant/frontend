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

  <!-- bottom navigation for mobile layout -->
  <!-- add a tiny bit of bottom-padding to avoid overlap with (iOS) bottom bar -->
  <BottomNavigation v-if="store.mobileLayout" app style="height: 60px" />

  <v-footer
    app
    color="default"
    :class="`py-0 px-0 ${
      store.mobileLayout
        ? 'mediacontrols-player-float'
        : 'mediacontrols-player-default'
    }`"
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
  </v-footer>
</template>

<script setup lang="ts">
import BottomNavigation from "@/components/navigation/BottomNavigation.vue";
import { usePartyModeConfig } from "@/composables/usePartyModeConfig";
import { store } from "@/plugins/store";
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import Player from "./PlayerOSD/Player.vue";

const route = useRoute();
const { config: partyConfig, fetchConfig } = usePartyModeConfig();

// Fetch party mode config when entering party route
watch(
  () => route.path,
  async (path) => {
    if (path === "/party") {
      await fetchConfig();
    }
  },
  { immediate: true },
);

// Hide footer when on party view and controls are explicitly disabled
const hideFooter = computed(() => {
  return (
    route.path === "/party" &&
    partyConfig.value !== null &&
    (partyConfig.value?.show_player_controls ?? false) === false
  );
});
</script>

<style>
.mediacontrols-player-float {
  display: flex;
  flex-direction: column;
  margin: 5px;
  margin-bottom: 0px;
  width: calc(100% - 10px) !important;
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
  z-index: 2000 !important;
}

.v-footer {
  z-index: 1000 !important;
}

.v-footer.mediacontrols-player-float {
  z-index: 2001 !important;
}
</style>
