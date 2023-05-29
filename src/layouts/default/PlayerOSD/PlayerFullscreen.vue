<template>
  <v-dialog v-model="store.showFullscreenPlayer" fullscreen :scrim="false" transition="dialog-bottom-transition">
    <v-card
      :style="{
        backgroundColor: `${coverImageColorCode}`,
      }"
    >
      <v-toolbar color="transparent">
        <template #prepend>
          <Button variant="icon" @click="store.showFullscreenPlayer = false">
            <v-icon icon="mdi-chevron-down" />
          </Button>
        </template>

        <template #default>
          <h3>Currently Playing</h3>
        </template>

        <template #append>
          <Button variant="icon">
            <v-icon icon="mdi-dots-vertical" />
          </Button>
        </template>
      </v-toolbar>

      <v-container class="fullscreen-container">
        <div class="fullscreen-media-space"></div>
        <div class="fullscreen-row-centered">
          <MediaItemThumb
            v-if="curQueueItem"
            :item="curQueueItem.media_item || curQueueItem"
            :width="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) ? 512 : 1024"
            :height="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) ? 512 : 1024"
            style="
              height: min(calc(100vw - 40px), calc(100vh - 340px));
              width: min(calc(100vw - 40px), calc(100vh - 340px));
            "
          />
          <v-img
            v-else
            :src="defaultImage"
            style="
              height: min(calc(100vw - 40px), calc(100vh - 340px));
              width: min(calc(100vw - 40px), calc(100vh - 340px));
            "
          />
        </div>
        <div class="fullscreen-row">
          <div class="fullscreen-track-info" v-if="curQueueItem && curQueueItem.media_item">
            <!-- title -->
            <h2 style="cursor: pointer; width: fit-content; display: inline" class="title line-clamp-1">
              <!-- name + version (if present) -->
              <TextAnimation
                :duration="20"
                :text="`${curQueueItem.media_item.name} ${
                  'version' in curQueueItem.media_item && curQueueItem.media_item.version
                    ? '(' + curQueueItem.media_item.version + ')'
                    : ''
                }`"
              />
            </h2>

            <!-- subtitle -->
            <!-- track: artists(s) -->
            <div v-if="curQueueItem">
              <!-- track/album falback: artist present -->
              <h4
                v-if="
                curQueueItem.media_item &&
                  curQueueItem.media_item?.media_type == MediaType.TRACK &&
                  (curQueueItem.media_item as Track).artists.length > 0
              "
                class="fullscreen-track-info-subtitle"
              >
                {{ (curQueueItem.media_item as Track).artists[0].name }}
              </h4>
              <!-- radio live metadata -->
              <h4 v-else-if="curQueueItem?.streamdetails?.stream_title" class="fullscreen-track-info-subtitle">
                {{ curQueueItem?.streamdetails?.stream_title }}
              </h4>
              <!-- other description -->
              <h4
                v-else-if="curQueueItem && curQueueItem.media_item?.metadata.description"
                class="fullscreen-track-info-subtitle"
              >
                {{ curQueueItem.media_item.metadata.description }}
              </h4>
              <!-- queue empty message -->
              <h4 v-else-if="activePlayerQueue && activePlayerQueue.items == 0" class="fullscreen-track-info-subtitle">
                {{ $t('queue_empty') }}
              </h4>
              <!-- 3rd party source active -->
              <h4
                v-else-if="store.selectedPlayer?.active_source != store.selectedPlayer?.player_id"
                class="fullscreen-track-info-subtitle"
              >
                {{ $t('external_source_active', [store.selectedPlayer?.active_source]) }}
              </h4>
            </div>
          </div>
        </div>
        <div class="fullscreen-row" style="margin-right: 8px">
          <PlayerTimeline :is-progress-bar="false" />
        </div>
        <div v-if="false">
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${store.coverImageColorCode[0]}`,
            }"
          ></div>
          <a style="color: #000"> {{ store.coverImageColorCode[0] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${store.coverImageColorCode[1]}`,
            }"
          ></div>
          <a style="color: #000"> {{ store.coverImageColorCode[1] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${store.coverImageColorCode[2]}`,
            }"
          ></div>
          <a style="color: #000"> {{ store.coverImageColorCode[2] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${store.coverImageColorCode[3]}`,
            }"
          ></div>
          <a style="color: #000"> {{ store.coverImageColorCode[3] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${store.coverImageColorCode[4]}`,
            }"
          ></div>
          <a style="color: #000"> {{ store.coverImageColorCode[4] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${store.coverImageColorCode.darkColor}`,
            }"
          ></div>
          <a style="color: #000"> DarkColor </a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${store.coverImageColorCode.lightColor}`,
            }"
          ></div>
          <a style="color: #000"> LightColor </a>
        </div>
        <div class="fullscreen-row">
          <PlayerExtendedControls
            v-if="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })"
            :responsive-volume-size="false"
            :button-visibility="{ player: false, volume: true, queue: false }"
            :volume-size="'100%'"
          />
        </div>
        <div class="fullscreen-media-controls">
          <ResponsiveIcon
            class="media-controls-item"
            :hover="true"
            :is-dark="$vuetify.theme.current.dark"
            max-height="24px"
            icon="mdi-shuffle"
          ></ResponsiveIcon>

          <ResponsiveIcon
            class="media-controls-item"
            :hover="true"
            :is-dark="$vuetify.theme.current.dark"
            max-height="35px"
            icon="mdi-skip-previous-outline"
          ></ResponsiveIcon>

          <ResponsiveIcon
            class="media-controls-item"
            :hover="true"
            :is-dark="$vuetify.theme.current.dark"
            max-height="80px"
            icon="mdi-play-circle"
          ></ResponsiveIcon>

          <ResponsiveIcon
            class="media-controls-item"
            :hover="true"
            :is-dark="$vuetify.theme.current.dark"
            max-height="35px"
            icon="mdi-skip-next-outline"
          ></ResponsiveIcon>

          <ResponsiveIcon
            class="media-controls-item"
            :is-dark="$vuetify.theme.current.dark"
            :hover="true"
            max-height="24px"
            icon="mdi-repeat-variant"
          ></ResponsiveIcon>
        </div>
        <div class="fullscreen-media-controls-bottom">
          <div>
            <Button if="activePlayerQueue">
              <v-badge content="2" color="primary">
                <v-icon :size="30">mdi-speaker</v-icon>
              </v-badge>
              <div class="line-clamp-1">{{ activePlayerQueue?.display_name }}</div>
            </Button>
          </div>
          <div style="text-align: end">
            <PlayerExtendedControls
              :button-visibility="{
                queue: getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }),
                player: false,
                volume: false,
              }"
            />
          </div>
        </div>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

import PlayerExtendedControls from './PlayerExtendedControls.vue';
import { getImageThumbForItem } from '@/components/MediaItemThumb.vue';
import api from '@/plugins/api';
import { MediaItemType, ImageType, MediaType, ItemMapping, Track } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import PlayerTimeline from './PlayerTimeline.vue';
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import { imgCoverDark, imgCoverLight } from '@/components/ProviderIcons.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import Button from '@/components/mods/Button.vue';
import TextAnimation from '@/components/TextAnimation.vue';
import ResponsiveIcon from '@/components/mods/ResponsiveIcon.vue';
import vuetify from '@/plugins/vuetify';
import router from '@/plugins/router';
import { rgbToHex } from '@/utils';

const coverImageColorCode = ref(
  vuetify.theme.current.value.dark ? store.coverImageColorCode.darkColor : store.coverImageColorCode.lightColor,
);
// Local refs
const fullTrackDetails = ref<Track>();

// Computed properties
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

const coverImage = computed(() => {
  // return the default cover/thumb image for the active queueItem
  if (curQueueItem.value) {
    return getImageThumbForItem(curQueueItem.value.media_item, ImageType.THUMB);
  }
  return undefined;
});

const backgroundImage = computed(() => {
  // prefer fanart from full track details
  if (fullTrackDetails.value) {
    // prefer artist fanart image
    const artistFanart = getImageThumbForItem(fullTrackDetails.value, ImageType.FANART);
    if (artistFanart) return artistFanart;
    // fallback to artist thumb
    const artistThumb = getImageThumbForItem(fullTrackDetails.value.artists[0], ImageType.THUMB);
    if (artistThumb) return artistThumb;
  }
  // fallback to just the cover image
  return coverImage.value;
});

const defaultImage = computed(() => {
  return vuetify.theme.current.value.dark ? imgCoverDark : imgCoverLight;
});

// Watchers
watch(
  () => curQueueItem.value,
  async (result) => {
    if (result && result.media_item && result.media_item.media_type === MediaType.TRACK) {
      fullTrackDetails.value = (await api.getItemByUri(result.media_item.uri, undefined, false)) as Track;
    }
  },
);

watch(
  () => store.coverImageColorCode,
  (result) => {
    coverImageColorCode.value = vuetify.theme.current.value.dark ? result.darkColor : result.lightColor;
  },
);
</script>

<style scoped>
.fullscreen-container {
  display: flex;
  flex-flow: column;
  height: 100%;
  padding-bottom: 5px;
}

.fullscreen-track-info {
  margin-top: 10px;
  margin-bottom: 10px;
}

.fullscreen-track-info-subtitle {
  opacity: 0.5;
}

.media-controls-item {
  margin: 0 10px;
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .media-controls-item {
    margin: 0 5px;
    width: 100%;
    height: 100%;
  }
}

.fullscreen-row {
  display: grid;
  flex: 0 1 auto;
  align-content: center;
}

.fullscreen-row-centered {
  display: grid;
  flex: 0 1 auto;
  justify-content: center;
}

.fullscreen-media-controls {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
}

.fullscreen-media-controls > button {
  flex: 1 1 auto;
}

.fullscreen-media-controls-bottom {
  display: flex;
  flex: 0 1 auto;
  justify-content: center;
  align-items: center;
}

.fullscreen-media-controls-bottom > div {
  flex-basis: 0;
  flex-grow: 1;
  max-width: 100%;
}
</style>
