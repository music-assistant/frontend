<template>
  <v-dialog
    v-model="store.showFullscreenPlayer"
    fullscreen
    :scrim="false"
    style="overflow: hidden"
    transition="dialog-bottom-transition"
  >
    <v-card :color="darkenBrightColors(coverImageColorCode, 77, 40)">
      <v-toolbar class="v-toolbar-default" color="transparent">
        <template #prepend>
          <Button icon @click="store.showFullscreenPlayer = false">
            <v-icon icon="mdi-chevron-down" />
          </Button>
        </template>

        <template #default>
          <h3 class="line-clamp-1">{{ $t('currently_playing') }}</h3>
        </template>

        <template #append>
          <Button icon>
            <v-icon icon="mdi-dots-vertical" />
          </Button>
        </template>
      </v-toolbar>

      <Container class="fullscreen-container">
        <div class="fullscreen-media-space"></div>
        <div class="fullscreen-row-centered">
          <Flicking
            v-if="
              curQueueItem &&
              getBreakpointValue({ breakpoint: 'mobile' }) &&
              getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
              false
            "
            :options="{
              align: 'center',
              defaultIndex: 1,
              moveType: 'strict',
              panelsPerView: 1,
              useResizeObserver: true,
              circular: true,
            }"
            @moveEnd="handleFlickingMoveEnd"
          >
            <div v-for="config in 3" :key="config" style="margin-right: 10px; margin-left: 10px; display: flex">
              <MediaItemThumb
                :item="curQueueItem?.media_item || curQueueItem"
                :width="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) ? 512 : 1024"
                :height="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) ? 512 : 1024"
                style="
                  height: min(calc(100vw - 40px), calc(100vh - 340px));
                  width: min(calc(100vw - 40px), calc(100vh - 340px));
                "
              />
            </div>
          </Flicking>
          <MediaItemThumb
            v-else-if="curQueueItem"
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
          <div v-if="curQueueItem && curQueueItem.media_item" class="fullscreen-track-info">
            <!-- title -->
            <h2
              style="cursor: pointer; width: fit-content; display: inline"
              class="title line-clamp-1"
              @click="curQueueItem?.media_item ? trackClick(curQueueItem.media_item as Track) : ''"
            >
              <!-- name + version (if present) -->
              {{
                `${curQueueItem.media_item.name} ${
                  'version' in curQueueItem.media_item && curQueueItem.media_item.version
                    ? '(' + curQueueItem.media_item.version + ')'
                    : ''
                }`
              }}
            </h2>

            <!-- subtitle -->
            <!-- track: artists(s) -->
            <div
              v-if="
                curQueueItem.media_item?.media_type == MediaType.TRACK &&
                'album' in curQueueItem.media_item &&
                curQueueItem.media_item.album
              "
              style="cursor: pointer"
              class="line-clamp-1"
              @click="curQueueItem?.media_item ? artistClick((curQueueItem.media_item as Track).artists[0]) : ''"
            >
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
        <div class="fullscreen-row" style="margin: 0 10px">
          <PlayerTimeline
            :is-progress-bar="false"
            :color="$vuetify.theme.current.dark ? props.colorPalette.lightColor : props.colorPalette.darkColor"
          />
        </div>
        <div v-if="false">
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${props.colorPalette[0]}`,
            }"
          ></div>
          <a style="color: #000"> {{ props.colorPalette[0] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${props.colorPalette[1]}`,
            }"
          ></div>
          <a style="color: #000"> {{ props.colorPalette[1] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${props.colorPalette[2]}`,
            }"
          ></div>
          <a style="color: #000"> {{ props.colorPalette[2] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${props.colorPalette[3]}`,
            }"
          ></div>
          <a style="color: #000"> {{ props.colorPalette[3] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${props.colorPalette[4]}`,
            }"
          ></div>
          <a style="color: #000"> {{ props.colorPalette[4] }}</a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${props.colorPalette.darkColor}`,
            }"
          ></div>
          <a style="color: #000"> DarkColor </a>
          <div
            style="height: 50px; width: 50px"
            :style="{
              background: `${props.colorPalette.lightColor}`,
            }"
          ></div>
          <a style="color: #000"> LightColor </a>
        </div>
        <div class="fullscreen-row">
          <PlayerExtendedControls
            v-if="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })"
            :queue="{ isVisible: false }"
            :player="{ isVisible: false }"
            :volume="{ isVisible: true, volumeSize: '100%', responsiveVolumeSize: false }"
          />
        </div>
        <div v-if="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })" class="fullscreen-media-controls">
          <ShuffleBtn class="media-controls-item" max-height="24px" />

          <PreviousBtn class="media-controls-item" max-height="35px" />

          <PlayBtn class="media-controls-item" max-height="80px" />

          <NextBtn class="media-controls-item" max-height="35px" />

          <RepeatBtn class="media-controls-item" max-height="24px" />
        </div>
        <div
          v-else
          class="fullscreen-media-controls"
          :style="{
            paddingTop: '1vh',
            flex: getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) ? '1 1 auto' : '0 1 auto',
          }"
        >
          <div class="media-controls-item" style="display: grid; align-content: center">
            <QualityDetailsBtn />
          </div>
          <div class="media-controls-item fullscreen-row-centered">
            <div style="width: 100%">
              <!-- player control buttons -->
              <PlayerControls
                :visible-components="{
                  repeat: { isVisible: getBreakpointValue('bp3') },
                  shuffle: { isVisible: getBreakpointValue('bp3') },
                  play: {
                    isVisible: true,
                    icon: {
                      staticWidth: '50px',
                      staticHeight: '50px',
                    },
                  },
                  previous: { isVisible: getBreakpointValue('bp3') },
                  next: { isVisible: getBreakpointValue('bp3') },
                }"
              />
            </div>
          </div>
          <div class="fullscreen-mediacontrols-right media-controls-item">
            <div>
              <!-- player mobile control buttons -->
              <PlayerControls
                style="padding-right: 5px"
                :visible-components="{
                  repeat: { isVisible: false },
                  shuffle: { isVisible: false },
                  play: { isVisible: getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) },
                  previous: { isVisible: false },
                  next: { isVisible: false },
                }"
              />
              <!-- player mobile extended control buttons -->
              <PlayerExtendedControls
                :queue="{ isVisible: getBreakpointValue('bp3') }"
                :player="{ isVisible: true }"
                :volume="{ isVisible: getBreakpointValue('bp0') }"
              />
            </div>
          </div>
        </div>
        <div class="fullscreen-media-controls-bottom" if="activePlayerQueue">
          <div v-if="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })">
            <Button @click="store.showPlayersMenu = true">
              <v-badge
                v-if="curGroupPlayers && curGroupPlayers.length > 0"
                :content="store.selectedPlayer?.group_childs.length"
                :color="$vuetify.theme.current.dark ? props.colorPalette.lightColor : props.colorPalette.darkColor"
              >
                <v-icon :size="30">mdi-speaker</v-icon>
              </v-badge>
              <v-icon v-else :size="30">mdi-speaker</v-icon>
              <div class="line-clamp-1">{{ activePlayerQueue?.display_name }}</div>
            </Button>
          </div>
          <div style="text-align: end">
            <PlayerExtendedControls
              :queue="{
                isVisible: getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }),
              }"
              :player="{ isVisible: false }"
              :volume="{ isVisible: false }"
            />
          </div>
        </div>
      </Container>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

import PlayerExtendedControls from './PlayerExtendedControls.vue';
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import api from '@/plugins/api';
import { Artist, ItemMapping, MediaType, Track } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import PlayerTimeline from './PlayerTimeline.vue';
import Breakpoint, { getBreakpointValue } from '@/plugins/breakpoint';
import Button from '@/components/mods/Button.vue';
import vuetify from '@/plugins/vuetify';
import Container from '@/components/mods/Container.vue';
import PlayBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/PlayBtn.vue';
import NextBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/NextBtn.vue';
import PreviousBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/PreviousBtn.vue';
import ShuffleBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleBtn.vue';
import RepeatBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue';
import { imgCoverDark, imgCoverLight } from '@/components/QualityDetailsBtn.vue';
import PlayerControls from './PlayerControls.vue';
import QualityDetailsBtn from '@/components/QualityDetailsBtn.vue';
import router from '@/plugins/router';
import Flicking from '@egjs/vue3-flicking';
import { ColorCoverPalette, darkenBrightColors } from '@/helpers/utils';

interface Props {
  colorPalette: ColorCoverPalette;
}
const props = defineProps<Props>();

const coverImageColorCode = ref<string>('');
// Local refs
const fullTrackDetails = ref<Track>();

// Computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});

const curGroupPlayers = computed(() => {
  if (store.selectedPlayer) {
    return store.selectedPlayer.group_childs;
  }
  return undefined;
});

const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});

const defaultImage = computed(() => {
  return vuetify.theme.current.value.dark ? imgCoverDark : imgCoverLight;
});

// methods
const trackClick = function (item: Track | ItemMapping) {
  router.push({
    name: 'track',
    params: { itemId: item.item_id, provider: item.provider },
  });
  store.showFullscreenPlayer = false;
};

const handleFlickingMoveEnd = function (event: { currentTarget: any }) {
  const flicking = event.currentTarget;
  const status = flicking.getStatus();
};

const artistClick = function (item: Artist | ItemMapping) {
  // album entry clicked
  router.push({
    name: 'artist',
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
  store.showFullscreenPlayer = false;
};

// watchers
watch(
  () => curQueueItem.value,
  async (result) => {
    if (result && result.media_item && result.media_item.media_type === MediaType.TRACK) {
      fullTrackDetails.value = (await api.getItemByUri(result.media_item.uri)) as Track;
    }
  },
);

watch(
  () => props.colorPalette,
  (result) => {
    if (!result.darkColor || !result.lightColor) {
      coverImageColorCode.value = vuetify.theme.current.value.dark ? '#000' : '#fff';
    } else {
      coverImageColorCode.value = vuetify.theme.current.value.dark ? result.darkColor : result.lightColor;
    }
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
  padding-top: 2vh;
  padding-bottom: 2vh;
  text-align: center;
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

.fullscreen-media-controls > div {
  width: calc(100% / 3);
}

.fullscreen-mediacontrols-right {
  display: table-cell;
  text-align: right;
  vertical-align: middle;
}

.fullscreen-mediacontrols-right > div {
  display: inline-flex;
  align-items: center;
}
</style>
