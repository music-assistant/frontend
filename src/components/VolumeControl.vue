<template>
  <div style="overflow: hidden; padding: 0">
    <!-- main (or group) volume/power -->
    <!-- mute btn + player name + optional sync checkbox-->
    <div
      v-if="showHeadingRow"
      class="volumesliderrow heading"
      :style="player.powered == false ? 'opacity: 0.6' : 'opacity: 1'"
    >
      <div class="volumesliderrow-prepend">
        <span
          class="mdi"
          :class="player.icon"
          style="font-size: 25px; margin-left: 6px; opacity: 0.6"
        ></span>
      </div>
      <div class="volumesliderrow-content">
        <h5>{{ getPlayerName(player, 27) }}</h5>
      </div>
      <div class="volumesliderrow-append">
        <!-- power button -->
        <Button
          v-if="player.power_control != PLAYER_CONTROL_NONE"
          class="powerbtn"
          variant="ghost"
          size="icon-sm"
          @click.stop="api.playerCommandPowerToggle(player.player_id)"
        >
          <Power class="h-5 w-5" />
        </Button>
      </div>
    </div>
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
      <button
        v-if="canExpand"
        class="expandbtn"
        @click.stop="$emit('toggle-expand', player)"
      >
        <ChevronUp v-if="showSubPlayers" class="h-5 w-5" />
        <ChevronDown v-else class="h-5 w-5" />
      </button>
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
      <Separator class="my-1" />

      <div
        v-for="childPlayer in getChildPlayers(player)"
        :key="childPlayer.player_id"
      >
        <!-- player icon + player name + optional sync checkbox-->
        <div
          class="volumesliderrow"
          :style="
            childPlayer.powered != false || showSyncControls
              ? 'opacity: 0.75'
              : 'opacity: 0.4'
          "
          @click.stop
        >
          <div class="volumesliderrow-prepend child-prepend">
            <span
              class="mdi"
              :class="childPlayer.icon"
              style="
                font-size: 30px;
                opacity: 0.6;
                margin-left: -4px;
                margin-right: 7px;
              "
            ></span>
          </div>
          <div class="volumesliderrow-content">
            <h6>{{ truncateString(childPlayer.name, 27) }}</h6>
          </div>
          <div class="volumesliderrow-append">
            <Checkbox
              v-if="showSyncControls"
              class="checkbox"
              :disabled="
                childPlayer.player_id == player.player_id ||
                (player.static_group_members.includes(childPlayer.player_id) &&
                  player.group_members.includes(childPlayer.player_id))
              "
              :checked="
                player.group_members.includes(childPlayer.player_id) ||
                childPlayer.player_id == player.player_id
              "
              @update:checked="
                syncCheckBoxChange(childPlayer.player_id, $event)
              "
            />
          </div>
        </div>
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
        <div style="height: 6px"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getPlayerName, truncateString } from "@/helpers/utils";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import { api } from "@/plugins/api";
import {
  Player,
  PLAYER_CONTROL_NONE,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { ChevronDown, ChevronUp, Power } from "lucide-vue-next";
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
  display: flex;
  align-items: center;
  margin-top: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
  height: 36px;
  min-height: 36px;
}

.volumesliderrow-prepend {
  width: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.volumesliderrow-content {
  flex: 1;
  min-width: 0;
  height: 36px;
  min-height: 36px;
  overflow: visible;
  display: flex;
  align-items: center;
}

.volumesliderrow-append {
  width: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.child-prepend {
  margin-left: -12px;
}

.heading {
  margin-bottom: 5px;
  height: 35px;
}

.volume-row {
  display: flex;
  align-items: center;
  padding: 0 2px;
  margin-top: 0px;
  min-height: 32px;
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
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  padding: 0;
}

.powerbtn {
  right: 8px;
}

.checkbox {
  margin-right: -5px;
}

.syncbtn {
  margin-right: -32px;
  height: 25px !important;
  padding-bottom: 20px;
}
</style>

<style>
.volume-row .player-volume-container {
  flex: 1;
  min-width: 0;
}
</style>
