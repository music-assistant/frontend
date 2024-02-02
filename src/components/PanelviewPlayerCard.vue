<template>
  <v-card
    class="panel-item"
    :class="{
      'panel-item-selected':
        activePlayer && player && activePlayer.player_id == player.player_id,
    }"
  >
    <!-- now playing media -->
    <ListItem class="panel-item-details">
      <template #prepend>
        <div
          class="media-thumb player-media-thumb"
          :style="`height: ${
            getBreakpointValue({ breakpoint: 'phone' }) ? 50 : 64
          }px; width: ${
            getBreakpointValue({ breakpoint: 'phone' }) ? 50 : 64
          }px; `"
        >
          <MediaItemThumb
            :item="curQueueItem?.media_item || curQueueItem"
            :fallback="imgCoverDark"
            style="cursor: pointer"
          />
        </div>
      </template>

      <!-- title -->
      <template #title>
        <div
          :style="{
            cursor: 'pointer',
          }"
        >
          <div v-if="curQueueItem && curQueueItem.media_item">
            {{ curQueueItem.media_item.name }}
            <span
              v-if="
                'version' in curQueueItem.media_item &&
                curQueueItem.media_item.version
              "
              >({{ curQueueItem.media_item.version }})</span
            >
          </div>
          <div v-else-if="curQueueItem">
            {{ curQueueItem.name }}
          </div>
          <div v-else>
            {{ playerQueue && playerQueue.display_name }}
          </div>
        </div>
      </template>

      <!-- subtitle -->
      <template #subtitle>
        <!-- track: artists(s) + album -->
        <div
          :style="{
            cursor: 'pointer',
          }"
          class="line-clamp-1"
        >
          <div
            v-if="
              curQueueItem &&
              curQueueItem.media_item?.media_type == MediaType.TRACK &&
              'album' in curQueueItem.media_item &&
              curQueueItem.media_item.album
            "
          >
            {{ getArtistsString(curQueueItem.media_item.artists) }} •
            {{ curQueueItem.media_item.album.name }}
          </div>
          <!-- track/album fallback: artist present -->
          <div
            v-else-if="
              curQueueItem &&
              curQueueItem.media_item &&
              'artists' in curQueueItem.media_item &&
              curQueueItem.media_item.artists.length > 0
            "
          >
            {{ curQueueItem.media_item.artists[0].name }}
          </div>
          <!-- radio live metadata -->
          <div
            v-else-if="curQueueItem?.streamdetails?.stream_title"
            class="line-clamp-1"
          >
            {{ curQueueItem?.streamdetails?.stream_title }}
          </div>
          <!-- other description -->
          <div
            v-else-if="
              curQueueItem && curQueueItem.media_item?.metadata.description
            "
            class="line-clamp-1"
          >
            {{ curQueueItem.media_item.metadata.description }}
          </div>
          <!-- queue empty message -->
          <div
            v-else-if="playerQueue && playerQueue.items == 0"
            class="line-clamp-1"
          >
            {{ $t("queue_empty") }}
          </div>
          <!-- 3rd party source active -->
          <div
            v-else-if="
              store.selectedPlayer?.active_source !=
              store.selectedPlayer?.player_id
            "
            class="line-clamp-1"
          >
            {{
              $t("external_source_active", [
                store.selectedPlayer?.active_source,
              ])
            }}
          </div>
        </div>
      </template>
      <!-- player -->
      <template #default>
        <div
          :style="{
            cursor: 'pointer',
          }"
        >
          <div>
            on
            <span
              :style="{
                cursor: 'pointer',
                fontWeight: 'bold',
              }"
            >
              {{ player && player.display_name }}
            </span>
          </div>
        </div>
      </template>
      <!-- play button -->
      <template #append>
        <v-btn
          class="ms-2"
          icon
          variant="text"
          @click="api.queueCommandPlayPause(player_queue.queue_id)"
        >
          <v-icon v-if="player_queue.state == PlayerState.PLAYING"
            >mdi-pause-circle-outline</v-icon
          >
          <v-icon v-else>mdi-play-circle-outline</v-icon>
        </v-btn>
      </template>
    </ListItem>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import api from "@/plugins/api";
import {
  MediaType,
  PlayerQueue,
  Player,
  PlayerState,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";
import ListItem from "@/components/mods/ListItem.vue";
import { imgCoverDark } from "@/components/QualityDetailsBtn.vue";

import { getArtistsString } from "@/helpers/utils";

var player_queue: PlayerQueue;
// properties
export interface Props {
  player?: Player;
  playerQueue?: PlayerQueue;
}

const props = withDefaults(defineProps<Props>(), {
  player: undefined,
  playerQueue: undefined,
});

const showSettingDots = ref(false);

const curQueueItem = computed(() => {
  if (props.player) {
    player_queue = api.queues[props.player.active_source];
  }
  if (player_queue) {
    return player_queue.current_item;
  }
  return undefined;
});

const activePlayer = computed(() => {
  if (store.selectedPlayer) {
    return store.selectedPlayer;
  }
  return undefined;
});
</script>

<style>
.panel-item {
  height: 100%;
  padding: 10px;
  border: none;
  border-style: none !important;
}

.panel-item-selected {
  background-image: linear-gradient(90deg, lightgrey 0%, white 35%);
}

.panel-item-details {
  align-items: center;
  margin-left: 0px !important;
  padding-left: 0px !important;
  padding-right: 0px !important;
}
</style>
