<template>
  <!-- Non-mobile: background gradient and player bar -->
  <template v-if="!useFloatingPlayer">
    <div class="mediacontrols-bg" :data-floating="useFloatingPlayer"></div>
    <!-- the popouts find their top edge to hang above by this id -->
    <div
      id="player-bar"
      class="mediacontrols"
      :data-compact="!getBreakpointValue('bp6')"
    >
      <div class="mediacontrols-left">
        <PlayerTrackDetails
          :show-quality-details-btn="getBreakpointValue('bp9') ? true : false"
          :show-only-artist="getBreakpointValue('bp7') ? false : true"
          title-opens-details
          :color-palette="coverImageColorPalette"
          :primary-color="$vuetify.theme.current.dark ? '#fff' : '#000'"
        />
      </div>
      <div class="mediacontrols-bottom-center">
        <div class="player-center-controls">
          <div class="player-center-transport">
            <div class="player-center-side-action">
              <FavoriteMenuBtn class="player-control-button" />
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

            <div class="player-center-side-action">
              <QueueBtn :size="22" class="player-control-button" />
            </div>
          </div>

          <!-- each of these shows only while it has something to say, so most
               of the time this is empty and the row is the transport alone -->
          <div v-if="showCenterExtras" class="player-center-extras">
            <PlaybackSpeedBtn v-if="showPlaybackSpeed" />
            <SleepTimerBtn />
          </div>
        </div>
        <!-- progress bar -->
        <PlayerTimeline v-if="getBreakpointValue('bp6')" />
      </div>
      <div class="mediacontrols-bottom-right">
        <div>
          <!-- player extended control buttons -->
          <PlayerExtendedControls
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
        :expand-on-touch="true"
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
import { ImageColorPalette, paletteFromServer } from "@/helpers/utils";
import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import api from "@/plugins/api";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import vuetify from "@/plugins/vuetify";
import {
  useHotkey,
  useHotkeys,
  type RegisterableHotkey,
} from "@tanstack/vue-hotkeys";
import { computed, ref, watch } from "vue";
import PlayerBarGroupControl from "./PlayerBarGroupControl.vue";
import PlayerBarMobileVolumeSheet from "./PlayerBarMobileVolumeSheet.vue";
import FavoriteMenuBtn from "./PlayerControlBtn/FavoriteMenuBtn.vue";
import PlaybackSpeedBtn from "./PlayerControlBtn/PlaybackSpeedBtn.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import SleepTimerBtn from "./PlayerControlBtn/SleepTimerBtn.vue";
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

const globalPlayerHotkeysEnabled = computed(
  () => !store.dialogActive && !store.showPlayersMenu,
);
const activePlayerId = () => store.activePlayer?.player_id;
const playerCommand = (command: (playerId: string) => unknown) => {
  const playerId = activePlayerId();
  if (playerId) command(playerId);
};
const seekBy = (offset: number) => {
  const playerId = activePlayerId();
  const elapsed = playerId ? resolveActiveElapsedTime(playerId) : undefined;
  if (playerId && elapsed != null)
    api.playerCommandSeek(playerId, Math.max(0, elapsed + offset));
};

useHotkeys(
  [
    {
      hotkey: "Space",
      callback: () => playerCommand(api.playerCommandPlayPause.bind(api)),
    },
    {
      hotkey: "K",
      callback: () => playerCommand(api.playerCommandPlayPause.bind(api)),
    },
    { hotkey: "ArrowLeft", callback: () => seekBy(-10) },
    { hotkey: "ArrowRight", callback: () => seekBy(10) },
    {
      hotkey: "ArrowUp",
      callback: () => playerCommand(api.playerCommandVolumeUp.bind(api)),
    },
    {
      hotkey: "ArrowDown",
      callback: () => playerCommand(api.playerCommandVolumeDown.bind(api)),
    },
    {
      hotkey: "M",
      callback: () => playerCommand(api.playerCommandMuteToggle.bind(api)),
    },
    {
      hotkey: "Mod+Shift+ArrowLeft",
      callback: () => playerCommand(api.playerCommandPrevious.bind(api)),
    },
    {
      hotkey: "Mod+Shift+ArrowRight",
      callback: () => playerCommand(api.playerCommandNext.bind(api)),
    },
    {
      hotkey: "Mod+P",
      callback: () => {
        store.showPlayersMenu = true;
      },
    },
    {
      hotkey: "Mod+Shift+F",
      callback: () => {
        store.showFullscreenPlayer = true;
      },
    },
    {
      hotkey: "Mod+Shift+L",
      callback: () => eventbus.emit("player-toggle-lyrics"),
    },
    {
      hotkey: "Mod+Shift+M",
      callback: () => playerCommand(api.playerCommandMuteToggle.bind(api)),
    },
  ].map((definition) => ({
    ...definition,
    hotkey: definition.hotkey as RegisterableHotkey,
    options: {
      enabled:
        definition.hotkey === "Mod+Shift+F" || definition.hotkey === "Mod+P"
          ? globalPlayerHotkeysEnabled
          : globalPlayerHotkeysEnabled,
    },
  })),
  { ignoreInputs: true },
);

useHotkey(
  "Escape",
  () => {
    store.showFullscreenPlayer = false;
  },
  {
    enabled: computed(
      () => globalPlayerHotkeysEnabled.value && store.showFullscreenPlayer,
    ),
  },
);

// The controls beside the queue button reach into the room the actions to their
// right leave free, so each waits for the width it fits in. Measured, that room
// clears the 85px countdown on its own from 1100px, and the two of them together
// only from 1160px - so the speed control waits for the next breakpoint up.
const showCenterExtras = computed(() => getBreakpointValue("bp7"));
const showPlaybackSpeed = computed(() => getBreakpointValue("bp8"));

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
  border-radius: 16px;
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
    /* the artwork ends up as far from the top as from the left once the row
       centres it; the volume row carries the space below */
    padding: 10px 12px 6px;
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
    border-radius: 16px;
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

/* the transport takes the middle track and the extras the one after it. Neither
   outer track asks for room of its own, so they stay equal and the play button
   holds the centre of the bar whatever the extras beside it are showing; the
   extras reach past the column into the room the actions leave to their left
   instead. The middle track's own floor is waived so the transport still
   shrinks to fit a narrow bar, which is all it did before it had a track. */
.player-center-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr);
  align-items: center;
}

.player-center-transport {
  display: flex;
  grid-column: 2;
  align-items: center;
  /* the transport controls between the two side actions hold a width of their
     own, so from 769 to 809px the row is wider than the track it sits in.
     Centring splits that overhang between the two ends rather than letting it
     all fall to one, which is what keeps the play button centred there too. */
  justify-content: center;
}

/* the actions to the right claim their whole column even though they draw only
   at the far end of it, so the extras have to be lifted over that to stay
   clickable where they reach into the room it leaves free */
.player-center-extras {
  position: relative;
  z-index: 1;
  display: flex;
  grid-column: 3;
  align-items: center;
  justify-self: start;
  gap: 8px;
  margin-inline-start: 8px;
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

/* a wide screen leaves room to spare in this column, so the actions take a gap
   between them and the two whose label varies in length grow with their text -
   the player name is the first to run out. Growing only starts where the label
   needs it, so a short name leaves no hole beside the button next to it. */
@media screen and (min-width: 1100px) {
  /* the room is only borrowed: these let the row hand it straight back should
     another control ever join it, and send whatever still does not fit towards
     the middle of the bar rather than off its end.

     The budget, measured: the column offers 0.3 * (vw - 30) + 8 px, and the
     three buttons rest at 64 + 72 + 96 = 232, so from 1100px up the row has
     room to spare at every width. */
  .mediacontrols-bottom-right > div {
    min-width: 0;
  }

  .mediacontrols :deep(.player-bar-action-row) {
    justify-content: flex-end;
  }

  /* spacing the controls rather than the row keeps the popovers' own anchor
     elements, which sit between them and take no space, out of the count */
  .mediacontrols :deep(.player-bar-action-row > button ~ button) {
    margin-inline-start: clamp(0px, 2vw - 25px, 16px);
  }

  .mediacontrols :deep(.player-bar-group-button),
  .mediacontrols :deep(.player-bar-player-button) {
    width: auto !important;
    flex-shrink: 1 !important;
  }

  .mediacontrols :deep(.player-bar-group-button) {
    min-width: 72px !important;
    max-width: clamp(72px, 5vw + 17px, 112px);
  }

  .mediacontrols :deep(.player-bar-player-button) {
    min-width: 96px !important;
    max-width: clamp(96px, 10vw - 14px, 176px);
  }
}

@media screen and (min-width: 769px) and (max-width: 1099px) {
  .mediacontrols .mediacontrols-bottom-center {
    width: auto;
  }

  .mediacontrols-bottom-right {
    min-width: 0;
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
