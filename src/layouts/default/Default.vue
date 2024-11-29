<template>
  <v-app v-if="store.connected">
    <Footer />
    <PlayerSelect />
    <MainView />
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
</script>

<style scoped>
.centeredoverlay :deep(.v-overlay__content) {
  left: 50%;
  right: 50%;
  top: 50%;
  bottom: 50%;
}
</style>
