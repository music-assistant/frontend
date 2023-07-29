<template>
  <v-list style="overflow: hidden" lines="two">
    <!-- group volume/power -->
    <ListItem v-if="player.group_childs.length > 0">
      <template #prepend>
        <div :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <div class="text-center" style="padding-right: 5px">
            <Button icon style="height: 25px !important" @click="setGroupPower(player, !player.powered)">
              <v-icon :size="25" :icon="player.volume_muted ? 'mdi-volume-off' : 'mdi-power'" />
            </Button>
            <div class="text-caption">{{ player.group_volume }}</div>
          </div>
        </div>
      </template>

      <template #default>
        <div :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <h6>{{ getPlayerName(player, 27) }}</h6>

          <PlayerVolume
            class="vc-slider"
            width="100%"
            color="secondary"
            :is-powered="player.powered"
            :model-value="Math.round(player.group_volume)"
            @update:model-value="api.playerCommandGroupVolume(player.player_id, $event)"
          />
        </div>
      </template>
    </ListItem>
    <v-divider v-if="player.group_childs.length > 0" style="margin-top: 10px; margin-bottom: 10px" />

    <!-- group children -->
    <ListItem
      v-for="childPlayer in getVolumePlayers(player)"
      :key="childPlayer.player_id"
      :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'"
    >
      <template #prepend>
        <div :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <div class="text-center">
            <Button icon style="height: 25px !important" @click="api.playerCommandPowerToggle(childPlayer.player_id)">
              <v-icon :size="25" :icon="childPlayer.volume_muted ? 'mdi-volume-off' : 'mdi-power'" />
            </Button>
            <div class="text-caption">{{ childPlayer.volume_level }}</div>
          </div>
        </div>
      </template>

      <template #default>
        <div :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <h6>{{ truncateString(childPlayer.display_name, 27) }}</h6>
          <PlayerVolume
            class="vc-slider"
            width="100%"
            color="secondary"
            :is-powered="childPlayer.powered"
            :model-value="Math.round(childPlayer.volume_level)"
            @update:model-value="api.playerCommandVolumeSet(childPlayer.player_id, $event)"
          />
        </div>
      </template>

      <template #append>
        <div :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <!-- sync button -->
          <div
            v-if="
              !childPlayer.synced_to &&
              !childPlayer.group_childs.length &&
              Object.values(api.players).filter((x) => !x.synced_to && x.can_sync_with.includes(childPlayer.player_id))
                .length > 0
            "
          >
            <v-menu location="bottom end" style="z-index: 999999">
              <template #activator="{ props: menu }">
                <Button icon v-bind="menu">
                  <v-icon>mdi-link-variant</v-icon>
                </Button>
              </template>
              <v-list>
                <v-card-subtitle>{{ $t('sync_player_to') }}</v-card-subtitle>
                <list-item
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
            <Button icon @click="api.playerCommandUnSync(childPlayer.player_id)">
              <v-icon>mdi-link-variant-off</v-icon>
            </Button>
          </div>
        </div>
      </template>
    </ListItem>
  </v-list>
</template>

<script setup lang="ts">
import { Player, PlayerType } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { truncateString, getPlayerName } from '@/helpers/utils';
import PlayerVolume from '@/layouts/default/PlayerOSD/PlayerVolume.vue';
import ListItem from '@/components/mods/ListItem.vue';
import Button from '@/components/mods/Button.vue';

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

    if (volumeChild && volumeChild.available && !items.includes(volumeChild)) {
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
.vc-slider {
  padding-top: 13px;
  margin-inline-start: 0px !important;
  margin-inline-end: 0px !important;
}
</style>
