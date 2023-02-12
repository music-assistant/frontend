<template>
  <v-dialog
    v-if="curQueueItem"
    v-model="store.showFullscreenPlayer"
    fullscreen
    :scrim="false"
    transition="dialog-bottom-transition"
  >
    <v-card
      :style="`background-image: linear-gradient(${
        $vuetify.theme.current.dark
          ? 'to bottom, rgba(0,0,0,.80), rgba(0,0,0,.75)'
          : 'to bottom, rgba(255,255,255,.85), rgba(255,255,255,.65)'
      } 100%), ${activePlayerQueue?.active ? `url(${fanartImage})` : undefined};
    background-size: cover; background-position: center; border: none;`"
    >
      <v-toolbar dark color="transparent">
        <v-btn
          style="margin-left: 16px"
          icon
          @click="store.showFullscreenPlayer = false"
        >
          <v-icon :icon="mdiChevronDown" />
        </v-btn>
        <v-toolbar-title></v-toolbar-title>

        <v-spacer></v-spacer>
        <v-toolbar-items style="align-items: center">
          <PlayerExtendedControls
            :small-btn-icon="{ button: 48, icon: 24 }"
            :active-player-queue="activePlayerQueue"
            :show-queue-dialog="true"
            :button-visibility="{
              queue:
                $vuetify.display.width <= getResponsiveBreakpoints.breakpoint_1,
              player: false,
              volume: false,
            }"
          />
        </v-toolbar-items>
      </v-toolbar>
      <div
        style="
          background: transparent;
          padding: 0px max(15px, 3vw);
          transition: transform 1s cubic-bezier(0.18, 0, 0, 1), opacity 1s ease,
            filter 0.5s ease;
        "
      >
        <div style="margin-top: 10px; text-align: -webkit-center">
          <MediaItemThumb
            style="
              height: min(calc(100vw - 40px), calc(100vh - 330px));
              width: min(calc(100vw - 40px), calc(100vh - 330px));
            "
            :img="
              !activePlayerQueue?.active
                ? $vuetify.theme.current.dark
                  ? darkCoverImg
                  : lightCoverImg
                : ''
            "
            :item="curQueueItem.media_item || curQueueItem"
            :max-size="640"
            :size="512"
          />
        </div>

        <div style="padding-top: 3vh; text-align: center">
          <!-- title -->
          <div v-if="curQueueItem.media_item">
            <div
              v-if="
                $vuetify.display.width <= getResponsiveBreakpoints.breakpoint_1
              "
            >
              <div style="float: right">
                <PlayerExtendedControls
                  :small-btn-icon="smallBtnIcon"
                  :active-player-queue="activePlayerQueue"
                  :responsive-volume-size="true"
                  :button-visibility="{
                    queue: false,
                    player: true,
                    volume: false,
                  }"
                  @click="store.showFullscreenPlayer = false"
                />
              </div>
              <div style="float: left; height: 48px">
                <QualityDetailsBtn
                  :active-player-queue="activePlayerQueue"
                  :small-btn-icon="smallBtnIcon"
                />
              </div>
            </div>
            <h1
              v-if="activePlayerQueue?.active && curQueueItem"
              style="cursor: pointer; width: fit-content; display: inline"
              class="title"
              @click="
                curQueueItem?.media_item
                  ? itemClick(curQueueItem.media_item)
                  : ''
              "
            >
              {{
                `${curQueueItem.media_item.name} ${
                  curQueueItem.media_item.version
                    ? '(' + curQueueItem.media_item.version + ')'
                    : ''
                }`
              }}
            </h1>
          </div>
          <!-- subtitle -->
          <!-- track: artists(s) -->
          <div
            v-if="
              activePlayerQueue?.active &&
              curQueueItem &&
              curQueueItem.media_item?.media_type == MediaType.TRACK
            "
          >
            <h4
              style="cursor: pointer; width: fit-content; display: inline"
              class="subtitle"
              @click="
                curQueueItem?.media_item
                  ? itemClick(curQueueItem.media_item.artists[0])
                  : ''
              "
            >
              {{ getArtistsString(curQueueItem.media_item.artists, 3) }}
            </h4>
          </div>
        </div>
        <div style="padding-top: 3vh">
          <!-- progress bar -->
          <PlayerTimeline
            :activePlayerQueue="activePlayerQueue"
            :isProgressBar="false"
            :isHidden="false"
          />
          <!-- player control buttons -->
          <PlayerExtendedControls
            v-if="
              $vuetify.display.width <= getResponsiveBreakpoints.breakpoint_1
            "
            :small-btn-icon="smallBtnIcon"
            :active-player-queue="activePlayerQueue"
            :responsive-volume-size="false"
            :button-visibility="{ player: false, volume: true, queue: false }"
            :volume-size="'100%'"
          />
        </div>

        <div style="padding-top: 1vh">
          <div class="player-table">
            <div class="player-tr">
              <div
                v-if="
                  $vuetify.display.width > getResponsiveBreakpoints.breakpoint_1
                "
                class="player-dl"
              >
                <div>
                  <QualityDetailsBtn
                    :active-player-queue="activePlayerQueue"
                    :small-btn-icon="smallBtnIcon"
                  />
                </div>
              </div>
              <div class="player-dc">
                <!-- player control buttons -->
                <div>
                  <PlayerControls
                    :small-btn-icon="smallBtnIcon"
                    :large-btn-icon="largeBtnIcon"
                    :active-player-queue="activePlayerQueue"
                  />
                </div>
              </div>
              <div
                v-if="
                  $vuetify.display.width > getResponsiveBreakpoints.breakpoint_1
                "
                class="player-dr"
              >
                <div class="player-dr-inline">
                  <!-- player control buttons -->
                  <PlayerExtendedControls
                    :small-btn-icon="smallBtnIcon"
                    :active-player-queue="activePlayerQueue"
                    :responsive-volume-size="true"
                    :show-queue-dialog="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { mdiChevronDown } from '@mdi/js';

import { watchEffect, ref, computed, watch } from 'vue';
import {
  api,
  PlayerState,
  MediaType,
  ImageType,
  type MediaItemType,
} from '../../plugins/api';
import { store } from '../../plugins/store';
import MediaItemThumb, {
  darkCoverImg,
  getImageThumbForItem,
  lightCoverImg,
} from '../MediaItemThumb.vue';
import PlayerTimeline from '../../components/PlayerOSD/PlayerTimeline.vue';
import { getArtistsString, getResponsiveBreakpoints } from '../../utils';
import PlayerControls from './PlayerControls.vue';
import PlayerExtendedControls from './PlayerExtendedControls.vue';
import QualityDetailsBtn from './QualityDetailsBtn.vue';
import router from '@/plugins/router';

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
  store.showFullscreenPlayer = false;
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
.player-table {
  display: table;
  width: 100%;
}

.player-tr {
  display: table-row;
}

.player-dl {
  display: table-cell;
  vertical-align: middle;
  width: 33.3333%;
}

.player-dc {
  display: table-cell;
  text-align: center;
  width: 33.3333%;
  vertical-align: middle;
}

.player-dr {
  display: table-cell;
  text-align: right;
  vertical-align: middle;
  width: 33.3333%;
}

.player-dr-inline {
  display: inline-flex;
}

.title {
  font-size: 1.5em;
  word-wrap: break-word;
}

.subtitle {
  font-size: 0.9em;
  font-weight: 400;
}
</style>
