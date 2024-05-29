<template>
  <!-- players side menu -->
  <v-navigation-drawer
    v-model="store.showKeyHelper"
    location="middle"
    app
    clipped
    temporary
    touchless
    width="290"
    style="z-index: 9999"
  >
    <!-- heading with Players as title-->
    <v-card-title class="title">
      <b>Shortcuts</b>
    </v-card-title>

    <!-- collapsible player rows-->
    <v-expansion-panels v-model="panelItem" focusable variant="accordion" flat>
      <v-expansion-panel
        v-for="player in sortedPlayers"
        :id="player.player_id"
        :key="player.player_id"
        :disabled="!player.available"
        flat
        class="shortcutsrow"
      >
        <v-expansion-panel-title
          expand-icon="mdi-chevron-down"
          collapse-icon="mdi-chevron-up"
        >
          sss
        </v-expansion-panel-title>
        
      </v-expansion-panel>
    </v-expansion-panels>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { Player, PlayerType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import VolumeControl from '@/components/VolumeControl.vue';
import { ConnectionState, api } from '@/plugins/api';
import { getPlayerName, truncateString } from '@/helpers/utils';

const panelItem = ref<number | undefined>(undefined);


const sortedPlayers = ["aa", "bb"]

const shadowRoot = ref<ShadowRoot>();
const lastClicked = ref();
onMounted(() => {
  shadowRoot.value = getCurrentInstance()?.vnode?.el?.getRootNode();
});


//watchers
watch(
  () => store.showKeyHelper,
  (newVal) => {
    if (!newVal) {
      panelItem.value = undefined;
    }
  },
);


</script>

<style scoped>
.title {
  font-family: 'JetBrains Mono Medium';
  font-size: x-large;
  opacity: 0.7;
  margin-top: 10px;
  margin-bottom: 10px;
}

.playerrow >>> .v-list-item__prepend {
  width: 58px;
  margin-left: -5px;
}

.playerrow >>> .v-expansion-panel-title {
  padding: 0;
  padding-right: 10px;
  height: 60px;
}

.playerrow >>> .v-expansion-panel-text__wrapper {
  padding: 0;
}
</style>
