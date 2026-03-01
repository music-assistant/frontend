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
    <!-- volume slider row with integrated mute + level -->
    <div
      v-if="showVolumeControl"
      class="volume-row"
      :style="player.powered == false ? 'opacity: 0.35' : 'opacity: 0.75'"
    >
      <PlayerVolume
        :player="player"
        :allow-wheel="allowWheel"
        :show-volume-level="!canExpand"
        :prefer-group-volume="true"
        :enable-popout="false"
        width="100%"
        @click.stop
      />
      <v-icon
        v-if="canExpand"
        variant="plain"
        :icon="showSubPlayers ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        class="expandbtn"
        @click.stop="$emit('toggle-expand', player)"
      />
    </div>

    <!-- (child) volume player rows -->
    <div
      v-if="
        showSubPlayers &&
        (player.group_members.length > 0 || showSyncControls) &&
        getChildPlayers(player).length > 0
      "
      @click.stop
    >
      <v-divider style="margin-top: 10px; margin-bottom: 15px" />

      <div
        v-for="childPlayer in getChildPlayers(player)"
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
              style="opacity: 0.6; margin-left: -4px; margin-right: 7px"
            />
          </template>
          <template #default>
            <h6>{{ truncateString(childPlayer.name, 27) }}</h6>
          </template>
          <template #append>
            <v-checkbox
              v-if="showSyncControls"
              :ripple="false"
              :disabled="
                childPlayer.player_id == player.player_id ||
                (player.static_group_members.includes(childPlayer.player_id) &&
                  player.group_members.includes(childPlayer.player_id))
              "
              :model-value="
                player.group_members.includes(childPlayer.player_id) ||
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
        <!-- volume slider with integrated mute + level -->
        <!-- only show if the child player is part of the group and has volume control -->
        <div
          v-if="
            player.group_members.includes(childPlayer.player_id) &&
            childPlayer.volume_control != PLAYER_CONTROL_NONE
          "
          class="volume-row child-volume-row"
          :style="
            childPlayer.powered == false ? 'opacity: 0.4' : 'opacity: 0.75'
          "
          @click.stop
        >
          <PlayerVolume
            :player="childPlayer"
            :allow-wheel="allowWheel"
            width="100%"
          />
        </div>
        <div style="height: 14px"></div>
      </div>
    </div>
  </v-list>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import { getPlayerName, truncateString } from "@/helpers/utils";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import { api } from "@/plugins/api";
import {
  Player,
  PLAYER_CONTROL_NONE,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
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

// emits
defineEmits<{
  (e: "toggle-expand", player: Player): void;
}>();

const canExpand = computed(() => {
  return compProps.player.group_members.length > 0;
});

const getChildPlayers = function (player: Player) {
  const items: Player[] = [];
  // always include group_childs
  for (const groupChildId of player.group_members) {
    const groupChild = api?.players[groupChildId];
    if (!groupChild) continue;
    if (groupChild && groupChild.available && !items.includes(groupChild)) {
      items.push(groupChild);
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
        !(
          player.can_group_with.includes(syncPlayer.player_id) ||
          // also allow grouping with same provider players even if not explicitly listed
          // this can be removed in a future version where the server handles this
          player.can_group_with.includes(syncPlayer.provider)
        )
      ) {
        continue;
      }
      // skip unavailable players
      if (!syncPlayer.available) continue;

      // skip for group players
      if (syncPlayer.type == PlayerType.GROUP) continue;

      // skip if player has (another) group active
      if (
        syncPlayer.active_group &&
        syncPlayer.active_group != player.player_id
      )
        continue;

      if (!items.includes(syncPlayer)) {
        items.push(syncPlayer);
      }
    }
  }
  // Sort: by name
  items.sort((a, b) => {
    return a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1;
  });
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
    api.players[parentPlayerId].group_members.push(syncPlayerId);
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
    api.players[parentPlayerId].group_members = api.players[
      parentPlayerId
    ].group_members.filter((x) => x != syncPlayerId);
  }

  // clear existing debounce timer
  if (timeOutId.value != null) clearTimeout(timeOutId.value);

  // execute (un)sync with a debounce timer to account for someone
  // changing multiple checkboxes in quick succession

  if (playersToSync.value.length == 0 && playersToUnSync.value.length == 0) {
    // no changes to be made, so return
    return;
  }

  timeOutId.value = setTimeout(async () => {
    api
      .playerCommandSetMembers(
        parentPlayerId,
        playersToSync.value.length ? playersToSync.value : undefined,
        playersToUnSync.value.length ? playersToUnSync.value : undefined,
      )
      .catch(async () => {
        // restore state if command failed
        api.players[parentPlayerId] = await api.getPlayer(parentPlayerId);
      })
      .finally(() => {
        playersToSync.value = [];
        playersToUnSync.value = [];
      });
  }, 500);
};
</script>

<style scoped>
.volumesliderrow {
  margin-top: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
  height: 40px;
  min-height: 40px;
}

.volumesliderrow :deep(.v-list-item__content) {
  height: 40px;
  min-height: 40px;
  overflow: visible !important;
  align-content: center;
}

.heading {
  margin-bottom: 5px;
  height: 35px;
}

.volume-row {
  display: flex;
  align-items: center;
  padding: 0 2px;
  min-height: 40px;
}

.volume-row :deep(.player-volume-container) {
  flex: 1;
  min-width: 0;
}

.child-volume-row {
  padding-left: 2px;
}

.expandbtn {
  flex-shrink: 0;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.powerbtn {
  right: 8px;
}

.volumesliderrow :deep(.v-list-item__prepend) {
  width: 36px;
  margin-left: -12px;
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
