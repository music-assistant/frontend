<template>
  <!-- Non-mobile: background gradient and player bar -->
  <template v-if="!mobile">
    <div class="mediacontrols-bg" :data-floating="useFloatingPlayer"></div>
    <div class="mediacontrols">
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
          <!-- player extended control buttons -->
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
              isVisible: store.activePlayer != undefined,
              color: $vuetify.theme.current.dark ? '#fff' : '#000',
            }"
          />
        </div>
      </div>
    </div>
  </template>

  <!-- Mobile: floating player with volume slider inside container -->
  <div v-else class="mediacontrols-mobile-container">
    <div class="mediacontrols-bg" :data-floating="useFloatingPlayer"></div>
    <div class="mediacontrols" :data-mobile="true">
      <div class="mediacontrols-left">
        <PlayerTrackDetails
          :show-quality-details-btn="false"
          :show-only-artist="true"
          :color-palette="coverImageColorPalette"
          :primary-color="$vuetify.theme.current.dark ? '#fff' : '#000'"
        />
      </div>
      <div class="mediacontrols-bottom-right">
        <div>
          <!-- player mobile extended control buttons -->
          <PlayerExtendedControls
            :queue="{
              isVisible: false,
              color: $vuetify.theme.current.dark ? '#fff' : '#000',
            }"
            :player="{
              isVisible: true,
              color: $vuetify.theme.current.dark ? '#fff' : '#000',
            }"
            :volume="{
              isVisible: false,
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
                isVisible: true,
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
    <div v-if="store.activePlayer" class="volume-slider">
      <PlayerVolume
        width="100%"
        color="secondary"
        :is-powered="store.activePlayer?.powered != false"
        :disabled="
          !store.activePlayer ||
          !store.activePlayer?.available ||
          store.activePlayer.powered == false ||
          !store.activePlayer.supported_features.includes(
            PlayerFeature.VOLUME_SET,
          )
        "
        :model-value="
          Math.round(
            store.activePlayer.group_members.length > 0
              ? (store.activePlayer.group_volume ?? 0)
              : store.activePlayer.volume_level || 0,
          )
        "
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
      >
        <template #prepend>
          <!-- mute button with dynamic volume icon -->
          <Button
            icon
            style="height: 25px; width: 25px; min-width: 25px"
            :disabled="
              !store.activePlayer.available ||
              store.activePlayer.powered == false ||
              store.activePlayer.mute_control == PLAYER_CONTROL_NONE
            "
            @click.stop="handlePlayerMuteToggle(store.activePlayer)"
          >
            <component
              :is="
                getVolumeIconComponent(
                  store.activePlayer,
                  Math.round(
                    store.activePlayer.group_members.length > 0
                      ? (store.activePlayer.group_volume ?? 0)
                      : store.activePlayer.volume_level || 0,
                  ),
                )
              "
              :size="22"
            />
          </Button>
        </template>
        <template #append>
          <div class="text-caption volumecaption">
            {{
              Math.round(
                store.activePlayer.group_members.length > 0
                  ? (store.activePlayer.group_volume ?? 0)
                  : store.activePlayer.volume_level || 0,
              )
            }}
          </div>
        </template>
      </PlayerVolume>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
//@ts-ignore
import Button from "@/components/Button.vue";
import {
  imgCoverDark,
  imgCoverLight,
} from "@/components/QualityDetailsBtn.vue";
import {
  ImageColorPalette,
  getColorPalette,
  getMediaImageUrl,
  getVolumeIconComponent,
} from "@/helpers/utils";
import { api } from "@/plugins/api";
import { handlePlayerMuteToggle } from "@/plugins/api/helpers";
import {
  MediaType,
  PLAYER_CONTROL_NONE,
  PlayerFeature,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import vuetify from "@/plugins/vuetify";
import { useDisplay } from "vuetify";
import PlayerControls from "./PlayerControls.vue";
import PlayerExtendedControls from "./PlayerExtendedControls.vue";
import PlayerTimeline from "./PlayerTimeline.vue";
import PlayerTrackDetails from "./PlayerTrackDetails.vue";
import PlayerVolume from "./PlayerVolume.vue";

interface Props {
  useFloatingPlayer: boolean;
}
const props = defineProps<Props>();

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
  () => store.activePlayer?.current_media?.image_url,
  () => {
    // load cover image for the (new) QueueItem
    // make sure that the image selection is exactly the same as on the player OSD thumb
    if (store.activePlayer?.current_media?.image_url) {
      img.src = getMediaImageUrl(store.activePlayer.current_media.image_url);
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

.mediacontrols-mobile-container {
  position: relative;
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  background-color: rgb(var(--v-theme-overlay));
}

.mediacontrols {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 15px;
  background-color: rgb(var(--v-theme-overlay));
  .mediacontrols-bottom-center {
    width: 40%;
  }

  &[data-mobile="true"] {
    background-color: transparent;
    padding: 8px 10px;
    .mediacontrols-bottom-center {
      display: none;
    }
    .mediacontrols-left {
      flex: 1;
      min-width: 0;
    }
  }
}

.mediacontrols-bg {
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
  width: calc(100% - 34px);
  margin: -4px 6px 6px 14px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
