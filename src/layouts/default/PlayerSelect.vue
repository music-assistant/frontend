<template>
  <!-- players side menu -->
  <v-navigation-drawer
    v-model="store.showPlayersMenu"
    location="right"
    app
    clipped
    temporary
    touchless
    width="300"
    style="z-index: 9999"
  >
    <!-- heading with Players as title-->
    <v-card-title class="headline">
      <b>{{ $t('players') }}</b>
    </v-card-title>

    <!-- close button in the top right (accessibility reasons)-->
    <v-btn
      variant="plain"
      style="position: absolute; right: -10px; top: 0px"
      icon="mdi-close"
      dark
      text
      @click="store.showPlayersMenu = !store.showPlayersMenu"
    />
    <v-divider />

    <!-- collapsable player rows-->
    <v-expansion-panels v-model="panelItem" focusable accordion flat>
      <v-expansion-panel
        v-for="player in sortedPlayers"
        :id="player.player_id"
        :key="player.player_id"
        :disabled="!player.available"
        flat
      >
        <v-expansion-panel-title
          class="playerrow"
          :style="
            store.selectedPlayer?.player_id == player.player_id
              ? 'padding:0;background-color:rgba(50, 115, 220, 0.2);'
              : 'padding:0'
          "
          expand-icon="mdi-chevron-down"
          collapse-icon="mdi-chevron-up"
          @click="
            store.selectedPlayer = player;
            scrollToTop(player.player_id);
          "
        >
          <v-list-item density="compact">
            <template #prepend>
              <v-icon
                size="50"
                :icon="player.group_childs.length > 0 ? 'mdi-speaker-multiple' : 'mdi-speaker'"
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
            <template #title>
              <div class="text-subtitle-1">
                <b>{{ getPlayerName(player) }}</b>
              </div>
            </template>
            <template #subtitle>
              <div
                v-if="player.active_source != player.player_id && api.queues[player.active_source]"
                class="text-body-2"
                style="line-height: 1em"
              >
                {{ $t('state.' + api.queues[player.active_source].state) }} ({{
                  api.queues[player.active_source].display_name
                }})
              </div>
              <div v-else class="text-body-2" style="line-height: 1em">
                {{ player.state }}
              </div>
            </template>
          </v-list-item>
        </v-expansion-panel-title>
        <v-expansion-panel-text variant="contain">
          <VolumeControl :player="player" />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { Player, PlayerState } from '../../plugins/api/interfaces';
import { store } from '../../plugins/store';
import VolumeControl from '../../components/VolumeControl.vue';
import { api } from '../../plugins/api';
import { getPlayerName } from '@/utils';

const panelItem = ref<number | undefined>(undefined);

// computed properties
const sortedPlayers = computed(() => {
  const res: Player[] = [];
  for (const player_id in api?.players) {
    const player = api?.players[player_id];
    // ignore disabled/hidden/synced players
    if (!playerActive(player, true)) continue;
    res.push(player);
  }
  return res.slice().sort((a, b) => (a.display_name.toUpperCase() > b.display_name?.toUpperCase() ? 1 : -1));
});

//watchers
watch(
  () => store.showPlayersMenu,
  (newVal) => {
    if (!newVal) {
      panelItem.value = undefined;
    }
  },
);
watch(
  () => store.selectedPlayer,
  (newVal) => {
    if (newVal) {
      // remember last selected playerId
      localStorage.setItem('mass.LastPlayerId', newVal.player_id);
    }
  },
);
watch(
  () => api.players,
  (newVal) => {
    if (newVal) {
      checkDefaultPlayer();
    }
  },
  { deep: true },
);

const shadowRoot = ref<ShadowRoot>();
const lastClicked = ref();
onMounted(() => {
  shadowRoot.value = getCurrentInstance()?.vnode?.el?.getRootNode();
  checkDefaultPlayer();
});
const scrollToTop = function (playerId: string) {
  if (lastClicked.value == playerId) return;
  lastClicked.value = playerId;
  setTimeout(() => {
    const elmnt = shadowRoot.value?.getElementById(playerId);
    elmnt?.scrollIntoView({ behavior: 'smooth' });
  }, 0);
};

const playerActive = function (
  player: Player,
  allowUnavailable = true,
  allowSyncChild = false,
  allowHidden = false,
): boolean {
  // perform some basic checks if we may use/show the player
  if (!player.enabled) return false;
  if (!player.available && !allowUnavailable) return false;
  if (player.synced_to && !allowSyncChild) return false;
  if (player.hidden_by.length && !allowHidden) return false;
  return true;
};

const checkDefaultPlayer = function () {
  if (store.selectedPlayer && playerActive(store.selectedPlayer, false, false, false)) return;
  const newDefaultPlayer = selectDefaultPlayer();
  if (newDefaultPlayer) {
    store.selectedPlayer = newDefaultPlayer;
    console.log('Selected new default player: ', newDefaultPlayer.display_name);
  }
};

const selectDefaultPlayer = function () {
  // check if we have a player stored that was last used
  const lastPlayerId = localStorage.getItem('mass.LastPlayerId');
  if (lastPlayerId) {
    if (lastPlayerId in api.players && playerActive(api.players[lastPlayerId], false, false, false)) {
      return api.players[lastPlayerId];
    }
  }
  // select a (new) default active player
  if (api?.players) {
    // prefer the first playing player
    for (const playerId in api?.players) {
      const player = api.players[playerId];
      if (player.state == PlayerState.PLAYING) {
        return player;
      }
    }
    // fallback to just a player with item in queue
    for (const queueId in api?.queues) {
      const queue = api.queues[queueId];
      if (!playerActive(api.players[queueId], false, false, false)) continue;
      if (queue.items) {
        return api.players[queueId];
      }
    }
    // last resort: just the first queue
    for (const playerId in api?.queues) {
      if (!playerActive(api.players[playerId], false, false, false)) continue;
      return api.players[playerId];
    }
  }
};
</script>

<style>
.playerrow {
  height: 60px;
  margin-right: 15px;
}

div.v-expansion-panel-text__wrapper {
  padding-left: 0px;
  padding-right: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
}

div.v-expansion-panel--active:not(:first-child),
.v-expansion-panel--active + .v-expansion-panel {
  margin-top: 0px;
}
div.v-expansion-panel__shadow {
  box-shadow: none;
}
/* .v-expansion-panel-title.v-expansion-panel-title__icon {
  margin-right: 15px;
} */
.v-expansion-panel-title__icon {
  display: inline-flex;
  margin-bottom: -4px;
  margin-top: -4px;
  user-select: none;
  margin-inline-start: auto;
  margin-right: 5px;
}
</style>
