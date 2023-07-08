<template>
  <v-footer
    bottom
    fixed
    class="d-flex flex-column"
    style="width: 100%; border-top-style: ridge; padding: 0px"
    elevation="5"
    app
  >
    <div
      v-if="coverImageColorCode && curQueueItem"
      :class="`mediacontrols-bg-${getBreakpointValue('bp3') ? '1' : '2'}`"
      :style="`background: linear-gradient(90deg, ${coverImageColorCode}${
        $vuetify.theme.current.dark ? '4D' : 'B3'
      } 0%, ${coverImageColorCode}00 100%);`"
    ></div>
    <PlayerTimeline
      v-breakpoint="{ breakpoint: 'bp3', condition: 'lt' }"
      :color="$vuetify.theme.current.dark ? store.coverImageColorCode.lightColor : store.coverImageColorCode.darkColor"
      :is-progress-bar="true"
    />

    <div
      class="mediacontrols"
      :style="`padding: ${getBreakpointValue({ breakpoint: 'phone' }) ? 3 : 10}px ${
        getBreakpointValue({ breakpoint: 'phone' }) ? 10 : 10
      }px;`"
    >
      <div :class="`mediacontrols-left-${getBreakpointValue('bp3') ? '1' : '2'}`">
        <PlayerTrackDetails
          :show-quality-details-btn="getBreakpointValue('bp5') ? true : false"
          :show-only-artist="true"
        />
      </div>
      <div :class="`mediacontrols-buttom-center-${getBreakpointValue('bp3') ? '1' : '2'}`">
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
          <!-- progress bar -->
          <PlayerTimeline
            v-breakpoint="{ breakpoint: 'mobile', condition: 'gt' }"
            :color="
              $vuetify.theme.current.dark ? store.coverImageColorCode.darkColor : store.coverImageColorCode.lightColor
            "
            :is-progress-bar="false"
          />
        </div>
      </div>
      <div class="mediacontrols-buttom-right">
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
          <!-- player extended control buttons -->
          <PlayerExtendedControls
            :visible-components="{
              queue: { isVisible: getBreakpointValue('bp3') },
              player: { isVisible: true },
              volume: { isVisible: getBreakpointValue('bp0') },
            }"
          />
        </div>
      </div>
    </div>
  </v-footer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
//@ts-ignore

import api from '@/plugins/api';
import { ImageType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import { getImageThumbForItem } from '@/components/MediaItemThumb.vue';
import PlayerTimeline from './PlayerTimeline.vue';
import PlayerControls from './PlayerControls.vue';
import PlayerTrackDetails from './PlayerTrackDetails.vue';
import PlayerExtendedControls from './PlayerExtendedControls.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import vuetify from '@/plugins/vuetify';
import { getColorCode } from '@/utils';

// local refs
const fanartImage = ref();
const coverImageColorCode = ref();

const img = new Image();
img.crossOrigin = 'Anonymous';

img.addEventListener('load', function () {
  store.coverImageColorCode = getColorCode(img);
  coverImageColorCode.value = vuetify.theme.current.value.dark
    ? store.coverImageColorCode.darkColor
    : store.coverImageColorCode.lightColor;
});

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

// watchers
watch(
  () => curQueueItem.value?.queue_item_id,
  () => {
    if (curQueueItem.value?.media_item) {
      fanartImage.value =
        getImageThumbForItem(curQueueItem.value.media_item, ImageType.FANART) ||
        getImageThumbForItem(curQueueItem.value.media_item, ImageType.THUMB);
      img.src = fanartImage.value;
    }
  },
);
</script>

<style scoped>
.mediadetails-streamdetails .icon {
  opacity: 100;
}

.mediacontrols {
  display: table;
  width: 100%;
}

.mediacontrols-bg-1 {
  position: absolute;
  width: 20%;
  height: 100%;
  left: 0px;
  top: 0px;
}

.mediacontrols-bg-2 {
  position: absolute;
  width: 40%;
  height: 100%;
  left: 0px;
  top: 0px;
}

.mediacontrols-top-right {
  display: table-row;
}

.mediacontrols-left-1 {
  display: table-cell;
  vertical-align: middle;
  width: 25%;
}

.mediacontrols-left-2 {
  display: table-cell;
  vertical-align: middle;
}

.mediacontrols-left-1 > div {
  padding: 0px !important;
}
.mediacontrols-left-2 > div {
  padding: 0px !important;
}

.mediacontrols-buttom-center-1 {
  display: table-cell;
  text-align: center;
  width: 50%;
  vertical-align: middle;
}

.mediacontrols-buttom-center-2 {
  display: none;
  width: 33.333%;
}

.mediacontrols-buttom-right {
  display: table-cell;
  text-align: right;
  vertical-align: middle;
}

.mediacontrols-buttom-right > div {
  display: inline-flex;
  align-items: center;
}
</style>
