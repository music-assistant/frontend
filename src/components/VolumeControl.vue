<template>
  <v-list style="overflow: hidden" lines="two">
    <!-- main (or group) volume/power -->
    <v-list-item>
      <template #prepend>
        <div :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <div class="text-center">
            <Button
              icon
              style="height: 25px !important"
              @click="setGroupPower(player, !player.powered)"
            >
              <v-icon
                :size="25"
                :icon="player.volume_muted ? 'mdi-volume-off' : 'mdi-power'"
              />
            </Button>
            <div class="text-caption">{{ player.group_volume }}</div>
          </div>
        </div>
      </template>

      <template #default>
        <div
          class="volumesliderrow"
          :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'"
        >
          <h6>{{ getPlayerName(player, 27) }}</h6>
          <PlayerVolume
            class="vc-slider"
            width="100%"
            color="secondary"
            :is-powered="player.powered"
            :disabled="!player.available || !player.powered"
            :model-value="Math.round(player.group_volume)"
            @update:model-value="
              api.playerCommandGroupVolume(player.player_id, $event)
            "
          />
        </div>
      </template>
      <template #append>
        <div :style="player.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
          <!-- sync button -->
          <div
            v-if="
              player.type == PlayerType.PLAYER &&
              player.can_sync_with.length &&
              Object.values(api.players).filter(
                (x) =>
                  !x.synced_to && x.can_sync_with.includes(player.player_id),
              ).length > 0
            "
            class="syncbtn"
          >
            <Button icon @click="toggleSyncControls">
              <v-icon>mdi-link-variant</v-icon>
            </Button>
          </div>
        </div>
      </template>
    </v-list-item>

    <!-- volume player rows -->
    <div v-if="player.group_childs.length > 0 || showSyncControls">
      <v-divider style="margin-top: 7px; margin-bottom: 7px" />
      <v-list-item
        v-for="childPlayer in getVolumePlayers(player, !showSyncControls)"
        :key="childPlayer.player_id"
        density="compact"
        :style="
          childPlayer.powered || showSyncControls
            ? 'opacity: 0.75'
            : 'opacity: 0.5'
        "
        @click.stop
      >
        <template #prepend>
          <div>
            <div class="text-center">
              <v-checkbox
                v-if="showSyncControls"
                class="checkbox"
                :model-value="syncChilds.includes(childPlayer.player_id)"
                @update:model-value="
                  syncCheckBoxChange(childPlayer.player_id, $event)
                "
              />
              <div v-else>
                <Button
                  icon
                  style="min-height: 20px; height: 25px !important"
                  @click="api.playerCommandPowerToggle(childPlayer.player_id)"
                >
                  <v-icon :size="25" icon="mdi-power" />
                </Button>
                <div v-if="childPlayer.volume_muted" class="text-caption">
                  {{ $t('muted') }}
                </div>
                <div v-else class="text-caption">
                  {{ childPlayer.volume_level }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #default>
          <div
            class="volumesliderrow"
            :style="
              childPlayer.powered || showSyncControls
                ? 'opacity: 0.75'
                : 'opacity: 0.5'
            "
          >
            <h6>{{ truncateString(childPlayer.display_name, 27) }}</h6>
            <PlayerVolume
              width="100%"
              color="secondary"
              :is-powered="childPlayer.powered"
              :disabled="
                !player.available || (!childPlayer.powered && !showSyncControls)
              "
              :model-value="Math.round(childPlayer.volume_level)"
              @update:model-value="
                api.playerCommandVolumeSet(childPlayer.player_id, $event)
              "
            />
          </div>
        </template>
      </v-list-item>
    </div>
    <v-list-item v-if="showSyncControls">
      <v-btn color="primary" width="100%" @click="saveSyncMembersClicked">{{
        $t('apply')
      }}</v-btn>
    </v-list-item>
  </v-list>
</template>

<script setup lang="ts">
import { Player, PlayerType } from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import { truncateString, getPlayerName } from '@/helpers/utils';
import PlayerVolume from '@/layouts/default/PlayerOSD/PlayerVolume.vue';
import Button from '@/components/mods/Button.vue';
import { ref } from 'vue';

export interface Props {
  player: Player;
}
const compProps = defineProps<Props>();

const showSyncControls = ref<boolean>(false);
const syncChilds = ref<string[]>([]);

const getVolumePlayers = function (player: Player, includeSelf = true) {
  const items: Player[] = [];
  if (
    includeSelf &&
    player.type != PlayerType.GROUP &&
    player.type != PlayerType.SYNC_GROUP
  ) {
    items.push(player);
  }
  for (const groupChildId of player.group_childs) {
    const volumeChild = api?.players[groupChildId];

    if (volumeChild && volumeChild.available && !items.includes(volumeChild)) {
      items.push(volumeChild);
    }
  }
  if (showSyncControls.value && player.type == PlayerType.PLAYER) {
    for (const syncPlayerId of Object.keys(api?.players)) {
      const syncPlayer = api?.players[syncPlayerId];
      if (
        syncPlayer &&
        syncPlayer.available &&
        syncPlayer.can_sync_with.includes(player.player_id) &&
        !items.includes(syncPlayer)
      ) {
        items.push(syncPlayer);
      }
    }
  }
  items.sort((a, b) =>
    a.display_name.toUpperCase() > b.display_name.toUpperCase() ? 1 : -1,
  );
  return items;
};
const setGroupPower = function (player: Player, powered: boolean) {
  if (
    player.type == PlayerType.GROUP ||
    player.type == PlayerType.SYNC_GROUP ||
    player.group_childs.length > 0
  ) {
    // send power command to all group child players
    api.playerCommandGroupPower(player.player_id, powered);
  } else {
    // regular power command to single player (or special group player)
    api.playerCommandPower(player.player_id, powered);
  }
};
const toggleSyncControls = function () {
  showSyncControls.value = !showSyncControls.value;
  syncChilds.value = [...compProps.player.group_childs];
};
const syncCheckBoxChange = function (playerId: string, value: boolean | null) {
  if (value) syncChilds.value.push(playerId);
  else syncChilds.value = syncChilds.value.filter((x) => x != playerId);
};
const saveSyncMembersClicked = function () {
  // unsync removed players
  const removedSyncPlayers = compProps.player.group_childs.filter(
    (x) => !syncChilds.value.includes(x),
  );
  if (removedSyncPlayers.length > 0) {
    api.playerCommandUnSyncMany(removedSyncPlayers);
  }
  // sync new players
  api.playerCommandSyncMany(compProps.player.player_id, syncChilds.value);
  showSyncControls.value = false;
};
</script>

<style scoped>
.syncbtn {
  width: 30px;
  padding-left: 13px;
}
.volumesliderrow {
  margin-top: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
}

.v-list-item__prepend {
  width: 58px;
  margin-left: -5px;
  height: 25px;
}
.v-list-item {
  padding-top: 0px;
  padding-bottom: 0px;
}

.checkbox {
  min-height: 20px;
  height: 25px !important;
  margin-top: -25px;
  padding: 0;
}
</style>
