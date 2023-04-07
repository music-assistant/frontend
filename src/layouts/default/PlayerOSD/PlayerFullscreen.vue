<template>
  <v-dialog
    v-model="store.showFullscreenPlayer"
    fullscreen
    :scrim="false"
    transition="dialog-bottom-transition"
  >
    <v-card
      :style="`background-image: linear-gradient(${$vuetify.theme.current.dark
        ? 'to bottom, rgba(0,0,0,.80), rgba(0,0,0,.75)'
        : 'to bottom, rgba(255,255,255,.85), rgba(255,255,255,.65)'
      } 100%), ${activePlayerQueue?.active ? `url(${fanartImage})` : undefined};
                                          background-size: cover; background-position: center; border: none;`"
    >
      <v-toolbar
        dark
        color="transparent"
      >
        <v-btn
          style="margin-left: 16px"
          icon
          @click="store.showFullscreenPlayer = false"
        >
          <v-icon icon="mdi-chevron-down" />
        </v-btn>
        <v-toolbar-title></v-toolbar-title>

        <v-spacer></v-spacer>
        <v-toolbar-items style="align-items: center">
          <PlayerExtendedControls
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
      <div class="main">
        <div style="margin-top: 10px; text-align: -webkit-center">
          <img
            v-if="curQueueItem"
            style="
              height: min(calc(100vw - 40px), calc(100vh - 330px));
              width: min(calc(100vw - 40px), calc(100vh - 330px));
            "
            alt="cover"
            :src="fanartImage"
          >

          <IconBase
            v-else
            style="opacity: 50%;"
            height="50"
            name="fallback"
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
                <QualityDetailsBtn />
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
                `${curQueueItem.media_item.name} ${curQueueItem.media_item.version
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
            @click="
              curQueueItem?.media_item
                ? itemClick(curQueueItem.media_item.artists[0])
                : ''
            "
          >
            <!-- track: artists(s) + album -->
            <h4
              v-if="
                curQueueItem && curQueueItem.media_item?.media_type == MediaType.TRACK &&
                  'album' in curQueueItem.media_item &&
                  curQueueItem.media_item.album
              "
              class="subtitle"
              @click="
                curQueueItem?.media_item ? itemClick(curQueueItem.media_item) : ''
              "
            >
              {{ getArtistsString(curQueueItem.media_item.artists) }} •
              {{ curQueueItem.media_item.album.name }}
            </h4>
            <!-- track/album falback: artist present -->
            <h4
              v-else-if="
                curQueueItem && curQueueItem.media_item &&
                  'artists' in curQueueItem.media_item &&
                  curQueueItem.media_item.artists.length > 0
              "
              class="subtitle"
              @click="
                curQueueItem?.media_item
                  ? itemClick(curQueueItem.media_item.artists[0])
                  : ''
              "
            >
              {{ curQueueItem.media_item.artists[0].name }}
            </h4>
            <!-- radio live metadata -->
            <h4
              v-else-if="curQueueItem?.streamdetails?.stream_title"
              class="subtitle"
            >
              {{ curQueueItem?.streamdetails?.stream_title }}
            </h4>
            <!-- other description -->
            <h4
              v-else-if="curQueueItem && curQueueItem.media_item?.metadata.description"
              class="subtitle"
            >
              {{ curQueueItem.media_item.metadata.description }}
            </h4>
            <!-- queue empty message -->
            <h4
              v-else-if="activePlayerQueue"
              class="subtitle"
            >
              {{ $t('queue_empty') }}
            </h4>
            <!-- 3rd party source active -->
            <h4
              v-else-if="store.selectedPlayer?.active_source != store.selectedPlayer?.player_id"
              class="subtitle"
            >
              {{ $t('external_source_active', [store.selectedPlayer?.active_source]) }}
            </h4>
          </div>
        </div>
        <div style="padding-top: 3vh">
          <!-- progress bar -->
          <PlayerTimeline
            :is-progress-bar="false"
            :is-hidden="false"
          />
          <!-- player control buttons -->
          <PlayerExtendedControls
            v-if="
              $vuetify.display.width <= getResponsiveBreakpoints.breakpoint_1
            "
            :responsive-volume-size="false"
            :button-visibility="{ player: false, volume: true, queue: false }"
            :volume-size="'100%'"
          />
        </div>

        <div style="padding-top: 1vh">
          <div class="mediacontrols">
            <div class="mediacontrols-top-right">
              <div
                v-if="
                  $vuetify.display.width > getResponsiveBreakpoints.breakpoint_1
                "
                class="mediacontrols-buttom-left"
              >
                <div>
                  <QualityDetailsBtn />
                </div>
              </div>
              <div class="mediacontrols-buttom-center">
                <!-- player control buttons -->
                <div>
                  <PlayerControls />
                </div>
              </div>
              <div
                v-if="
                  $vuetify.display.width > getResponsiveBreakpoints.breakpoint_1
                "
                class="mediacontrols-buttom-right"
              >
                <div>
                  <!-- player control buttons -->
                  <PlayerExtendedControls
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
import PlayerControls from './PlayerControls.vue';
import PlayerExtendedControls from './PlayerExtendedControls.vue';
import QualityDetailsBtn from './QualityDetailsBtn.vue';
import router from '@/plugins/router';
import MediaItemThumb, { getImageThumbForItem } from '@/components/MediaItemThumb.vue';
import api from '@/plugins/api';
import { MediaItemType, ImageType, PlayerState, MediaType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import { getArtistsString, getResponsiveBreakpoints } from '@/utils';
import PlayerTimeline from './PlayerTimeline.vue';

// local refs
const fanartImage = ref();

// computed properties
const activePlayerQueue = computed(() => {
    if (store.selectedPlayer) {
        return api.queues[store.selectedPlayer.active_source];
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
    params: { itemId: item.item_id, provider: item.provider },
  });
  store.showFullscreenPlayer = false;
};

// watchers
watch(
    () => curQueueItem.value?.queue_item_id,
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
.mediacontrols {
    display: table;
    width: 100%;
}

.mediacontrols-top-right {
    display: table-row;
}

.mediacontrols-buttom-left {
    display: table-cell;
    vertical-align: middle;
    width: 33.3333%;
}

.mediacontrols-buttom-center {
    display: table-cell;
    text-align: center;
    width: 33.3333%;
    vertical-align: middle;
}

.mediacontrols-buttom-right {
    display: table-cell;
    text-align: right;
    vertical-align: middle;
    width: 33.3333%;
}

.mediacontrols-buttom-right>div {
    display: inline-flex;
}

.title {
    font-size: 1.5em;
    word-wrap: break-word;
}

.subtitle {
    font-size: 0.9em;
    font-weight: 400;
    cursor: pointer;
    width: fit-content;
    display: inline
}

.main {

    background: transparent;
    padding: 0px max(15px, 3vw);
    transition: transform 1s cubic-bezier(0.18, 0, 0, 1), opacity 1s ease,
        filter 0.5s ease;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
}
</style>
  