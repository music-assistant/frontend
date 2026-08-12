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
  <div
    v-else
    class="mediacontrols-mobile-container"
    :data-compact="compactFloatingPlayer"
  >
    <div class="mediacontrols-bg" :data-floating="useFloatingPlayer"></div>
    <div class="mediacontrols" :data-mobile="true">
      <div class="mediacontrols-left">
        <PlayerTrackDetails
          :show-quality-details-btn="false"
          :show-only-artist="true"
          :compact="compactFloatingPlayer"
          :color-palette="coverImageColorPalette"
          :primary-color="$vuetify.theme.current.dark ? '#fff' : '#000'"
        />
      </div>
      <div class="mediacontrols-bottom-right">
        <div class="flex items-center">
          <PlayerTrackMenu
            v-if="!compactFloatingPlayer"
            compact
            force-visible
            :show-favorite="true"
            :show-queue="true"
          />
          <!-- player mobile control buttons -->
          <PlayerControls
            :style="[{ 'padding-right': '5px' }, playIconStyle]"
            :visible-components="{
              repeat: { isVisible: false },
              shuffle: { isVisible: false },
              play: {
                isVisible: true,
                icon: {
                  staticWidth: '48px',
                  staticHeight: '48px',
                },
              },
              previous: { isVisible: false },
              next: { isVisible: false },
            }"
          />
        </div>
      </div>
    </div>
    <template v-if="!compactFloatingPlayer">
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
    </template>
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
import { useRoute } from "vue-router";
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
const route = useRoute();
const showMobileVolumeControls = ref(false);
const showWideCenterActions = computed(() => getBreakpointValue("bp6"));
const favoriteItem = computed(() => {
  const item = store.curQueueItem?.media_item;
  return item?.media_type === MediaType.AUDIO_SOURCE ? undefined : item;
});

// settings and its descendants collapse the floating mobile player to a
// single row, since the fixed save button already competes for that space
const compactFloatingPlayer = computed(
  () =>
    props.useFloatingPlayer &&
    route.matched.some((record) => record.name === "settings"),
);

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

// the volume sheet is unmounted while compact, but its open state is not:
// reset it so it cannot resurface once the normal player returns
watch(compactFloatingPlayer, (compact) => {
  if (compact) showMobileVolumeControls.value = false;
});
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
    padding: 8px 10px;
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
  width: calc(100% - 34px);
  margin: -4px 6px 6px 14px;
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
