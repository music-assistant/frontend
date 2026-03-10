<template>
  <!-- now playing media -->
  <div class="player-track-details flex w-full items-center">
    <!-- prepend: album art / player icon -->
    <div
      class="player-media-thumb relative shrink-0"
      :style="`cursor: pointer; height: ${
        getBreakpointValue({ breakpoint: 'phone' }) ? 60 : 64
      }px; width: ${
        getBreakpointValue({ breakpoint: 'phone' }) ? 60 : 64
      }px;`"
      @click="store.showFullscreenPlayer = true"
    >
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
      <div
        v-if="
          store.activePlayer &&
          store.activePlayer?.powered != false &&
          store.activePlayer?.playback_state != PlaybackState.IDLE
        "
        class="absolute bottom-0 right-0"
      >
        <NowPlayingBadge :show-badge="false" :show-icon="true" />
      </div>
    </div>

    <!-- content: title + subtitle -->
    <div class="min-w-0 flex-1">
      <!-- title -->
      <div
        :style="{ cursor: 'pointer', color: primaryColor }"
        class="flex items-center"
      >
        <div v-if="store.activePlayer && store.activePlayer?.powered != false">
          {{ getPlayerName(store.activePlayer) }}
        </div>
        <div
          v-else-if="store.activePlayer?.powered == false"
          @click="store.showPlayersMenu = true"
        >
          {{ store.activePlayer?.name }}
        </div>
        <div v-else @click="store.showPlayersMenu = true">
          {{ $t("no_player") }}
        </div>
      </div>

      <!-- subtitle -->
      <div
        :style="{ cursor: 'pointer', color: primaryColor }"
        class="text-sm opacity-70"
        @click="store.showFullscreenPlayer = true"
      >
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
              <span v-else-if="store.activePlayer?.current_media?.artist">
                {{ store.activePlayer?.current_media?.artist }}
              </span>
              <span v-else-if="store.activePlayer?.current_media?.album">
                {{ store.activePlayer?.current_media?.album }}
              </span>
            </MarqueeText>
          </div>
        </template>
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
    </div>

    <!-- append: quality details -->
    <div
      v-if="
        streamDetails?.audio_format.content_type &&
        !getBreakpointValue({ breakpoint: 'phone' }) &&
        showQualityDetailsBtn
      "
      class="shrink-0 pl-4"
    >
      <QualityDetailsBtn />
    </div>
  </div>
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
