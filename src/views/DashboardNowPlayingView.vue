<template>
  <div class="now-playing-view" :style="{ background: backgroundGradient }">
    <div v-if="!store.activePlayer" class="now-playing-empty">
      {{ $t("no_player") }}
    </div>
    <template v-else>
      <div class="now-playing-artwork">
        <img
          v-if="artworkUrl"
          :src="artworkUrl"
          :alt="$t('tooltip.artwork')"
          class="now-playing-artwork-image"
        />
        <div v-else class="now-playing-artwork-fallback">
          <PlayerIcon :icon="store.activePlayer.icon" :size="160" />
        </div>
      </div>

      <div class="now-playing-info">
        <div
          v-if="store.activePlayer.powered === false"
          class="now-playing-title"
        >
          {{ store.activePlayer.name }}
        </div>
        <template v-else>
          <MarqueeText :sync="marqueeSync" class="now-playing-title">
            {{
              store.activePlayer.current_media?.title || store.activePlayer.name
            }}
          </MarqueeText>
          <MarqueeText
            v-if="store.activePlayer.current_media?.artist"
            :sync="marqueeSync"
            class="now-playing-subtitle"
          >
            {{ store.activePlayer.current_media.artist }}
          </MarqueeText>
        </template>
      </div>

      <div class="now-playing-timeline">
        <PlayerTimeline
          :show-labels="true"
          :color="timelineColor"
          :waveform="waveformData"
          :waveform-loading="waveformLoading"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import MarqueeText from "@/components/MarqueeText.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import { useActiveTrackWaveform } from "@/composables/useActiveTrackWaveform";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import {
  type ImageColorPalette,
  getMediaImageUrl,
  paletteFromServer,
} from "@/helpers/utils";
import PlayerTimeline from "@/layouts/default/PlayerOSD/PlayerTimeline.vue";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { useColorMode } from "@vueuse/core";
import Color from "color";
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

// Pin the active player to whichever one this dashboard was cast for.
onMounted(() => {
  const playerId = route.query.player;
  if (typeof playerId === "string" && playerId) {
    store.activePlayerId = playerId;
  }
});

// Synced marquee scrolling for the title/artist, same as the fullscreen player.
const marqueeSync = new MarqueeTextSync();

// Waveform is always on here: the guest session has no show_waveform preference, so it defaults on.
const { waveformBins: waveformData, waveformLoading } =
  useActiveTrackWaveform();

const artworkUrl = computed(
  () => getMediaImageUrl(store.activePlayer?.current_media?.image_url) || null,
);

const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === "dark");

const colorPalette = computed<ImageColorPalette>(() =>
  paletteFromServer(store.activePlayer?.current_media?.palette),
);

const timelineColor = computed(() => (isDark.value ? "#ffffff" : "#000000"));

// Same gradient treatment as the fullscreen player background.
const backgroundGradient = computed(() => {
  const bgHex = isDark.value
    ? colorPalette.value.darkColor || "#000"
    : colorPalette.value.lightColor || "#fff";
  const bgColor = Color(bgHex);
  const topColor = bgColor.lighten(0.25);
  const bottomColor = bgColor.darken(0.25);
  return `linear-gradient(to bottom, ${topColor.hex()}, ${bottomColor.hex()})`;
});
</script>

<style scoped>
.now-playing-view {
  width: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5vh;
  padding: 5vh 5vw;
  box-sizing: border-box;
  color: var(--text-color, #fff);
}

.now-playing-empty {
  font-size: 1.5rem;
  opacity: 0.7;
}

.now-playing-artwork {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.now-playing-artwork-image {
  max-width: min(70vh, 90%);
  max-height: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.now-playing-artwork-fallback {
  width: min(70vh, 90%);
  aspect-ratio: 1;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
}

.now-playing-info {
  flex: 0 0 auto;
  width: 100%;
  max-width: 900px;
  text-align: center;
  overflow: hidden;
}

.now-playing-title {
  font-size: clamp(1.5rem, 4vw, 3rem);
  font-weight: 600;
}

.now-playing-subtitle {
  font-size: clamp(1rem, 2.5vw, 1.75rem);
  opacity: 0.8;
  margin-top: 0.5rem;
}

.now-playing-timeline {
  flex: 0 0 auto;
  width: 100%;
  max-width: 900px;
}
</style>
