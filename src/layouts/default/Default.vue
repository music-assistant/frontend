<template>
  <v-app v-if="store.connected">
    <MainView v-if="framelessState" />
    <template v-else>
      <Footer />
      <PlayerSelect />
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

export interface Props {
  showFullscreenPlayer?: boolean;
  player?: string;
  frameless?: boolean;
}

const props = defineProps<Props>();

// keep this in a ref so that we keep it while navigating. But restart it if page is fully reloaded
const framelessState = ref(false);

const { showFullscreenPlayer, player, frameless } = toRefs(props);

watch(
  player,
  (newActivePlayer) => {
    if (!newActivePlayer) return;
    // newActivePlayer can be either player id or player name
    const newPlayerId = Object.values(api.players).find((p) => {
      return (
        p.player_id === newActivePlayer ||
        p.display_name.toLowerCase() === newActivePlayer.toLowerCase()
      );
    })?.player_id;

    if (newPlayerId) {
      store.activePlayerId = newPlayerId;
    }
  },
  { immediate: true },
);
watch(
  showFullscreenPlayer,
  (showFullscreenPlayer) => {
    store.showFullscreenPlayer = !!showFullscreenPlayer;
  },
  { immediate: true },
);
watch(
  frameless,
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
