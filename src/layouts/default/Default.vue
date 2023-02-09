<template>
  <v-app>
    <player-select />
    <app-bar />
    <main-view v-if="api.state.value == ConnectionState.CONNECTED" />
    <v-overlay v-else>
      <v-progress-circular indeterminate size="64"></v-progress-circular>
    </v-overlay>
    <player-o-s-d />
    <reload-prompt v-if="store.isInStandaloneMode" />
  </v-app>
</template>

<script lang="ts" setup>
import AppBar from "./AppBar.vue";
import MainView from "./View.vue";
import PlayerOSD from "./PlayerOSD.vue";
import PlayerSelect from "./PlayerSelect.vue";
import ReloadPrompt from "./ReloadPrompt.vue";
import { api, ConnectionState } from "@/plugins/api";
import { store } from "@/plugins/store";
</script>
