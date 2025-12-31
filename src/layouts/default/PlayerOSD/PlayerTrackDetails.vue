<template>
  <!-- now playing media -->
  <v-list-item
    class="player-track-details"
    style="height: auto; width: 100%; margin: 0px; padding: 0px"
    lines="two"
  >
    <template #prepend>
      <div
        class="media-thumb player-media-thumb"
        :style="`cursor: pointer;height: ${
          getBreakpointValue({ breakpoint: 'phone' }) ? 60 : 64
        }px; width: ${
          getBreakpointValue({ breakpoint: 'phone' }) ? 60 : 64
        }px; `"
        @click="store.showFullscreenPlayer = true"
      >
        <!-- player.current_media has content loaded (will work for all sources)  -->
        <div
          v-if="
            store.activePlayer?.powered != false &&
            store.activePlayer?.current_media?.image_url
          "
        >
          <v-img
            class="media-thumb"
            style="border-radius: 4px"
            size="60"
            :src="getMediaImageUrl(store.activePlayer.current_media.image_url)"
          />
        </div>
        <!-- fallback: display player icon -->
        <div v-else class="icon-thumb">
          <v-icon
            size="32"
            :icon="
              store.activePlayer?.type == PlayerType.PLAYER &&
              store.activePlayer?.group_members.length
                ? 'mdi-speaker-multiple'
                : store.activePlayer?.icon || 'mdi-speaker'
            "
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
      >
        <div v-if="store.activePlayer && store.activePlayer?.powered != false">
          {{ getPlayerName(store.activePlayer) }}
        </div>
        <!-- player name as title if its powered off-->
        <div
          v-else-if="store.activePlayer?.powered == false"
          @click="store.showPlayersMenu = true"
        >
          {{ store.activePlayer?.name }}
        </div>
        <!-- no player selected message -->
        <div v-else @click="store.showPlayersMenu = true">
          {{ $t("no_player") }}
        </div>
        <NowPlayingBadge
          v-if="
            store.activePlayer &&
            store.activePlayer?.powered != false &&
            store.activePlayer?.playback_state != PlaybackState.IDLE
          "
          :show-badge="false"
          :show-icon="true"
          icon-style="margin-left: 12px; margin-bottom: 4px;"
        />
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
    <!-- subtitle -->
    <template #subtitle>
      <div
        :style="{
          cursor: 'pointer',
          color: primaryColor,
        }"
        @click="store.showFullscreenPlayer = true"
      >
        <!-- player powered off -->
        <div v-if="store.activePlayer?.powered == false">
          {{ $t("off") }}
        </div>
        <template v-else-if="store.activePlayer?.current_media?.title">
          <div class="ma-line-clamp-1">
            <MarqueeText :sync="marqueeSync">
              {{ store.activePlayer.current_media.title }}
            </MarqueeText>
          </div>
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
        </template>
        <!-- 3rd party source active -->
        <div
          v-else-if="
            store.activePlayer &&
            !store.activePlayerQueue &&
            store.activePlayer?.active_source
          "
          class="ma-line-clamp-1"
        >
          {{
            $t("external_source_active", [getSourceName(store.activePlayer)])
          }}
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
        <div v-else-if="store.activePlayer">
          {{ store.activePlayer?.name }}
        </div>
      </div>
    </template>
  </v-list-item>
  <PlayerFullscreen
    :show-fullscreen="store.showFullscreenPlayer"
    :color-palette="colorPalette"
  />
</template>

<script setup lang="ts">
import MarqueeText from "@/components/MarqueeText.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import {
  ImageColorPalette,
  getMediaImageUrl,
  getPlayerName,
} from "@/helpers/utils";
import { getSourceName } from "@/plugins/api/helpers";
import { PlaybackState, PlayerType } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed } from "vue";
import PlayerFullscreen from "./PlayerFullscreen.vue";

const marqueeSync = new MarqueeTextSync();

// properties
interface Props {
  showOnlyArtist?: boolean;
  showQualityDetailsBtn?: boolean;
  colorPalette: ImageColorPalette;
  primaryColor: string;
}

const props = withDefaults(defineProps<Props>(), {
  showOnlyArtist: false,
  showQualityDetailsBtn: true,
  primaryColor: "",
});

// computed properties
const streamDetails = computed(() => {
  return store.activePlayerQueue?.current_item?.streamdetails;
});
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
