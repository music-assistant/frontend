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
// the user picked another player than the link's while the link's player was usable
let userPickedPlayer = false;
watch(
  [() => route.query.player, linkedPlayerId],
  ([linkedPlayer, playerId], [previousLinkedPlayer]) => {
    if (linkedPlayer !== previousLinkedPlayer) userPickedPlayer = false;
    if (playerId && !userPickedPlayer) store.activePlayerId = playerId;
  },
  { immediate: true },
);
watch(
  () => store.activePlayerId,
  (playerId) => {
    // a player picked while the link's player is not usable is a fallback, so
    // the link selects its player again once it is usable
    if (linkedPlayerId.value && playerId !== linkedPlayerId.value)
      userPickedPlayer = true;
  },
  // judged when the selection changes, not after the players changed further
  { flush: "sync" },
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
