<template>
  <!-- players side menu -->
  <v-navigation-drawer
    v-model="store.showPlayersMenu"
    location="right"
    app
    clipped
    temporary
    touchless
    width="290"
    style="z-index: 9999"
  >
    <!-- heading with Players as title-->
    <v-card-title class="title">
      <b>{{ $t('players') }}</b>
    </v-card-title>

    <!-- collapsible player rows-->
    <v-expansion-panels v-model="panelItem" focusable variant="accordion" flat>
      <v-expansion-panel
        v-for="player in sortedPlayers"
        :id="player.player_id"
        :key="player.player_id"
        :disabled="!player.available"
        flat
        class="playerrow"
      >
        <v-expansion-panel-title
          expand-icon="mdi-chevron-down"
          collapse-icon="mdi-chevron-up"
          @click="
            store.selectedPlayerId = player.player_id;
            scrollToTop(player.player_id);
          "
        >
          <v-list-item class="playerrow-list-item">
            <template #prepend>
              <v-icon size="45" :icon="player.icon" color="primary" />
            </template>
            <template #title>
              <div>
                <b>{{ truncateString(getPlayerName(player), 20) }}</b>
              </div>
            </template>
            <template #subtitle>
              <div
                v-if="!player.powered"
                class="text-body-2"
                style="line-height: 1em"
              >
                {{ $t('state.off') }}
              </div>
              <div
                v-else-if="
                  player.active_source != player.player_id &&
                  api.queues[player.active_source]
                "
                class="text-body-2"
                style="line-height: 1em"
              >
                {{ $t('state.' + player.state) }} ({{
                  api.queues[player.active_source].display_name
                }})
              </div>
              <div v-else class="text-body-2" style="line-height: 1em">
                {{ $t('state.' + player.state) }}
              </div>
            </template>
          </v-list-item>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <VolumeControl :player="player" />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { Player, PlayerState } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import VolumeControl from '@/components/VolumeControl.vue';
import { ConnectionState, api } from '@/plugins/api';
import { getPlayerName, truncateString } from '@/helpers/utils';
import ListItem from '@/components/mods/ListItem.vue';
import { VueElement } from 'vue';

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
  return res
    .slice()
    .sort((a, b) =>
      a.display_name.toUpperCase() > b.display_name?.toUpperCase() ? 1 : -1,
    );
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
watch(
  () => api.state,
  (newVal) => {
    if (newVal.value != ConnectionState.CONNECTED) {
      store.selectedPlayerId = undefined;
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
  if (player.hidden && !allowHidden) return false;
  return true;
};

const checkDefaultPlayer = function () {
  if (
    store.selectedPlayer &&
    playerActive(store.selectedPlayer, false, false, false)
  )
    return;
  const newDefaultPlayer = selectDefaultPlayer();
  if (newDefaultPlayer) {
    store.selectedPlayerId = newDefaultPlayer.player_id;
    console.log('Selected new default player: ', newDefaultPlayer.display_name);
  }
};

const selectDefaultPlayer = function () {
  // check if we have a player stored that was last used
  const lastPlayerId = localStorage.getItem('mass.LastPlayerId');
  if (lastPlayerId) {
    if (
      lastPlayerId in api.players &&
      playerActive(api.players[lastPlayerId], false, false, false)
    ) {
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
