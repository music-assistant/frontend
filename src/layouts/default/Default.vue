<template>
  <v-app v-if="store.connected">
    <MainView v-if="framelessState" />
    <template v-else>
      <PlayerSelect />
      <Footer />

      <MainView />
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

// keep this in a ref so that we keep it while navigating. But restart it if page is fully reloaded
const framelessState = ref(false);

const route = useRoute();
watch(
  [() => route.query.player, () => api.players], // watch both the route and api.players
  ([newActivePlayer, players]) => {
    if (!newActivePlayer) return;
    const newPlayerString = newActivePlayer.toString().toLowerCase();
    // newActivePlayer can be either player id or player name
    const newPlayerId = Object.values(players).find((p) => {
      return (
        p.player_id.toLowerCase() === newPlayerString ||
        p.display_name.toLowerCase() === newPlayerString
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
      framelessState.value = true;
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
