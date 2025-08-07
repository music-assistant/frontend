<template>
  <v-list style="overflow: hidden; padding: 0" lines="two">
    <!-- main (or group) volume/power -->
    <!-- mute btn + player name + optional sync checkbox-->
    <v-list-item
      v-if="showHeadingRow"
      class="volumesliderrow heading"
      :link="false"
      :style="player.powered == false ? 'opacity: 0.6' : 'opacity: 1'"
    >
      <template #prepend>
        <v-icon
          :size="25"
          :icon="player.icon"
          style="margin-left: 6px; opacity: 0.6"
        />
      </template>
      <template #default>
        <h5>{{ getPlayerName(player, 27) }}</h5>
      </template>
      <template #append>
        <!-- power button -->
        <Button
          v-if="player.power_control != PLAYER_CONTROL_NONE"
          class="powerbtn"
          variant="icon"
          @click.stop="api.playerCommandPowerToggle(player.player_id)"
        >
          <v-icon :size="25" icon="mdi-power" />
        </Button>
      </template>
    </v-list-item>
    <!-- mute btn + volume slider + volume level text (or collapse btn)-->
    <v-list-item
      v-if="
        showVolumeControl &&
        (player.volume_control != PLAYER_CONTROL_NONE ||
          player.group_childs.length)
      "
      class="volumesliderrow"
      :link="false"
      :style="player.powered == false ? 'opacity: 0.35' : 'opacity: 0.75'"
    >
      <template #prepend>
        <!-- mute button -->
        <Button
          icon
          style="height: 25px"
          :disabled="
            player.type == PlayerType.GROUP ||
            player.group_childs.length > 0 ||
            player.mute_control == PLAYER_CONTROL_NONE
          "
          @click.stop="api.playerCommandMuteToggle(player.player_id)"
        >
          <v-icon
            :size="25"
            :icon="
              player.volume_muted ? 'mdi-volume-mute' : 'mdi-volume-medium'
            "
          />
        </Button>
      </template>
      <template #default>
        <PlayerVolume
          v-if="
            player.volume_control != PLAYER_CONTROL_NONE ||
            player.group_childs.length
          "
          color="secondary"
          width="100%"
          :is-powered="player.powered != false"
          :disabled="!player.available"
          :model-value="
            Math.round(
              player.group_childs.length
                ? player.group_volume
                : player.volume_level || 0,
            )
          "
          @click.stop
          @update:model-value="
            player.group_childs.length > 0
              ? api.playerCommandGroupVolume(player.player_id, $event)
              : api.playerCommandVolumeSet(player.player_id, $event)
          "
        />
      </template>
      <template #append>
        <v-icon v-if="canExpand && !showSubPlayers" class="expandbtn">
          mdi-chevron-down
        </v-icon>
        <div v-else class="text-caption volumecaption">
          {{
            Math.round(
              player.group_childs.length
                ? player.group_volume
                : player.volume_level || 0,
            )
          }}
        </div>
      </template>
    </v-list-item>

    <!-- (child) volume player rows -->
    <div
      v-if="
        showSubPlayers &&
        (player.group_childs.length > 0 || showSyncControls) &&
        getVolumePlayers(player).length > 0
      "
      @click.stop
    >
      <v-divider style="margin-top: 10px; margin-bottom: 15px" />

      <div
        v-for="childPlayer in getVolumePlayers(player)"
        :key="childPlayer.player_id"
      >
        <!-- player icon + player name + optional sync checkbox-->
        <v-list-item
          class="volumesliderrow"
          :link="false"
          :style="
            childPlayer.powered != false || showSyncControls
              ? 'opacity: 0.75'
              : 'opacity: 0.4'
          "
          @click.stop
        >
          <template #prepend>
            <v-icon
              :size="30"
              :icon="childPlayer.icon"
              style="margin-left: 6px; opacity: 0.6"
            />
          </template>
          <template #default>
            <h6>{{ truncateString(childPlayer.name, 27) }}</h6>
          </template>
          <template #append>
            <v-checkbox
              v-if="showSyncControls"
              :ripple="false"
              :disabled="childPlayer.player_id == player.player_id"
              :model-value="
                player.group_childs.includes(childPlayer.player_id) ||
                childPlayer.player_id == player.player_id
              "
              size="22"
              class="checkbox"
              @update:model-value="
                syncCheckBoxChange(childPlayer.player_id, $event)
              "
            />
          </template>
        </v-list-item>
        <!-- mute btn + volume slider + volume level text-->
        <v-list-item
          v-if="childPlayer.volume_control != PLAYER_CONTROL_NONE"
          class="volumesliderrow"
          :link="false"
          :style="
            childPlayer.powered == false ? 'opacity: 0.4' : 'opacity: 0.75'
          "
          @click.stop
        >
          <template #prepend>
            <Button
              icon
              :disabled="
                !childPlayer.available ||
                childPlayer.mute_control == PLAYER_CONTROL_NONE
              "
              style="height: 25px"
              @click="api.playerCommandMuteToggle(childPlayer.player_id)"
            >
              <v-icon
                :size="25"
                :icon="
                  childPlayer.volume_muted
                    ? 'mdi-volume-mute'
                    : 'mdi-volume-medium'
                "
              />
            </Button>
          </template>
          <template #default>
            <PlayerVolume
              v-if="childPlayer.volume_control != PLAYER_CONTROL_NONE"
              color="secondary"
              width="100%"
              :is-powered="childPlayer.powered != false"
              :disabled="!childPlayer.available"
              :allow-wheel="allowWheel"
              :model-value="Math.round(childPlayer.volume_level || 0)"
              @update:model-value="
                api.playerCommandVolumeSet(childPlayer.player_id, $event)
              "
            />
          </template>
          <template #append>
            <div
              v-if="childPlayer.volume_control != PLAYER_CONTROL_NONE"
              class="text-caption volumecaption"
            >
              {{ childPlayer.volume_level }}
            </div>
          </template>
        </v-list-item>
        <div style="height: 14px"></div>
      </div>
    </div>
  </v-list>
</template>

<script setup lang="ts">
import {
  Player,
  PlayerFeature,
  PlaybackState,
  PlayerType,
  PLAYER_CONTROL_NONE,
} from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { truncateString, getPlayerName } from "@/helpers/utils";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import Button from "@/components/mods/Button.vue";
import { computed, ref } from "vue";

export interface Props {
  player: Player;
  showSyncControls?: boolean;
  showSubPlayers?: boolean;
  showHeadingRow?: boolean;
  showVolumeControl?: boolean;
  allowWheel?: boolean;
}
const compProps = defineProps<Props>();
const playersToSync = ref<string[]>([]);
const playersToUnSync = ref<string[]>([]);
const timeOutId = ref<NodeJS.Timeout | undefined>(undefined);

const canExpand = computed(() => {
  return compProps.player.group_childs.length > 0;
});

const getVolumePlayers = function (player: Player) {
  const items: Player[] = [];
  // always include group_childs
  for (const groupChildId of player.group_childs) {
    const volumeChild = api?.players[groupChildId];
    if (!volumeChild) continue;
    if (volumeChild.volume_control == PLAYER_CONTROL_NONE) continue;
    if (volumeChild && volumeChild.available && !items.includes(volumeChild)) {
      items.push(volumeChild);
    }
  }
  // when groupcontrols are enabled, show all groupable players
  if (
    compProps.showSyncControls &&
    player.supported_features.includes(PlayerFeature.SET_MEMBERS)
  ) {
    for (const syncPlayer of Object.values(api?.players)) {
      if (syncPlayer.player_id == player.player_id) continue;
      if (
        !player.can_group_with.includes(syncPlayer.player_id) &&
        !player.can_group_with.includes(syncPlayer.provider)
      ) {
        continue;
      }
      // skip unavailable players
      if (!syncPlayer.available) continue;

      // skip if player has (another) group active
      if (
        syncPlayer.active_group &&
        syncPlayer.active_group != player.player_id
      )
        continue;

      // skip if player is already playing other content
      if (
        syncPlayer.active_source &&
        syncPlayer.playback_state == PlaybackState.PLAYING &&
        ![player.player_id, syncPlayer.player_id].includes(
          syncPlayer.active_source,
        )
      )
        continue;

      if (!items.includes(syncPlayer)) {
        items.push(syncPlayer);
      }
    }
  }
  items.sort((a, b) => (a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1));
  return items;
};

const syncCheckBoxChange = async function (
  syncPlayerId: string,
  value: boolean | null,
) {
  const parentPlayerId = compProps.player.player_id;

  if (value) {
    // add syncPlayerId to syncgroup
    if (playersToUnSync.value.includes(syncPlayerId)) {
      // remove syncPlayerId from the unSync list if needed
      playersToUnSync.value = playersToUnSync.value.filter(
        (x) => x != syncPlayerId,
      );
    }
    if (!playersToSync.value.includes(syncPlayerId)) {
      playersToSync.value.push(syncPlayerId);
    }
    // optimistically update player state
    api.players[parentPlayerId].group_childs.push(syncPlayerId);
  } else {
    // remove player from syncgroup
    if (playersToSync.value.includes(syncPlayerId)) {
      // remove syncPlayerId from the sync list if needed
      playersToSync.value = playersToSync.value.filter(
        (x) => x != syncPlayerId,
      );
    }
    if (!playersToUnSync.value.includes(syncPlayerId)) {
      playersToUnSync.value.push(syncPlayerId);
    }
    // optimistically update player state
    api.players[parentPlayerId].group_childs = api.players[
      parentPlayerId
    ].group_childs.filter((x) => x != syncPlayerId);
  }

  // clear existing debounce timer
  if (timeOutId.value != null) clearTimeout(timeOutId.value);

  // execute (un)sync with a debounce timer to account for someone
  // changing multiple checkboxes in quick succession

  timeOutId.value = setTimeout(async () => {
    if (playersToUnSync.value.length > 0) {
      // power off will also unsync
      api
        .playerCommandUnGroupMany(playersToUnSync.value)
        .catch(async () => {
          // restore state if command failed
          api.players[parentPlayerId] = await api.getPlayer(parentPlayerId);
        })
        .finally(() => {
          playersToUnSync.value = [];
        });
    }
    if (playersToSync.value.length > 0) {
      api
        .playerCommandGroupMany(parentPlayerId, playersToSync.value)
        .catch(async () => {
          // restore state if command failed
          api.players[parentPlayerId] = await api.getPlayer(parentPlayerId);
        })
        .finally(() => {
          playersToSync.value = [];
        });
    }
  }, 1000);
};
</script>

<style scoped>
.volumesliderrow {
  margin-top: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
  height: 30px;
  min-height: 30px;
}

.heading {
  margin-bottom: 5px;
  height: 35px;
}

.volumecaption {
  width: 28px;
  text-align: right;
  margin-right: -8px;
}

.expandbtn {
  margin-right: -12px;
}
.powerbtn {
  right: 8px;
}

.volumesliderrow :deep(.v-list-item__prepend) {
  width: 40px;
  margin-left: -25px;
}
.volumesliderrow :deep(.v-list-item__append) {
  width: 20px;
}

.checkbox {
  margin-right: -5px;
  width: 25px;
  margin-top: -30px;
  height: 22px !important;
  min-height: 22px !important;
  display: unset;
}

.syncbtn {
  margin-right: -32px;
  height: 25px !important;
  padding-bottom: 20px;
}
</style>
