<template>
  <v-app>
    <PlayerSelect />
    <MainView />
    <reload-prompt v-if="store.isInStandaloneMode" />
    <Footer />
    <v-overlay class="centeredoverlay" persistent :model-value="store.loading">
      <div>
        <v-progress-circular color="primary" indeterminate size="64" />
      </div>
    </v-overlay>
  </v-app>
</template>

<script lang="ts" setup>
import MainView from './View.vue';
import Footer from './Footer.vue';
import PlayerSelect from './PlayerSelect.vue';
import ReloadPrompt from './ReloadPrompt.vue';
import { store } from '@/plugins/store';
</script>

<style scoped>
.centeredoverlay >>> .v-overlay__content {
  left: 50%;
  right: 50%;
  top: 50%;
  bottom: 50%;
}
</style>
