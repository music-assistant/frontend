<template>
  <!-- Non-mobile: background gradient and player bar -->
  <template v-if="!useFloatingPlayer">
    <div class="mediacontrols-bg" :data-floating="useFloatingPlayer"></div>
    <div class="mediacontrols" :data-compact="!getBreakpointValue('bp6')">
      <div class="mediacontrols-left">
        <PlayerTrackDetails
          :show-quality-details-btn="getBreakpointValue('bp9') ? true : false"
          :show-only-artist="getBreakpointValue('bp7') ? false : true"
          :color-palette="coverImageColorPalette"
          :primary-color="$vuetify.theme.current.dark ? '#fff' : '#000'"
        />
      </div>
      <div class="mediacontrols-bottom-center">
        <div class="player-center-controls">
          <div v-if="showWideCenterActions" class="player-center-side-action">
            <Button
              v-if="favoriteItem"
              variant="ghost"
              size="icon-lg"
              class="player-control-button"
              :aria-label="
                $t(favoriteItem.favorite ? 'favorites_remove' : 'favorites_add')
              "
              @click="api.toggleFavorite(favoriteItem)"
            >
              <Heart
                class="size-5"
                :fill="favoriteItem.favorite ? 'currentColor' : 'none'"
              />
            </Button>
          </div>

          <PlayerControls
            :style="playIconStyle"
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

          <div v-if="showWideCenterActions" class="player-center-side-action">
            <QueueBtn :size="22" class="player-control-button" />
          </div>
        </div>
        <!-- progress bar -->
        <PlayerTimeline v-if="getBreakpointValue('bp6')" />
      </div>
      <div class="mediacontrols-bottom-right">
        <div>
          <!-- player extended control buttons -->
          <PlayerExtendedControls
            :favorite="{
              isVisible: false,
              showInMenu: true,
            }"
            :queue="{
              isVisible: false,
              showInMenu: true,
            }"
            :player="{
              isVisible: true,
            }"
            :volume="{
              isVisible: store.activePlayer != undefined,
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
      <!-- the whole card opens the player, so the empty space around the
           track details is clickable too; the controls stop their own clicks -->
      <div class="mediacontrols-left" @click="openActivePlayer">
        <PlayerTrackDetails
          :show-quality-details-btn="false"
          :show-only-artist="true"
          :compact="true"
          :color-palette="coverImageColorPalette"
          :primary-color="$vuetify.theme.current.dark ? '#fff' : '#000'"
        />
      </div>
      <div class="mediacontrols-bottom-right">
        <div class="flex items-center">
          <PlayerTrackMenu
            v-if="showFloatingTrackMenu"
            compact
            force-visible
            :show-favorite="true"
            :show-queue="true"
          />
          <!-- grouping sits beside play: both act on what this bar is playing -->
          <PlayerBarGroupControl floating />
          <!-- player mobile control buttons -->
          <PlayerControls
            :visible-components="{
              repeat: { isVisible: false },
              shuffle: { isVisible: false },
              play: {
                isVisible: true,
                icon: {
                  staticWidth: '40px',
                  staticHeight: '40px',
                },
                size: 18,
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
        :player="store.activePlayer"
        width="100%"
        :prefer-group-volume="true"
        :enable-popout="false"
        :request-expand-on-group-tap="true"
        @toggle-group-expansion="showMobileVolumeControls = true"
      />
    </div>
    <PlayerBarMobileVolumeSheet
      v-if="store.activePlayer"
      v-model:open="showMobileVolumeControls"
      :player="store.activePlayer"
    />
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { ImageColorPalette, paletteFromServer } from "@/helpers/utils";
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import vuetify from "@/plugins/vuetify";
import { Heart } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import PlayerBarGroupControl from "./PlayerBarGroupControl.vue";
import PlayerBarMobileVolumeSheet from "./PlayerBarMobileVolumeSheet.vue";
import PlayerTrackMenu from "./PlayerControlBtn/PlayerTrackMenu.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import PlayerControls from "./PlayerControls.vue";
import PlayerExtendedControls from "./PlayerExtendedControls.vue";
import PlayerTimeline from "./PlayerTimeline.vue";
import PlayerTrackDetails from "./PlayerTrackDetails.vue";
import PlayerVolume from "./PlayerVolume.vue";

interface Props {
  useFloatingPlayer: boolean;
}
const props = defineProps<Props>();
const showMobileVolumeControls = ref(false);
const showWideCenterActions = computed(() => getBreakpointValue("bp6"));
const favoriteItem = computed(() => {
  const item = store.curQueueItem?.media_item;
  return item?.media_type === MediaType.AUDIO_SOURCE ? undefined : item;
});

// the floating row already carries grouping and play; the track menu only
// joins them where there is width to spare
const showFloatingTrackMenu = computed(() => getBreakpointValue("bp12"));

/** Opens the fullscreen player, or the player picker when there is nothing to show. */
function openActivePlayer() {
  if (!store.activePlayer || store.activePlayer.powered === false) {
    store.showPlayersMenu = true;
    return;
  }
  store.showFullscreenPlayer = true;
}

const coverImageColorPalette = computed<ImageColorPalette>(() =>
  paletteFromServer(store.activePlayer?.current_media?.palette),
);

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

// this bar sits on an artwork tint rather than the app surface, so its
// controls key off the theme contrast colour instead of the flat grey the
// other player bars use
const floatingControlColor = computed(() =>
  vuetify.theme.current.value.dark
    ? "rgba(255, 255, 255, 0.82)"
    : "rgba(0, 0, 0, 0.72)",
);

const themeColor = computed(() =>
  vuetify.theme.current.value.dark ? "#fff" : "#000",
);

const playIconStyle = computed(() => ({
  "--play-icon-color": vuetify.theme.current.value.dark ? "#212121" : "#fff",
}));

watch(
  () => store.activePlayerId,
  () => {
    showMobileVolumeControls.value = false;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  background-color: rgb(var(--v-theme-overlay));
}

.mediacontrols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 40%) minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-height: var(--player-bar-height);
  padding: 8px 15px;
  background-color: rgb(var(--v-theme-overlay));
  .mediacontrols-bottom-center {
    flex: 0 1 40%;
    min-width: 0;
  }

  &[data-mobile="true"] {
    display: flex;
    background-color: transparent;
    min-height: 0;
    /* the top matches the side inset, so the artwork sits the same distance
       from both edges; the volume row carries the space below it */
    padding: 8px 10px 5px;
    /* beats the global .player-control-button colour, which is tuned for the
       app surface rather than an artwork tint */
    :deep(.player-control-button) {
      color: v-bind(floatingControlColor) !important;
    }
    :deep(.player-control-button:hover:not([data-suppress-hover="true"])),
    :deep(.player-control-button[data-active="true"]),
    :deep(.player-control-button[data-state="open"]) {
      color: var(--primary) !important;
    }
    /* Icon.vue rests its buttons at 0.62 and only lifts them on hover, which a
       touch device never reaches, so play looked faded next to the grouping
       button beside it */
    :deep(.icon-container--button:not(.icon-container--disabled)) {
      opacity: 1;
    }
    /* play stays the primary action but is outlined here, so the compact row
       does not read as a solid block */
    :deep(.play-btn-icon) {
      min-width: 40px;
      min-height: 40px;
      border: 2px solid currentColor;
      background-color: transparent;
      color: v-bind(floatingControlColor);
    }
    .mediacontrols-bottom-right {
      margin-right: 0;
    }
    .mediacontrols-bottom-center {
      display: none;
    }
    .mediacontrols-left {
      flex: 1;
      min-width: 0;
      max-width: none;
      cursor: pointer;
    }
  }
}

.mediacontrols-bg {
  height: 100%;
  position: absolute;
  width: 320px;
  left: 0px;
  top: 0px;
  /* it is positioned, so it paints over the row behind it; without this it
     takes every click that does not land on the controls or the text */
  pointer-events: none;
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
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  > div {
    padding: 0px !important;
    min-width: 0;
  }
}

.mediacontrols-bottom-right {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  margin-right: -8px;
  > div {
    display: inline-flex;
    align-items: center;
  }
}

.player-center-controls {
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-center-side-action {
  display: flex;
  width: 46px;
  height: 46px;
  align-items: center;
  justify-content: center;
}

.mediacontrols :deep(.player-bar-action) {
  display: grid !important;
  grid-template-rows: 40px 16px;
  align-content: center;
  justify-items: center;
  row-gap: 4px;
}

.mediacontrols :deep(.player-bar-action-icon) {
  display: flex;
  width: 100%;
  height: 40px;
  align-items: center;
  justify-content: center;
}

.mediacontrols[data-compact="true"] :deep(.player-bar-action) {
  transform: translateY(10px);
}

.mediacontrols :deep(.player-bar-action-label) {
  display: block;
  width: 100%;
  height: 16px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media screen and (min-width: 769px) and (max-width: 1099px) {
  .mediacontrols .mediacontrols-bottom-center {
    width: auto;
  }

  .mediacontrols-bottom-right {
    min-width: 0;
  }

  .mediacontrols :deep(.player-bar-menu-button) {
    width: 40px !important;
    height: 72px !important;
  }

  .mediacontrols :deep(.player-bar-volume-button) {
    width: 56px !important;
    height: 72px !important;
  }

  .mediacontrols :deep(.player-bar-group-button) {
    width: 60px !important;
    height: 72px !important;
  }

  .mediacontrols :deep(.player-bar-player-button) {
    width: 68px !important;
    height: 72px !important;
  }
}

.volume-slider {
  width: auto;
  margin: -4px 10px 2px 10px;
}

/* the slider only needs room for its own track in the floating bar */
.volume-slider :deep(.player-volume-container) {
  min-height: 28px;
}

.volume-slider :deep([data-slot="slider-range"]) {
  background-color: v-bind("themeColor") !important;
}

.volume-slider :deep([data-slot="slider-thumb"])::before {
  background-color: v-bind("themeColor") !important;
}

.volume-slider :deep([data-slot="slider-track"])::before {
  background-color: color-mix(
    in srgb,
    v-bind("themeColor") 24%,
    transparent
  ) !important;
}
</style>
