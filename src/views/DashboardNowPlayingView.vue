<template>
  <div class="now-playing-view" :style="{ background: backgroundGradient }">
    <VisualizerCanvas
      v-if="visualizerActive"
      :preset="visualizerPresetPref"
      :blur="visualizerBlurPref"
      :opacity="visualizerOpacityPref"
      :player-id="store.activePlayer?.player_id"
      covered-when-fullscreen
    />
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
          <!-- placeholder when no artist, so the artwork position stays fixed -->
          <MarqueeText :sync="marqueeSync" class="now-playing-subtitle">
            {{ store.activePlayer.current_media?.artist || " " }}
          </MarqueeText>
        </template>
      </div>

      <div class="now-playing-timeline">
        <PlayerTimeline
          :show-labels="true"
          :color="timelineColor"
          :waveform="waveformData"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import MarqueeText from "@/components/MarqueeText.vue";
import VisualizerCanvas from "@/components/VisualizerCanvas.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import { useActiveTrackWaveform } from "@/composables/useActiveTrackWaveform";
import { useUserPreferences } from "@/composables/userPreferences";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import {
  type ImageColorPalette,
  getMediaImageUrl,
  paletteFromServer,
} from "@/helpers/utils";
import PlayerTimeline from "@/layouts/default/PlayerOSD/PlayerTimeline.vue";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  visualizerProviderAvailable,
  visualizerShownOnDashboards,
} from "@/plugins/visualizer-relay";
import { useColorMode } from "@vueuse/core";
import Color from "color";
import { computed, onMounted, ref, watch } from "vue";
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
const { waveformBins: waveformData } = useActiveTrackWaveform();

const artworkUrl = computed(
  () => getMediaImageUrl(store.activePlayer?.current_media?.image_url) || null,
);

const { getPreference } = useUserPreferences();
// No stored preference means "not chosen": a cast dashboard runs as the
// dashboard viewer, which has none and cannot set any, so the plugin's
// show_on_dashboards setting decides there. An explicit choice always wins.
const showOnDashboards = ref(false);
// Watched rather than fetched once on mount: a cast receiver boots straight into
// this route, so the providers map is often still loading when the view mounts.
watch(
  () => visualizerProviderAvailable(),
  async (available) => {
    if (available) showOnDashboards.value = await visualizerShownOnDashboards();
  },
  { immediate: true },
);
const visualizerEnabledStored = getPreference<boolean>("visualizer_enabled");
const visualizerEnabledPref = computed(
  () => visualizerEnabledStored.value ?? showOnDashboards.value,
);
const visualizerPresetPref = getPreference("visualizer_preset", "");
const visualizerBlurPref = getPreference("visualizer_blur", 0);
const visualizerOpacityPref = getPreference("visualizer_opacity", 100);
const visualizerActive = computed(
  () => visualizerEnabledPref.value && visualizerProviderAvailable(),
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
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3vh;
  /* Deeper bottom padding lifts the timeline clear of the screen edge. */
  padding: 5vh 5vw 9vh;
  box-sizing: border-box;
  color: var(--text-color, #fff);
}

/* Lift content above the visualizer layer (z-index 0). */
.now-playing-view > *:not(.visualizer-layer) {
  position: relative;
  z-index: 1;
}

/* Keep the vh fallback in a separate rule: the minifier collapses duplicate
   declarations, which would drop it and leave Android TV without a height. */
@supports (height: 100dvh) {
  .now-playing-view {
    height: 100dvh;
  }
}

.now-playing-empty {
  font-size: 1.5rem;
  opacity: 0.7;
}

/* The row hugs the artwork rather than growing, so the leftover height is
   shared with the auto margins below instead of pooling under the artwork. */
.now-playing-artwork {
  flex: 0 0 auto;
  margin-top: auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.now-playing-artwork-image {
  /* flex-basis auto with no shrink: the square must never be squashed to fit */
  flex: 0 0 auto;
  width: min(52vh, 85vw);
  height: min(52vh, 85vw);
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.now-playing-artwork-fallback {
  flex: 0 0 auto;
  width: min(52vh, 85vw);
  height: min(52vh, 85vw);
  aspect-ratio: 1;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
}

.now-playing-info {
  flex: 0 0 auto;
  /* Centres the text between the artwork and the timeline. */
  margin-block: auto;
  width: 100%;
  max-width: 900px;
  text-align: center;
  overflow: hidden;
}

/* A Nest Hub (1024x600) and a Chromecast on a TV (1280x720) report almost the
   same viewport, so the steep slope plus a cap that bites around 1070px is what
   lets the Hub catch up without the TV growing much. */
.now-playing-title {
  font-size: clamp(1.25rem, 3vw, 2rem);
  font-weight: 600;
}

.now-playing-subtitle {
  font-size: clamp(1rem, 2.2vw, 1.5rem);
  opacity: 0.8;
  margin-top: 0.25rem;
}

.now-playing-timeline {
  flex: 0 0 auto;
  width: 100%;
  max-width: 900px;
}

/* The timeline's elapsed/total labels come from a shared Vuetify caption class;
   scale them here only, so the rest of the app keeps its 12px captions. */
.now-playing-timeline :deep(.text-caption) {
  font-size: clamp(0.75rem, 1.3vw, 0.9375rem);
}
</style>
