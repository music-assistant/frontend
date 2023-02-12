<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <v-img
    class="bg-image"
    width="100%"
    cover
    :src="activePlayerQueue?.active ? fanartImage : undefined"
    :gradient="
      $vuetify.theme.current.dark
        ? 'to bottom, rgba(0,0,0,.80), rgba(0,0,0,.75)'
        : 'to bottom, rgba(255,255,255,.85), rgba(255,255,255,.65)'
    "
  />

  <PlayerTimeline
    :activePlayerQueue="activePlayerQueue"
    :isProgressBar="true"
    :isHidden="!isMobile()"
  />

  <div class="player-table">
    <div class="player-tr">
      <div
        :class="`player-dl-${
          $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1
            ? '1'
            : '2'
        }`"
      >
        <!-- now playing media -->
        <v-list-item style="width: 100%; padding: 0px">
          <!-- image -->
          <template #prepend>
            <PlayerFullscreen :show-fullscreen="store.showFullscreenPlayer" />
            <div v-if="curQueueItem" class="listitem-thumb">
              <MediaItemThumb
                :item="curQueueItem.media_item || curQueueItem"
                :min-size="'calc(30vw - 50px), calc(100vh - max(100px, 12vw))'"
                style="cursor: pointer"
                :img="
                  !activePlayerQueue?.active
                    ? $vuetify.theme.current.dark
                      ? darkCoverImg
                      : lightCoverImg
                    : ''
                "
                @click="store.showFullscreenPlayer = true"
              />
            </div>
          </template>

          <!-- title -->
          <template v-if="activePlayerQueue?.active && curQueueItem" #title>
            <span
              v-if="curQueueItem && curQueueItem.media_item"
              style="cursor: pointer"
              @click="
                curQueueItem?.media_item
                  ? itemClick(curQueueItem.media_item)
                  : ''
              "
            >
              {{ curQueueItem.media_item.name }}
              <span
                v-if="
                  'version' in curQueueItem.media_item &&
                  curQueueItem.media_item.version
                "
                >({{ curQueueItem.media_item.version }})</span
              >
            </span>
            <span v-else-if="curQueueItem">
              {{ curQueueItem.name }}
            </span>
          </template>

          <!-- subtitle -->
          <template v-if="activePlayerQueue?.active && curQueueItem" #subtitle>
            <!-- track: artists(s) -->
            <div
              v-if="
                curQueueItem &&
                curQueueItem.media_item?.media_type == MediaType.TRACK
              "
              style="cursor: pointer"
              @click="
                curQueueItem?.media_item
                  ? itemClick(curQueueItem.media_item.artists[0])
                  : ''
              "
            >
              <div class="citl">
                <div>
                  <div>
                    {{ getArtistsString(curQueueItem.media_item.artists, 3) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- track/album falback: artist present -->
            <div
              v-else-if="
                curQueueItem &&
                curQueueItem.media_item &&
                'artist' in curQueueItem.media_item &&
                curQueueItem.media_item.artist
              "
            >
              {{ curQueueItem.media_item.artist.name }}
            </div>
            <!-- radio live metadata -->
            <div v-else-if="curQueueItem?.streamdetails?.stream_title">
              {{ curQueueItem?.streamdetails?.stream_title }}
            </div>
            <!-- other description -->
            <div
              v-else-if="
                curQueueItem && curQueueItem.media_item?.metadata.description
              "
            >
              {{ curQueueItem.media_item.metadata.description }}
            </div>
          </template>
        </v-list-item>
      </div>
      <div
        :class="`player-dc-${
          $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1
            ? '1'
            : '2'
        }`"
      >
        <div style="width: 100%">
          <!-- player control buttons -->
          <PlayerControls
            :small-btn-icon="smallBtnIcon"
            :large-btn-icon="largeBtnIcon"
            :active-player-queue="activePlayerQueue"
            :button-visibility="buttonPCResponsive($vuetify.display)"
          />
          <!-- progress bar -->
          <PlayerTimeline
            :activePlayerQueue="activePlayerQueue"
            :isProgressBar="false"
            :isHidden="isMobile()"
          />
        </div>
      </div>
      <div class="player-dr">
        <div class="player-dr-inline">
          <!-- player mobile control buttons -->
          <PlayerControls
            style="padding-right: 5px"
            :small-btn-icon="smallBtnIcon"
            :large-btn-icon="largeBtnIcon"
            :active-player-queue="activePlayerQueue"
            :button-visibility="{
              repeat: false,
              shuffle: false,
              play:
                $vuetify.display.width < getResponsiveBreakpoints.breakpoint_1,
              previous: false,
              next: false,
            }"
          />
          <!-- player extended control buttons -->
          <PlayerExtendedControls
            :small-btn-icon="smallBtnIcon"
            :active-player-queue="activePlayerQueue"
            :button-visibility="buttonPCEResponsive($vuetify.display)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { watchEffect, ref, computed, watch } from 'vue';
import type { MediaItemType } from '../../plugins/api';
import { api, PlayerState, MediaType, ImageType } from '../../plugins/api';
import { store } from '../../plugins/store';
import MediaItemThumb, {
  darkCoverImg,
  getImageThumbForItem,
  lightCoverImg,
} from '../MediaItemThumb.vue';
import PlayerTimeline from '../../components/PlayerOSD/PlayerTimeline.vue';
import {
  getArtistsString,
  getResponsiveBreakpoints,
  isMobile,
} from '../../utils';
import { useRouter } from 'vue-router';

import PlayerControls from './PlayerControls.vue';
import PlayerExtendedControls from './PlayerExtendedControls.vue';
import PlayerFullscreen from './PlayerFullscreen.vue';

const router = useRouter();

// local refs
const fanartImage = ref();
const smallBtnIcon = ref({ button: 40, icon: 22 });
const largeBtnIcon = ref({ button: 60, icon: 50 });

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_queue];
  }
  return undefined;
});
const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});

// methods
const itemClick = function (item: MediaItemType) {
  router.push({
    name: item.media_type,
    params: { item_id: item.item_id, provider: item.provider },
  });
};

const buttonPCEResponsive = function (displayOptions: any) {
  return {
    queue: displayOptions.width >= getResponsiveBreakpoints.breakpoint_1,
    player: true,
    volume: displayOptions.width >= getResponsiveBreakpoints.breakpoint_8,
  };
};

const buttonPCResponsive = function (displayOptions: any) {
  return {
    repeat: displayOptions.width >= getResponsiveBreakpoints.breakpoint_1,
    shuffle: displayOptions.width >= getResponsiveBreakpoints.breakpoint_1,
    play: true,
    previous: displayOptions.width >= getResponsiveBreakpoints.breakpoint_1,
    next: displayOptions.width >= getResponsiveBreakpoints.breakpoint_1,
  };
};

// watchers
watch(
  () => curQueueItem.value?.item_id,
  async () => {
    if (curQueueItem.value?.media_item) {
      fanartImage.value =
        (await getImageThumbForItem(
          curQueueItem.value.media_item,
          ImageType.FANART
        )) ||
        (await getImageThumbForItem(
          curQueueItem.value.media_item,
          ImageType.THUMB
        ));
    }
  }
);

watch(
  () => store.selectedPlayer,
  (newVal) => {
    if (newVal) localStorage.setItem('mass.LastPlayerId', newVal.player_id);
  }
);

watchEffect(async () => {
  // pick default/start player at startup
  const lastPlayerId = localStorage.getItem('mass.LastPlayerId');
  if (lastPlayerId) {
    if (lastPlayerId in api.players) {
      store.selectedPlayer = api.players[lastPlayerId];
      return;
    }
  }
  if (api?.players && !store.selectedPlayer) {
    // prefer playing player
    for (const playerId in api?.players) {
      const player = api.players[playerId];
      if (player.state == PlayerState.PLAYING) {
        store.selectedPlayer = player;
        return;
      }
    }
    // fallback to just a player with item in queue
    for (const playerId in api?.queues) {
      const player = api.players[playerId];
      if (player.elapsed_time) {
        store.selectedPlayer = player;
        return;
      }
    }
    // last resort: just the first queue
    for (const playerId in api?.queues) {
      store.selectedPlayer = api.players[playerId];
      return;
    }
  }
});
</script>

<style scoped>
.bg-image {
  /* Add the blur effect */
  filter: blur(20px);
  -webkit-filter: blur(20px);
  /* Center and scale the image nicely */
  background-position: center;
  background-size: cover;
  position: absolute;
  background-size: 100%;
  padding: 0;
}

.player-table {
  display: table;
  width: 100%;
  padding: 0px 15px 0px 25px;
}

.player-tr {
  display: table-row;
}

.player-dl-1 {
  display: table-cell;
  vertical-align: middle;
  width: 25%;
}

.player-dl-2 {
  display: table-cell;
  vertical-align: middle;
}

.player-dc-1 {
  display: table-cell;
  text-align: center;
  width: 50%;
  vertical-align: middle;
}

.player-dc-2 {
  display: none;
  width: 33.333%;
}

.player-dr {
  display: table-cell;
  text-align: right;
  vertical-align: middle;
}

.player-dr-inline {
  display: inline-flex;
  align-items: center;
}
</style>
