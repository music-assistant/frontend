<template>
  <v-app>
    <PlayerSelect />
    <MainView v-if="api.state.value == ConnectionState.CONNECTED" />
    <v-overlay v-else>
      <v-progress-circular indeterminate size="64" />
    </v-overlay>
    <reload-prompt v-if="store.isInStandaloneMode" />
    <Footer />
  </v-app>
</template>

<script lang="ts" setup>
import MainView from './View.vue';
import Footer from './Footer.vue';
import PlayerSelect from './PlayerSelect.vue';
import ReloadPrompt from './ReloadPrompt.vue';
import { api, ConnectionState } from '@/plugins/api';
import { store } from '@/plugins/store';
</script>
