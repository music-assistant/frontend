<template>
  <v-list style="overflow: hidden" lines="two">
    <!-- special group volume/power -->
    <div
      v-if="player.group_childs.length > 0"
      class="volumerow"
      :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'"
    >
      <v-btn icon variant="plain" width="60" height="30" size="x-large" @click="setGroupPower(player, !player.powered)">
        <v-icon icon="mdi-power" />
      </v-btn>
      <span class="text-body-2" style="position: absolute; margin-top: 3px">{{ getPlayerName(player, 30) }}</span>
      <div class="text-caption" style="position: absolute; width: 60px; text-align: center; margin-left: 0px">
        {{ player.group_volume }}
      </div>

      <v-slider
        lazy
        density="compact"
        step="2"
        track-size="2"
        thumb-size="10"
        thumb-label
        :disabled="!player.powered"
        :model-value="Math.round(player.group_volume)"
        style="margin-left: 5px"
        @update:model-value="api.playerCommandGroupVolume(player.player_id, $event)"
      />
    </div>
    <v-divider v-if="player.group_childs.length > 0" style="margin-top: 10px; margin-bottom: 10px" />

    <div
      v-for="childPlayer in getVolumePlayers(player)"
      :key="childPlayer.player_id"
      class="volumerow"
      :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'"
    >
      <span class="text-body-2">
        <v-btn
          icon
          variant="plain"
          width="60"
          height="30"
          size="x-large"
          @click="api.playerCommandPowerToggle(childPlayer.player_id)"
        >
          <v-icon :icon="childPlayer.volume_muted ? 'mdi-volume-off' : 'mdi-power'" />
        </v-btn>
        <span class="text-body-2" style="position: absolute; margin-top: 3px">{{
          truncateString(childPlayer.display_name, 27)
        }}</span>

        <!-- sync button -->
        <div
          v-if="
            !childPlayer.synced_to &&
            !childPlayer.group_childs.length &&
            Object.values(api.players).filter((x) => !x.synced_to && x.can_sync_with.includes(childPlayer.player_id))
              .length > 0
          "
          class="syncbtn"
        >
          <v-menu location="bottom end" style="z-index: 999999">
            <template #activator="{ props: menu }">
              <v-btn icon v-bind="menu" variant="plain">
                <v-icon>mdi-link-variant</v-icon>
              </v-btn>
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
          <v-btn icon variant="plain" @click="api.playerCommandUnSync(childPlayer.player_id)">
            <v-icon>mdi-link-variant-off</v-icon>
          </v-btn>
        </div>
      </span>
      <div class="text-caption" style="position: absolute; width: 60px; text-align: center; margin-left: 0px">
        {{ childPlayer.volume_level }}
      </div>

      <v-slider
        lazy
        density="compact"
        step="2"
        track-size="2"
        thumb-size="10"
        thumb-label
        :disabled="!childPlayer.powered"
        :model-value="Math.round(childPlayer.volume_level)"
        style="margin-left: 5px"
        @update:model-value="api.playerCommandVolumeSet(childPlayer.player_id, $event)"
      />
    </div>
  </v-list>
</template>

<script setup lang="ts">
import { Player, PlayerType } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { truncateString, getPlayerName } from '../utils';

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
.syncbtn {
  position: absolute;
  /* top: 0; */
  display: flex;
  justify-content: end;
  width: 30px;
  height: 30px;
  vertical-align: middle;
  right: 0;
  margin-right: 3px;
  margin-top: -40px;
}
.volumerow {
  height: 60px;
  padding-top: 5px;
  padding-bottom: 0px;
}

.volumerow .v-slider .v-slider__container {
  margin-left: 57px;
  margin-right: 15px;
  margin-top: -10px;
}
</style>
