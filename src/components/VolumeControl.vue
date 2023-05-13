<template>
  <v-list style="overflow: hidden" lines="two">
    <list-item>
      <template #prepend>
        <!-- special group volume/power -->
        <div v-if="player.group_childs.length > 0" :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <v-btn
            icon
            variant="plain"
            width="60"
            height="30"
            size="x-large"
            @click="setGroupPower(player, !player.powered)"
          >
            <v-icon icon="mdi-power" />
          </v-btn>
          <div class="text-caption" style="position: absolute; width: 60px; text-align: center; margin-left: 0px">
            {{ player.group_volume }}
          </div>
        </div>
        <v-divider v-if="player.group_childs.length > 0" style="margin-top: 10px; margin-bottom: 10px" />

        <div
          v-for="childPlayer in getVolumePlayers(player)"
          :key="childPlayer.player_id"
          :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'"
        >
          <div class="text-center" style="padding-right: 5px">
            <button-icon @click="api.playerCommandPowerToggle(childPlayer.player_id)">
              <v-icon :size="30" :icon="childPlayer.volume_muted ? 'mdi-volume-off' : 'mdi-power'" />
            </button-icon>
            <div class="text-caption">{{ childPlayer.volume_level }}</div>
          </div>
        </div>
      </template>

      <template #default>
        <!-- special group volume/power -->
        <div v-if="player.group_childs.length > 0" :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          {{ getPlayerName(player, 30) }}
          <PlayerVolume
            class="vc-slider"
            :is-powered="true"
            :disabled="!player.powered"
            :model-value="Math.round(player.group_volume)"
            @update:model-value="api.playerCommandGroupVolume(player.player_id, $event)"
          ></PlayerVolume>
        </div>
        <v-divider v-if="player.group_childs.length > 0" />

        <div
          v-for="childPlayer in getVolumePlayers(player)"
          :key="childPlayer.player_id"
          :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'"
        >
          {{ truncateString(childPlayer.display_name, 27) }}

          <PlayerVolume
            class="vc-slider"
            :is-powered="true"
            :disabled="!childPlayer.powered"
            :model-value="Math.round(childPlayer.volume_level)"
            @update:model-value="api.playerCommandVolumeSet(childPlayer.player_id, $event)"
          >
          </PlayerVolume>
        </div>
      </template>

      <template #append>
        <div
          v-for="childPlayer in getVolumePlayers(player)"
          :key="childPlayer.player_id"
          :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'"
        >
          <!-- sync button -->
          <div
            v-if="
              !childPlayer.synced_to &&
              !childPlayer.group_childs.length &&
              Object.values(api.players).filter((x) => !x.synced_to && x.can_sync_with.includes(childPlayer.player_id))
                .length > 0
            "
            class="vc-sync-btn"
          >
            <v-menu location="bottom end" style="z-index: 999999">
              <template #activator="{ props: menu }">
                <button-icon v-bind="menu">
                  <v-icon>mdi-link-variant</v-icon>
                </button-icon>
              </template>
              <v-list>
                <v-card-subtitle>{{ $t('sync_player_to') }}</v-card-subtitle>
                <v-list-item
                  v-for="parentPlayer of Object.values(api.players).filter(
                    (x) => !x.synced_to && x.can_sync_with.includes(childPlayer.player_id),
                  )"
                  :key="parentPlayer.player_id"
                  :title="parentPlayer.display_name"
                  @click="api.playerCommandSync(childPlayer.player_id, parentPlayer.player_id)"
                />
                <v-divider />
              </v-list>
            </v-menu>
          </div>
          <!-- unsync button -->
          <div v-if="childPlayer.synced_to" class="syncbtn">
            <button-icon @click="api.playerCommandUnSync(childPlayer.player_id)">
              <v-icon>mdi-link-variant-off</v-icon>
            </button-icon>
          </div>
        </div>
      </template>
    </list-item>
  </v-list>
</template>

<script setup lang="ts">
import { Player, PlayerType } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { truncateString, getPlayerName } from '../utils';
import ButtonIcon from './ButtonIcon.vue';
import PlayerVolume from '@/layouts/default/PlayerOSD/PlayerVolume.vue';
import ListItem from './ListItem.vue';

export interface Props {
  player: Player;
}
defineProps<Props>();

const getVolumePlayers = function (player: Player) {
  const items: Player[] = [];
  if (player.type != PlayerType.GROUP) {
    items.push(player);
  }
  for (const groupChildId of player.group_childs) {
    const volumeChild = api?.players[groupChildId];

    if (volumeChild && volumeChild.available) {
      items.push(volumeChild);
    }
  }
  items.sort((a, b) => (a.display_name.toUpperCase() > b.display_name.toUpperCase() ? 1 : -1));
  return items;
};
const setGroupPower = function (player: Player, powered: boolean) {
  if (player.type != PlayerType.GROUP && player.group_childs.length > 0) {
    // send power command to all group child players
    for (const childPlayer of getVolumePlayers(player)) {
      // bypass api throttling by sending the command directly
      api.sendCommand('players/cmd/power', {
        player_id: childPlayer.player_id,
        powered,
      });
    }
  }
  // regular power command to single player (or special group player)
  api.playerCommandPower(player.player_id, powered);
};
</script>

<style>
.vc-sync-btn {
  padding-left: 5px;
}

.vc-slider {
  padding-top: 13px;
  margin-inline-start: 0px !important;
  margin-inline-end: 0px !important;
  padding-left: 5px !important;
  padding-right: 5px !important;
}
</style>
