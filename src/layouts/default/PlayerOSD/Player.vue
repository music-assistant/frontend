<template>
  <div class="mediacontrols-bg" :data-floating="useFloatingPlayer"></div>

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
      <!-- player control buttons -->
      <PlayerControls
        :visible-components="{
          repeat: { isVisible: getBreakpointValue('bp3') },
          shuffle: { isVisible: getBreakpointValue('bp3') },
          play: {
            isVisible: true,
            icon: {
              staticWidth: '48px',
              staticHeight: '48px',
            },
          },
          previous: { isVisible: getBreakpointValue('bp3') },
          next: { isVisible: getBreakpointValue('bp3') },
        }"
      />
      <!-- progress bar -->
      <PlayerTimeline
        v-if="getBreakpointValue('bp6')"
        :is-progress-bar="false"
        :disabled="
          !store.activePlayerQueue?.active ||
          store.activePlayerQueue?.current_item?.media_item?.media_type !==
            MediaType.TRACK
        "
      />
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
            isVisible:
              !mobile &&
              (store.activePlayer?.volume_control != PLAYER_CONTROL_NONE ||
                store.activePlayer?.group_members.length > 0),
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
              icon: {
                staticWidth: '40px',
                staticHeight: '40px',
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
  <div
    v-if="
      mobile &&
      (store.activePlayer?.volume_control != PLAYER_CONTROL_NONE ||
        store.activePlayer?.group_members.length > 0)
    "
    class="volume-slider"
  >
    <PlayerVolume
      width="100%"
      color="secondary"
      :is-powered="store.activePlayer?.powered != false"
      :disabled="!store.activePlayer || !store.activePlayer?.available"
      :model-value="Math.round(store.activePlayer?.group_volume || 0)"
      prepend-icon="mdi-volume-minus"
      append-icon="mdi-volume-plus"
      @update:model-value="
        store.activePlayer!.group_members.length > 0
          ? api.playerCommandGroupVolume(store.activePlayerId!, $event)
          : api.playerCommandVolumeSet(store.activePlayerId!, $event)
      "
      @click:prepend="
        store.activePlayer!.group_members.length > 0
          ? api.playerCommandGroupVolumeDown(store.activePlayerId!)
          : api.playerCommandVolumeDown(store.activePlayerId!)
      "
      @click:append="
        store.activePlayer!.group_members.length > 0
          ? api.playerCommandGroupVolumeUp(store.activePlayerId!)
          : api.playerCommandVolumeUp(store.activePlayerId!)
      "
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
//@ts-ignore

import {
  ImageType,
  MediaType,
  PLAYER_CONTROL_NONE,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { getImageThumbForItem } from "@/components/MediaItemThumb.vue";
import PlayerTimeline from "./PlayerTimeline.vue";
import PlayerControls from "./PlayerControls.vue";
import PlayerTrackDetails from "./PlayerTrackDetails.vue";
import PlayerVolume from "./PlayerVolume.vue";
import PlayerExtendedControls from "./PlayerExtendedControls.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";
import vuetify from "@/plugins/vuetify";
import { ImageColorPalette, getColorPalette } from "@/helpers/utils";
import {
  imgCoverDark,
  imgCoverLight,
} from "@/components/QualityDetailsBtn.vue";
import { useDisplay } from "vuetify";
import { api } from "@/plugins/api";
interface Props {
  useFloatingPlayer: boolean;
}
defineProps<Props>();

// Custom breakpoint for compatibility with `getBreakpointValue`. Can replace once we switch to using built-in Vuetify breakpoints
const { mobile } = useDisplay({ mobileBreakpoint: 576 });

// local refs
const coverImageColorPalette = ref<ImageColorPalette>({
  "0": "",
  "1": "",
  "2": "",
  "3": "",
  "4": "",
  "5": "",
  lightColor: "",
  darkColor: "",
});

// utility feature to extract the dominant colors from the cover image
// we use this color palette to colorize the playerbar/OSD
const img = new Image();
img.src = vuetify.theme.current.value.dark ? imgCoverDark : imgCoverLight;
img.crossOrigin = "Anonymous";
img.addEventListener("load", function () {
  coverImageColorPalette.value = getColorPalette(img);
});

const backgroundColor = computed(() => {
  if (vuetify.theme.current.value.dark) {
    if (coverImageColorPalette.value && coverImageColorPalette.value.darkColor)
      return coverImageColorPalette.value.darkColor;
    return "#CCCCCC26";
  }
  if (coverImageColorPalette.value && coverImageColorPalette.value.lightColor)
    return coverImageColorPalette.value.lightColor;
  return "#CCCCCC26";
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
        "";
    } else if (store.curQueueItem) {
      img.src = getImageThumbForItem(store.curQueueItem, ImageType.THUMB) || "";
    } else {
      img.src = "";
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
  padding: 10px 15px;
  border-radius: 10px;
  background-color: rgb(var(--v-theme-overlay));
  .mediacontrols-bottom-center {
    width: 40%;
  }

  &[data-mobile="true"] {
    .mediacontrols-bottom-center {
      display: none;
    }
    .mediacontrols-left {
      width: unset;
    }
  }
}

.mediacontrols-bg {
  border-radius: 10px;
  height: 100%;
  position: absolute;
  width: 320px;
  left: 0px;
  top: 0px;
  background: linear-gradient(
    to right,
    v-bind("backgroundColor") 0%,
    transparent
  );

  &[data-floating="true"] {
    border-radius: 10px;
    width: 100%;
    background: v-bind("backgroundColor");
  }
}

.mediacontrols-top-right {
  display: table-row;
}

.mediacontrols-left {
  margin-inline-end: auto;
  width: 20%;
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

.volume-slider {
  width: calc(100% - 30px);
  margin-bottom: 6px;
  margin-top: -10px;
}
</style>
