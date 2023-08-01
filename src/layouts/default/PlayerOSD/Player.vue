<template>
  <div v-if="primaryCoverImageColor" :class="`mediacontrols-bg-${getBreakpointValue('bp3') ? '1' : '2'}`" :style="`background: linear-gradient(90deg, ${primaryCoverImageColor}${$vuetify.theme.current.dark ? '4D' : 'B3'
    } 0%, ${primaryCoverImageColor}00 100%);`"></div>
  <PlayerTimeline v-breakpoint="{ breakpoint: 'bp3', condition: 'lt' }"
    :color="$vuetify.theme.current.dark ? coverImageColorPalette.lightColor : coverImageColorPalette.darkColor"
    :is-progress-bar="true" />

  <div class="mediacontrols" :style="`padding: ${getBreakpointValue({ breakpoint: 'phone' }) ? 3 : 10}px ${getBreakpointValue({ breakpoint: 'phone' }) ? 10 : 10
    }px;`">
    <div :class="`mediacontrols-left-${getBreakpointValue('bp3') ? '1' : '2'}`">
      <PlayerTrackDetails :show-quality-details-btn="getBreakpointValue('bp7') ? true : false" :show-only-artist="true" :color-palette="coverImageColorPalette"
        :primary-color="!$vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })
            ? '#fff'
            : $vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'gt' })
              ? '#fff'
              : '#000'
          " />
    </div>
    <div :class="`mediacontrols-bottom-center-${getBreakpointValue('bp3') ? '1' : '2'}`">
      <div style="width: 100%">
        <!-- player control buttons -->
        <PlayerControls :visible-components="{
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
        }" />
        <!-- progress bar -->
        <PlayerTimeline v-breakpoint="{ breakpoint: 'mobile', condition: 'gt' }" :color="$vuetify.theme.current.dark ? coverImageColorPalette.darkColor : coverImageColorPalette.lightColor
          " :is-progress-bar="false" />
      </div>
    </div>
    <div class="mediacontrols-bottom-right">
      <div>
        <!-- player mobile extended control buttons -->
        <PlayerExtendedControls :queue="{ isVisible: getBreakpointValue('bp3') }" :player="{
          isVisible: true,
          color:
            !$vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })
              ? '#fff'
              : $vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'gt' })
                ? '#fff'
                : '#000',
        }" :volume="{
  isVisible: true,
  color:
    !$vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })
      ? '#fff'
      : $vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'gt' })
        ? '#fff'
        : '#000',
}" />
        <!-- player mobile control buttons -->

        <PlayerControls style="padding-right: 5px" :visible-components="{
          repeat: { isVisible: false },
          shuffle: { isVisible: false },
          play: {
            isVisible: getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }),
            withCircle: false,
            icon: {
              staticWidth: '48px',
              staticHeight: '48px',
              color:
                !$vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })
                  ? '#fff'
                  : $vuetify.theme.current.dark && getBreakpointValue({ breakpoint: 'bp3', condition: 'gt' })
                    ? '#fff'
                    : '#000',
            },
          },
          previous: { isVisible: false },
          next: { isVisible: false },
        }" />
      </div>
    </div>
  </div>
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
import { ColorCoverPalette, getColorPalette, getContrastingTextColor } from '@/helpers/utils';
import { imgCoverDark } from '@/components/QualityDetailsBtn.vue';
import { useTheme } from 'vuetify/lib/framework.mjs';

// global refs
const theme = useTheme();

// local refs
const primaryCoverImageColor = ref<string>();
const coverImageColorPalette = ref<ColorCoverPalette>({
    '0': '',
    '1': '',
    '2': '',
    '3': '',
    '4': '',
    '5': '',
    lightColor: '',
    darkColor: '',
  });

// utility feature to extract the dominant colors from the cover image
// we use this color palette to colorize the playerbar/OSD
const img = new Image();
img.src = imgCoverDark;
img.crossOrigin = 'Anonymous';
img.addEventListener('load', function () {
  coverImageColorPalette.value = getColorPalette(img);
  applyThemeColors();
  primaryCoverImageColor.value = vuetify.theme.current.value.dark
    ? coverImageColorPalette.value.darkColor
    : coverImageColorPalette.value.lightColor;
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
    // load cover image for the (new) QueueItem
    // make sure that the image selection is exactly the same as on the player OSD thumb
    if (curQueueItem.value?.media_item) {
      img.src = getImageThumbForItem(curQueueItem.value.media_item , ImageType.THUMB) || imgCoverDark;
    } else if (curQueueItem.value) {
      img.src = getImageThumbForItem(curQueueItem.value , ImageType.THUMB) || imgCoverDark;
    } else {
      img.src = imgCoverDark
    }
  },
);

const applyThemeColors = function () {
  // set some theme variables based on the coverImageColorPalette so UI elements can react
  // on the color schema of the currently loaded/playing item
  let lightTheme = theme.themes.value.light;
  let darkTheme = theme.themes.value.dark;  
  lightTheme.colors['osd-primary'] = coverImageColorPalette.value.lightColor || lightTheme.colors['primary'];
  lightTheme.colors['osd-on-primary'] = getContrastingTextColor(coverImageColorPalette.value.lightColor) || lightTheme.colors['on-primary'];
  lightTheme.colors['osd-secondary'] = coverImageColorPalette.value.darkColor || lightTheme.colors['secondary'];
  lightTheme.colors['osd-on-secondary'] = getContrastingTextColor(coverImageColorPalette.value.darkColor) || lightTheme.colors['on-secondary'];
  // lightTheme.variables['medium-emphasis-opacity'] = 1;

  darkTheme.colors['osd-primary'] = coverImageColorPalette.value.darkColor || darkTheme.colors['primary'];
  darkTheme.colors['osd-on-primary'] = getContrastingTextColor(coverImageColorPalette.value.darkColor) || darkTheme.colors['on-primary'];
  darkTheme.colors['osd-secondary'] = coverImageColorPalette.value.lightColor || darkTheme.colors['secondary'];
  darkTheme.colors['osd-on-secondary'] = getContrastingTextColor(coverImageColorPalette.value.lightColor) || darkTheme.colors['on-secondary'];
  // darkTheme.variables['medium-emphasis-opacity'] = 1;
};

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
  border-radius: 10px;
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

.mediacontrols-left-1>div {
  padding: 0px !important;
}

.mediacontrols-left-2>div {
  padding: 0px !important;
}

.mediacontrols-bottom-center-1 {
  display: table-cell;
  text-align: center;
  width: 40%;
  vertical-align: middle;
}

.mediacontrols-bottom-center-2 {
  display: none;
  width: 25%;
}

.mediacontrols-bottom-right {
  display: table-cell;
  text-align: right;
  vertical-align: middle;
}

.mediacontrols-bottom-right>div {
  display: inline-flex;
  align-items: center;
}
</style>
