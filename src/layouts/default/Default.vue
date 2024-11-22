<template>  
  <v-app  v-if="store.connected">
    <MainView v-if="framelessState" />
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


export interface Props {
  targetPlayer?: string;
  player?: string;
  frameless?: boolean
}

const props = defineProps<Props>();

// keep this in a ref so that we keep it while navigating. But restart it if page is fully reloaded
const framelessState = ref(false)

const { targetPlayer, player, frameless } = toRefs(props);

watch([targetPlayer, player], ([targetPlayer, player]) => {
  // give preference for player if it's a string
  const newActivePlayer = typeof player === "string" ? player : targetPlayer
  if (!newActivePlayer) return;
      // newActivePlayer can be either player id or player name
      const newPlayerId = Object.values(api.players).find(p =>{
        return p.player_id === newActivePlayer || p.display_name.toLowerCase() === newActivePlayer.toLowerCase()
      })?.player_id

      if(newPlayerId){
        store.activePlayerId = newPlayerId;

      }

    // showFullscreenPlayer if the param player is defined at all
    store.showFullscreenPlayer = !!player;
  },
  { immediate: true },
);

watch(frameless, (frameless)=>{
  if(frameless){
    framelessState.value = true
  }
}, { immediate: true })
</script>

<style scoped>
.centeredoverlay :deep(.v-overlay__content) {
  left: 50%;
  right: 50%;
  top: 50%;
  bottom: 50%;
}
</style>
