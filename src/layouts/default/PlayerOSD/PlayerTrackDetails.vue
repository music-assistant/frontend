<template>
  <!-- now playing media -->
  <v-list-item
    class="player-track-details"
    style="height: auto; margin: 0px; padding: 0px"
    :lines="props.compact ? 'one' : 'two'"
  >
    <template #prepend>
      <div
        class="media-thumb player-media-thumb"
        :style="`cursor: pointer; height: ${outerThumbSizePx}px; width: ${outerThumbSizePx}px;`"
        @click="store.showFullscreenPlayer = true"
      >
        <!-- player.current_media has content loaded (will work for all sources)  -->
        <div
          v-if="
            store.activePlayer?.powered != false &&
            store.activePlayer?.current_media?.image_url
          "
          class="w-full h-full"
        >
          <v-img
            class="media-thumb"
            style="border-radius: 4px"
            :size="innerThumbSizePx"
            :src="getMediaImageUrl(store.activePlayer.current_media.image_url)"
            :alt="$t('tooltip.artwork')"
          />
        </div>
        <!-- fallback: display player icon -->
        <div
          v-else
          class="icon-thumb"
          :style="`height: ${innerThumbSizePx}px; width: ${innerThumbSizePx}px;`"
        >
          <PlayerIcon
            :icon="store.activePlayer?.icon"
            :grouped="
              store.activePlayer?.type == PlayerType.PLAYER &&
              !!store.activePlayer?.group_members.length
            "
            :size="props.compact ? 22 : 32"
          />
        </div>
      </div>
    </template>

    <!-- title -->
    <template #title>
      <div
        :style="{
          cursor: 'pointer',
          color: primaryColor,
        }"
        class="d-flex align-center"
        @click="onTitleClick"
      >
        <!-- no player selected message -->
        <div v-if="!store.activePlayer">
          {{ $t("no_player") }}
        </div>
        <!-- player powered off: show the name so it's clear which player is off -->
        <div
          v-else-if="store.activePlayer.powered == false"
          class="ma-line-clamp-1"
        >
          {{ store.activePlayer.name }}
        </div>
        <!-- track title -->
        <div
          v-else-if="store.activePlayer.current_media?.title"
          class="ma-line-clamp-1"
          style="min-width: 0"
        >
          <MarqueeText :sync="marqueeSync">
            {{ store.activePlayer.current_media.title }}
          </MarqueeText>
        </div>
        <!-- 3rd party source active -->
        <div
          v-else-if="
            !store.activePlayerQueue && store.activePlayer.active_source
          "
          class="ma-line-clamp-1"
        >
          {{
            $t("external_source_active", [getSourceName(store.activePlayer)])
          }}
        </div>
        <!-- queue ended message: the queue is still there, it just finished -->
        <div v-else-if="queueEnded" class="ma-line-clamp-1">
          {{ $t("queue_ended") }}
        </div>
        <!-- queue empty message -->
        <div
          v-else-if="
            store.activePlayerQueue && store.activePlayerQueue.items == 0
          "
          class="ma-line-clamp-1"
        >
          {{ $t("queue_empty") }}
        </div>
        <!-- fallback: player name, so the title never renders blank -->
        <div v-else class="ma-line-clamp-1">
          {{ store.activePlayer.name }}
        </div>
      </div>
    </template>
    <!-- append chip(s): quality -->
    <template #append>
      <!-- format -->
      <div
        v-if="
          streamDetails?.audio_format.content_type &&
          !getBreakpointValue({ breakpoint: 'phone' }) &&
          showQualityDetailsBtn
        "
        class="pl-4"
      >
        <QualityDetailsBtn />
      </div>
    </template>
    <!-- subtitle: off state or artist(s) + album -->
    <template v-if="!props.compact" #subtitle>
      <!-- player powered off -->
      <div
        v-if="store.activePlayer?.powered == false"
        :style="{
          cursor: 'pointer',
          color: primaryColor,
        }"
        @click="store.showPlayersMenu = true"
      >
        {{ $t("off") }}
      </div>
      <div
        v-else-if="
          store.activePlayer?.current_media?.title &&
          (store.activePlayer?.current_media?.artist ||
            store.activePlayer?.current_media?.album)
        "
        :style="{
          cursor: 'pointer',
          color: primaryColor,
        }"
        @click="store.showFullscreenPlayer = true"
      >
        <div class="ma-line-clamp-1">
          <MarqueeText :sync="marqueeSync">
            <!-- artists(s) + album -->
            <span
              v-if="
                store.activePlayer?.current_media?.artist &&
                store.activePlayer?.current_media?.album &&
                !props.showOnlyArtist
              "
            >
              {{ store.activePlayer?.current_media?.artist }} •
              {{ store.activePlayer?.current_media?.album }}
            </span>
            <!-- artists(s) only -->
            <span v-else-if="store.activePlayer?.current_media?.artist">
              {{ store.activePlayer?.current_media?.artist }}
            </span>
            <!-- album only -->
            <span v-else-if="store.activePlayer?.current_media?.album">
              {{ store.activePlayer?.current_media?.album }}
            </span>
          </MarqueeText>
        </div>
      </div>
    </template>
  </v-list-item>
  <PlayerFullscreen :color-palette="colorPalette" />
</template>

<script setup lang="ts">
import MarqueeText from "@/components/MarqueeText.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import { isQueueEnded } from "@/helpers/queue_position";
import { ImageColorPalette, getMediaImageUrl } from "@/helpers/utils";
import { getSourceName } from "@/plugins/api/helpers";
import { PlayerType } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed } from "vue";
import PlayerFullscreen from "./PlayerFullscreen.vue";

const marqueeSync = new MarqueeTextSync();

const queueEnded = computed(() => isQueueEnded(store.activePlayerQueue));

// properties
interface Props {
  showOnlyArtist?: boolean;
  showQualityDetailsBtn?: boolean;
  colorPalette: ImageColorPalette;
  primaryColor?: string;
  /** Use a single title line and smaller artwork. */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showOnlyArtist: false,
  showQualityDetailsBtn: true,
  primaryColor: "",
  compact: false,
});

// computed properties
const streamDetails = computed(() => {
  return store.activePlayerQueue?.current_item?.streamdetails;
});

// clickable area around the artwork; matches the artwork size, except it
// also grows on wider non-compact layouts to keep a comfortable tap target
const outerThumbSizePx = computed(() => {
  if (props.compact) return 44;
  return getBreakpointValue({ breakpoint: "phone" }) ? 60 : 64;
});

const innerThumbSizePx = computed(() => (props.compact ? 44 : 60));

function onTitleClick() {
  if (!store.activePlayer || store.activePlayer.powered == false) {
    store.showPlayersMenu = true;
  } else {
    store.showFullscreenPlayer = true;
  }
}
</script>

<style scoped>
.player-media-thumb {
  margin-right: 10px;
}

.player-track-content-type {
  height: 20px !important;
  padding: 5px !important;
  padding-right: 9px !important;
  padding-left: 9px !important;
  font-weight: 500;
  font-size: 10px !important;
  letter-spacing: 0.1em;
  border-radius: 2px;
  margin-right: 30px;
}

.icon-thumb {
  width: 60px;
  height: 60px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<style>
/* this fixes missing subtitle items on webkit*/
.player-track-details .v-list-item-subtitle {
  -webkit-line-clamp: unset !important;
  line-clamp: unset !important;
}
</style>
