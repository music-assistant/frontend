<template>
  <div class="mediacontrols-bg" :data-floating="useFloatingPlayer"></div>
  <PlayerTimeline
    v-if="getBreakpointValue('bp3')"
    v-breakpoint="{ breakpoint: 'bp3', condition: 'lt' }"
    :color="
      $vuetify.theme.current.dark
        ? coverImageColorPalette.lightColor || '#fff'
        : coverImageColorPalette.darkColor || '#000'
    "
    :is-progress-bar="true"
  />

  <div class="mediacontrols" :data-mobile="mobile">
    <div class="mediacontrols-left">
      <PlayerTrackDetails
        :show-quality-details-btn="getBreakpointValue('bp8') ? true : false"
        :show-only-artist="getBreakpointValue('bp7') ? false : true"
        :color-palette="coverImageColorPalette"
        :primary-color="$vuetify.theme.current.dark ? '#fff' : '#000'"
      />
    </div>
    <div class="mediacontrols-bottom-center">
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
            $vuetify.theme.current.dark
              ? coverImageColorPalette.lightColor || '#fff'
              : coverImageColorPalette.darkColor || '#000'
          "
          :is-progress-bar="false"
        />
      </div>
    </div>
    <div class="mediacontrols-bottom-right">
      <div>
        <!-- player mobile extended control buttons -->
        <PlayerExtendedControls
          :queue="{
            isVisible: getBreakpointValue('bp3'),
            color: $vuetify.theme.current.dark ? '#fff' : '#000',
          }"
          :player="{
            isVisible: true,
            color: $vuetify.theme.current.dark ? '#fff' : '#000',
          }"
          :volume="{
            isVisible: true,
            color: $vuetify.theme.current.dark ? '#fff' : '#000',
          }"
        />
        <!-- player mobile control buttons -->

        <PlayerControls
          style="padding-right: 5px"
          :visible-components="{
            repeat: { isVisible: false },
            shuffle: { isVisible: false },
            play: {
              isVisible: getBreakpointValue({
                breakpoint: 'bp3',
                condition: 'lt',
              }),
              withCircle: false,
              icon: {
                staticWidth: '48px',
                staticHeight: '48px',
                color: $vuetify.theme.current.dark ? '#fff' : '#000',
              },
            },
            previous: { isVisible: false },
            next: { isVisible: false },
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
//@ts-ignore

import { ImageType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import { getImageThumbForItem } from '@/components/MediaItemThumb.vue';
import PlayerTimeline from './PlayerTimeline.vue';
import PlayerControls from './PlayerControls.vue';
import PlayerTrackDetails from './PlayerTrackDetails.vue';
import PlayerExtendedControls from './PlayerExtendedControls.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import vuetify from '@/plugins/vuetify';
import { ImageColorPalette, getColorPalette } from '@/helpers/utils';
import {
  imgCoverDark,
  imgCoverLight,
} from '@/components/QualityDetailsBtn.vue';
import { useTheme } from 'vuetify/lib/framework.mjs';
import { useDisplay } from 'vuetify';

interface Props {
  useFloatingPlayer: boolean;
}
defineProps<Props>();

// global refs
const theme = useTheme();
// Custom breakpoint for compatibility with `getBreakpointValue`. Can replace once we switch to using built-in Vuetify breakpoints
const { mobile } = useDisplay({ mobileBreakpoint: 576 });

// local refs
const coverImageColorPalette = ref<ImageColorPalette>({
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
img.src = vuetify.theme.current.value.dark ? imgCoverDark : imgCoverLight;
img.crossOrigin = 'Anonymous';
img.addEventListener('load', function () {
  coverImageColorPalette.value = getColorPalette(img);
});

const backgroundColor = computed(() => {
  if (vuetify.theme.current.value.dark) {
    if (coverImageColorPalette.value && coverImageColorPalette.value.darkColor)
      return coverImageColorPalette.value.darkColor + '26';
    return 'CCCCCC26';
  }
  if (coverImageColorPalette.value && coverImageColorPalette.value.lightColor)
    return coverImageColorPalette.value.lightColor + '26';
  return 'CCCCCC26';
});

// watchers
watch(
  () => store.curQueueItem?.queue_item_id,
  () => {
    // load cover image for the (new) QueueItem
    // make sure that the image selection is exactly the same as on the player OSD thumb
    if (store.curQueueItem?.media_item) {
      img.src =
        getImageThumbForItem(store.curQueueItem.media_item, ImageType.THUMB) ||
        '';
    } else if (store.curQueueItem) {
      img.src = getImageThumbForItem(store.curQueueItem, ImageType.THUMB) || '';
    } else {
      img.src = '';
    }
  },
);
</script>

<style scoped lang="scss">
.mediadetails-streamdetails .icon {
  opacity: 100;
}

.mediacontrols {
  display: flex;
  align-items: center;
  width: 100%;
  padding-inline: 10px;
  padding-block: 10px;

  &[data-mobile='true'] {
    .mediacontrols-bottom-center {
      display: none;
    }
  }
}

.mediacontrols-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0px;
  top: 0px;
  background-color: v-bind('backgroundColor');

  &[data-floating='true'] {
    border-radius: 10px;
  }
}

.mediacontrols-top-right {
  display: table-row;
}

.mediacontrols-left {
  margin-inline-end: auto;
  > div {
    padding: 0px !important;
  }
}

.mediacontrols-bottom-right {
  margin-inline-start: auto;
  > div {
    display: inline-flex;
    align-items: center;
  }
}
</style>
