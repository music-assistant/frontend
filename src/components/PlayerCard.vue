<template>
  <v-card
    flat
    class="panel-item"
    :class="{
      'panel-item-selected': player.player_id == store.activePlayerId,
      'panel-item-idle': player.state == PlayerState.IDLE,
      'panel-item-off': player.powered == false,
    }"
    :ripple="false"
    :disabled="!player.available"
  >
    <!-- now playing media -->
    <v-list-item class="panel-item-details" flat :ripple="false">
      <!-- prepend: media thumb -->
      <template #prepend>
        <div class="player-media-thumb">
          <MediaItemThumb
            v-if="
              (player.powered != false && curQueueItem?.media_item) ||
              curQueueItem?.image
            "
            class="media-thumb"
            size="55"
            :item="curQueueItem?.media_item || curQueueItem"
            :fallback="imgCoverDark"
          />
          <div
            v-else-if="
              player.powered != false &&
              !playerQueue &&
              player.current_media?.image_url
            "
          >
            <v-img
              class="media-thumb"
              size="55"
              :src="player.current_media.image_url"
            />
          </div>
          <div v-else class="icon-thumb">
            <v-icon
              size="35"
              :icon="
                player.type == PlayerType.PLAYER && player.group_childs.length
                  ? 'mdi-speaker-multiple'
                  : player.icon
              "
              style="display: table-cell; opacity: 0.8"
            />
          </div>
        </div>
      </template>

      <!-- playername -->
      <template #title>
        <div style="margin-bottom: 3px">
          {{ getPlayerName(player, 27) }}
          <v-icon
            v-if="webPlayer.player_id === player.player_id"
            size="20"
            class="pl-2"
          >
            mdi-monitor</v-icon
          >
        </div>
      </template>

      <!-- subtitle: media item title -->
      <template #subtitle>
        <div
          v-if="player.powered != false"
          style="font-size: 0.85rem; font-weight: 500; white-space: nowrap"
        >
          <div v-if="curQueueItem?.media_item">
            {{ curQueueItem?.media_item.name }}
            <span
              v-if="
                'version' in curQueueItem?.media_item &&
                curQueueItem?.media_item.version
              "
              >({{ curQueueItem?.media_item.version }})</span
            >
          </div>
          <div v-else-if="curQueueItem">
            {{ curQueueItem?.name }}
          </div>
          <div v-else-if="!playerQueue && player.current_media?.title">
            {{ player.current_media.title }}
          </div>
        </div>
      </template>

      <!-- subtitle -->
      <template #default>
        <div class="v-list-item-subtitle" style="white-space: nowrap">
          <!-- player powered off -->
          <div v-if="player.powered == false">
            {{ $t("off") }}
          </div>
          <!-- track: artists(s) + album -->
          <div
            v-else-if="
              curQueueItem?.media_item &&
              curQueueItem?.media_item?.media_type == MediaType.TRACK &&
              'album' in curQueueItem?.media_item &&
              curQueueItem?.media_item.album
            "
          >
            {{ getArtistsString(curQueueItem?.media_item.artists) }} •
            {{ curQueueItem?.media_item.album.name }}
          </div>
          <!-- track fallback: (only artist, no album) -->
          <div
            v-else-if="
              curQueueItem?.media_item &&
              'artists' in curQueueItem?.media_item &&
              curQueueItem?.media_item.artists.length > 0
            "
          >
            {{ curQueueItem?.media_item.artists[0].name }}
          </div>
          <!-- radio live metadata -->
          <div v-else-if="curQueueItem?.streamdetails?.stream_title">
            {{ curQueueItem?.streamdetails?.stream_title }}
          </div>
          <!-- other description -->
          <div v-else-if="curQueueItem?.media_item?.metadata.description">
            {{ curQueueItem?.media_item.metadata.description }}
          </div>
          <!-- 3rd party source active -->
          <div v-else-if="!playerQueue && player.active_source">
            {{ $t("external_source_active", [getSourceName(player)]) }}
          </div>
          <!-- queue empty message -->
          <div v-else-if="playerQueue?.items == 0">
            {{ $t("queue_empty") }}
          </div>
        </div>
      </template>

      <!-- power/play/pause + menu button -->
      <template #append>
        <!-- play/pause button -->
        <Button
          v-if="
            player.state == PlayerState.PAUSED ||
            player.state == PlayerState.PLAYING ||
            playerQueue?.items
          "
          variant="icon"
          class="player-command-btn"
          @click.stop="
            api.playerCommandPlayPause(player.player_id);
            store.activePlayerId = player.player_id;
          "
          ><v-icon
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '30' : '32'"
            :icon="
              player.state == PlayerState.PLAYING ? 'mdi-pause' : 'mdi-play'
            "
        /></Button>
        <!-- power button -->
        <Button
          v-if="player.power_control != PLAYER_CONTROL_NONE"
          variant="icon"
          class="player-command-btn"
          @click.stop="
            api.playerCommandPowerToggle(player.player_id);
            store.activePlayerId = player.player_id;
          "
          ><v-icon
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '30' : '32'"
            >mdi-power</v-icon
          ></Button
        >

        <!-- menu button -->
        <Button
          v-if="showMenuButton"
          variant="icon"
          class="player-command-btn"
          style="margin-right: -5px"
          @click.stop="openPlayerMenu"
        >
          <v-icon
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '30' : '32'"
            >mdi-dots-vertical</v-icon
          >
        </Button>
      </template>
    </v-list-item>
    <VolumeControl
      v-if="showVolumeControl"
      :player="player"
      :show-sync-controls="showSyncControls"
      :show-heading-row="false"
      :show-sub-players="showSubPlayers"
      :show-volume-control="player.powered != false"
      :allow-wheel="false"
    />
  </v-card>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import {
  MediaType,
  Player,
  PlayerState,
  PlayerType,
  PLAYER_CONTROL_NONE,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { imgCoverDark } from "@/components/QualityDetailsBtn.vue";
import { getArtistsString } from "@/helpers/utils";
import { computed } from "vue";
import { getPlayerName } from "@/helpers/utils";
import Button from "@/components/mods/Button.vue";
import VolumeControl from "@/components/VolumeControl.vue";
import { eventbus } from "@/plugins/eventbus";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import { getSourceName } from "@/plugins/api/helpers";
import { webPlayer } from "@/plugins/web_player";
// properties
export interface Props {
  player: Player;
  showVolumeControl?: boolean;
  showMenuButton?: boolean;
  showSubPlayers?: boolean;
  showSyncControls?: boolean;
}
const compProps = defineProps<Props>();

const playerQueue = computed(() => {
  if (
    compProps.player &&
    compProps.player.active_source &&
    compProps.player.active_source in api.queues
  ) {
    return api.queues[compProps.player.active_source];
  }
  if (
    compProps.player &&
    !compProps.player.active_source &&
    compProps.player.player_id in api.queues
  ) {
    return api.queues[compProps.player.player_id];
  }
  return undefined;
});
const curQueueItem = computed(() => {
  if (playerQueue.value && playerQueue.value.active)
    return playerQueue.value.current_item;
  return undefined;
});

const openPlayerMenu = function (evt: Event) {
  console.log("openPlayerMenu");
  eventbus.emit("contextmenu", {
    items: getPlayerMenuItems(compProps.player, playerQueue.value),
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};
</script>

<style scoped>
.v-card {
  transition: opacity 0.4s ease-in-out;
  border-radius: 6px;
  margin: 5px;
  margin-bottom: 10px;
}
.panel-item {
  height: 100%;
  border-style: ridge;
  border-width: thin;
  border-color: #cccccc5e;
  padding: 10px;
  background-color: rgba(162, 188, 255, 0.1);
  opacity: 1;
}

.panel-item-idle {
  opacity: 0.8;
}

.panel-item-off {
  opacity: 0.6;
}

.panel-item-selected {
  border-color: #2f2f2f5e;
  background-color: rgba(162, 188, 255, 0.4);
}

.panel-item-details {
  align-items: center;
  margin-left: 0px !important;
  padding-left: 0px !important;
  padding-right: 0px !important;
}

.volumesliderrow {
  margin-top: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
  height: 24px;
  min-height: 24px;
}

.volumecaption {
  width: 25px;
  text-align: right;
  margin-right: 0px;
}

.volumesliderrow :deep(.v-list-item__prepend) {
  width: 40px;
  margin-left: -25px;
}
.volumesliderrow :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}

.media-thumb {
  width: 55px;
  height: 55px;
  margin-top: 5px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.3);
}

.icon-thumb {
  width: 55px;
  height: 55px;
  margin-top: 5px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.3);
  display: inline-table;
}

.player-command-btn {
  width: 35px;
  min-width: 35px;
  margin-left: 5px;
}
</style>
