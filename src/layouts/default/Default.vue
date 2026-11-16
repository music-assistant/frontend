<template>
  <v-app>
    <!-- a single view across both modes, so toggling fullscreen swaps the
         chrome without tearing down the view behind it -->
    <MainView />
    <Footer v-if="!store.frameless" />
  </v-app>
  <reload-prompt />
  <SetupPausedBanner v-if="!store.frameless" />
</template>

<script lang="ts" setup>
import MainView from "./View.vue";
import Footer from "./Footer.vue";
import ReloadPrompt from "./ReloadPrompt.vue";
import SetupPausedBanner from "@/components/onboarding/SetupPausedBanner.vue";
import { usePlayPauseShortcut } from "@/composables/usePlayPauseShortcut";
import { store } from "@/plugins/store";
import { computed, watch } from "vue";
import api from "@/plugins/api";
import { isSelectablePlayer } from "@/helpers/players";
import { useRoute } from "vue-router";

const route = useRoute();

usePlayPauseShortcut();

// the usable player a ?player= link names
const linkedPlayerId = computed(() => {
  const linkedPlayer = route.query.player;
  if (!linkedPlayer) return undefined;
  const linkedPlayerString = linkedPlayer.toString().toLowerCase();
  // linkedPlayer can be either player id (also one it had before a merge) or player name
  return Object.values(api.players).find((p) => {
    return (
      (p.player_id.toLowerCase() === linkedPlayerString ||
        p.legacy_ids.some((id) => id.toLowerCase() === linkedPlayerString) ||
        p.name.toLowerCase() === linkedPlayerString) &&
      isSelectablePlayer(p)
    );
  })?.player_id;
});
watch(
  // make sure it's retriggered when players array is populated, and when the
  // linked player becomes usable or another player takes over the linked id
  [
    () => route.query.player,
    linkedPlayerId,
    () => Object.keys(api.players).length,
  ],
  ([, playerId]) => {
    if (playerId) store.activePlayerId = playerId;
  },
  { immediate: true },
);
watch(
  () => route.query.showFullscreenPlayer,
  (showFullscreenPlayer) => {
    store.showFullscreenPlayer = !!showFullscreenPlayer;
  },
  { immediate: true },
);
watch(
  () => route.query.frameless,
  (frameless) => {
    if (frameless !== undefined) {
      store.frameless = true;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.centeredoverlay :deep(.v-overlay__content) {
  left: 50%;
  right: 50%;
  top: 50%;
  bottom: 50%;
}
</style>
