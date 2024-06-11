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
          hide-actions
          @click="
            store.activePlayerId = player.player_id;
            scrollToTop(player.player_id);
          "
        >
          <v-list-item class="playerrow-list-item">
            <template #prepend>
              <v-icon
                size="45"
                :icon="
                  player.type == PlayerType.PLAYER && player.group_childs.length
                    ? 'mdi-speaker-multiple'
                    : player.icon
                "
                color="primary"
              />
            </template>
            <template #title>
              <div>
                <b>{{ truncateString(getPlayerName(player), 22) }}</b>
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
import { Player, PlayerType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import VolumeControl from '@/components/VolumeControl.vue';
import { ConnectionState, api } from '@/plugins/api';
import { getPlayerName, truncateString } from '@/helpers/utils';

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
    if (newVal && panelItem.value == undefined) {
      panelItem.value = store.activePlayer
        ? sortedPlayers.value.indexOf(store.activePlayer)
        : undefined;
    }
  },
);
watch(
  () => store.activePlayerId,
  (newVal) => {
    if (newVal) {
      // remember last selected playerId
      localStorage.setItem('mass.LastPlayerId', newVal);
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
      store.activePlayerId = undefined;
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
    elmnt?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
      inline: 'nearest',
    });
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
    store.activePlayer &&
    playerActive(store.activePlayer, false, false, false)
  )
    return;
  const newDefaultPlayer = selectDefaultPlayer();
  if (newDefaultPlayer) {
    store.activePlayerId = newDefaultPlayer.player_id;
    console.debug(
      'Selected new default player: ',
      newDefaultPlayer.display_name,
    );
  }
};

const selectDefaultPlayer = function () {
  // check if we have a player stored that was last used
  const lastPlayerId = localStorage.getItem('mass.LastPlayerId');
  if (lastPlayerId) {
    if (
      lastPlayerId in api.players &&
      playerActive(api.players[lastPlayerId], false, false, false) &&
      api.players[lastPlayerId].powered
    ) {
      return api.players[lastPlayerId];
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

.v-expansion-panel--active {
  opacity: 1;
  background-color: rgba(162, 188, 255, 0.1);
  border-block: solid 1px rgba(0, 0, 0, 0.4);
  writing-mode: horizontal-tb;
}
</style>
