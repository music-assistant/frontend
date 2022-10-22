<template>
  <!-- players side menu -->
  <v-navigation-drawer
    v-model="store.showPlayersMenu"
    location="right"
    width="300"
    app
    clipped
    temporary
  >
    <template #prepend>
      <v-btn
        v-if="windowPage === 1"
        variant="plain"
        :icon="mdiChevronLeft"
        @click="windowPageSwitch"
      ></v-btn>
      <v-card-title v-else>
        {{ $t('players') }}
      </v-card-title>
      <v-btn
        variant="plain"
        style="position: absolute; right: 10px; top: 0px"
        :icon="mdiClose"
        dark
        text
        @click="store.showPlayersMenu = !store.showPlayersMenu"
      />
    </template>

    <v-divider></v-divider>

    <v-window v-model="windowPage" touchless>
      <v-window-item>
        <v-list>
          <v-list-item
            v-for="player in sortedPlayers"
            :key="player.player_id"
            :disabled="!player.available"
            active-color="accent"
            two-line
            :active="store.selectedPlayer?.player_id === player.player_id"
            :title="player.group_name"
            :subtitle="$t('state.' + player.state)"
            style="padding-right: 0px"
            @click="
              store.selectedPlayer = player;
              scrollToTop(player.player_id);
            "
          >
            <template #prepend>
              <v-icon
                size="50"
                :icon="player.is_group ? mdiSpeakerMultiple : mdiSpeaker"
                color="accent"
                style="
                  padding-left: 0px;
                  padding-right: 0px;
                  margin-left: -10px;
                  margin-right: 10px;
                  width: 42px;
                  height: 50px;
                "
              />
            </template>
            <template #append>
              <v-btn
                :icon="mdiChevronRight"
                variant="plain"
                @click="windowPageSwitch()"
              ></v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-window-item>
      <v-window-item v-for="n in 2" :key="`item-${n}`">
        <VolumeControl :player="store.selectedPlayer" />
      </v-window-item>
    </v-window>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import {
  mdiSpeaker,
  mdiClose,
  mdiSpeakerMultiple,
  mdiChevronRight,
  mdiChevronLeft,
} from '@mdi/js';
import type { Player } from '../plugins/api';
import { store } from '../plugins/store';
import VolumeControl from './VolumeControl.vue';
import { api } from '../plugins/api';

const panelItem = ref<number | undefined>(undefined);

// computed properties
const sortedPlayers = computed(() => {
  const res: Player[] = [];
  for (const player_id in api?.players) {
    const player = api?.players[player_id];
    if (player.is_passive) continue;
    res.push(player);
  }
  return res
    .slice()
    .sort((a, b) => (a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1));
});

//watchers
watch(
  () => store.showPlayersMenu,
  (newVal) => {
    if (!newVal) {
      panelItem.value = undefined;
    }
  }
);

const shadowRoot = ref<ShadowRoot>();
const lastClicked = ref();
const windowPage = ref(0);
onMounted(() => {
  shadowRoot.value = getCurrentInstance()?.vnode?.el?.getRootNode();
});
const scrollToTop = function (playerId: string) {
  if (lastClicked.value == playerId) return;
  lastClicked.value = playerId;
  setTimeout(() => {
    const elmnt = shadowRoot.value?.getElementById(playerId);
    elmnt?.scrollIntoView({ behavior: 'smooth' });
  }, 0);
};
const windowPageSwitch = function () {
  windowPage.value = windowPage.value === 1 ? 0 : 1;
};
</script>

<style>
.v-list-group__items .v-list-item {
  padding-inline-start: 0px !important;
}

.v-list-item__prepend > .v-icon {
  margin-inline-end: 15px;
}
</style>
