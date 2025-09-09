<template>
  <v-app v-if="store.connected">
    <MainView v-if="store.frameless" />
    <template v-else>
      <PlayerSelect />
      <MainView />
      <Footer />
    </template>
  </v-app>
  <v-overlay
    v-else
    class="centeredoverlay"
    persistent
    :model-value="!store.connected"
  >
    <div>
      <v-progress-circular color="primary" indeterminate size="64" />
    </div>
  </v-overlay>
  <reload-prompt v-if="store.isInStandaloneMode" />
</template>

<script lang="ts" setup>
import MainView from "./View.vue";
import Footer from "./Footer.vue";
import PlayerSelect from "./PlayerSelect.vue";
import ReloadPrompt from "./ReloadPrompt.vue";
import { store } from "@/plugins/store";
import { toRefs, watch, ref } from "vue";
import api from "@/plugins/api";
import { useRoute } from "vue-router";

const route = useRoute();
watch(
  // make sure it's retriggered when players array is populated
  [() => route.query.player, () => Object.keys(api.players).length],
  ([newActivePlayer]) => {
    if (!newActivePlayer) return;
    const newPlayerString = newActivePlayer.toString().toLowerCase();
    // newActivePlayer can be either player id or player name
    const newPlayerId = Object.values(api.players).find((p) => {
      return (
        p.player_id.toLowerCase() === newPlayerString ||
        p.name.toLowerCase() === newPlayerString
      );
    })?.player_id;

    if (newPlayerId) {
      store.activePlayerId = newPlayerId;
    }
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
    if (frameless) {
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
