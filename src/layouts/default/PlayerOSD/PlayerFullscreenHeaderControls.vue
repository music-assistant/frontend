<template>
  <div class="fullscreen-header-controls">
    <!-- sleep timer countdown (only while a timer is running) -->
    <SleepTimerBtn pill />

    <!-- streaming quality details chip (moved up from under the track info) -->
    <QualityDetailsBtn v-if="store.curQueueItem?.streamdetails" pill />

    <!-- lyrics: available -> clickable toggle (fully primary while the panel is open) -->
    <!-- Transcript: split button — left toggles the panel, right toggles auto-scroll -->
    <template v-if="lyricsState === 'available' && showsTranscript">
      <ButtonGroup>
        <TooltipProvider :delay-duration="200">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost-outline"
                :size="showLabel ? 'xs' : 'icon-xs'"
                :class="[pillClass, lyricsActive ? activePillClass : '']"
                :aria-label="panelLabel"
                @click="emit('toggle-lyrics')"
              >
                <Captions :size="16" />
                <span v-if="showLabel">{{ panelLabel }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
              {{ panelToggleTooltip }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ButtonGroupSeparator />
        <TooltipProvider :delay-duration="200">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost-outline"
                :size="showLabel ? 'xs' : 'icon-xs'"
                :class="[
                  pillClass,
                  props.transcriptSyncEnabled ? activePillClass : '',
                ]"
                :aria-label="transcriptSyncToggleLabel"
                @click="emit('toggle-transcript-sync')"
              >
                <Unlink2 v-if="!props.transcriptSyncEnabled" :size="14" />
                <Link2 v-else :size="14" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
              {{ transcriptSyncToggleLabel }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ButtonGroup>
    </template>

    <!-- Regular lyrics: single button toggle -->
    <TooltipProvider
      v-else-if="lyricsState === 'available'"
      :delay-duration="200"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, lyricsActive ? activePillClass : '']"
            :aria-label="panelLabel"
            @click="emit('toggle-lyrics')"
          >
            <MicVocal :size="16" :class="{ 'mic-singing': lyricsActive }" />
            <span v-if="showLabel">{{ panelLabel }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          {{ panelToggleTooltip }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <!-- lyrics: loading or unavailable -> greyed out with an explanatory tooltip -->
    <TooltipProvider v-else-if="lyricsState !== 'none'" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="['text-muted-foreground cursor-default', pillClass]"
            :aria-label="panelLabel"
          >
            <Captions
              v-if="showsTranscript"
              :size="16"
              :class="lyricsState === 'loading' ? 'animate-pulse' : ''"
            />
            <MicVocal
              v-else
              :size="16"
              :class="lyricsState === 'loading' ? 'animate-pulse' : ''"
            />
            <span v-if="showLabel">{{ panelLabel }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          {{ lyricsTooltip }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <!-- dynamic mode: autoplay is implicitly on and the queue refills itself
         from its sources. Non-interactive indicator; the tooltip names the
         seeds it is based on. -->
    <TooltipProvider v-if="dynamicModeActive" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            as="span"
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, activePillClass, 'cursor-default']"
            :aria-label="$t('autoplay')"
          >
            <AutoplayIcon :size="16" active />
            <span v-if="showLabel">{{ $t("autoplay") }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          <p class="font-medium">{{ $t("autoplay_dynamic_title") }}</p>
          <p class="mt-1 opacity-80">
            {{
              seedNames
                ? `${$t("autoplay_dynamic_lead")} ${seedNames}`
                : $t("autoplay_dynamic_desc")
            }}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <!-- autoplay: direct toggle (primary while enabled). Hidden while dynamic
         mode is active or for infinite streams (autoplay is moot there). -->
    <TooltipProvider v-if="autoplayApplicable && queue" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, autoplayEnabled ? activePillClass : '']"
            :aria-label="$t('autoplay')"
            @click="setAutoplay(!autoplayEnabled)"
          >
            <AutoplayIcon :size="16" :active="autoplayEnabled" />
            <span v-if="showLabel">{{ $t("autoplay") }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          <p class="font-medium">
            {{
              autoplayEnabled ? $t("autoplay_disable") : $t("autoplay_enable")
            }}
          </p>
          <p v-if="!autoplayEnabled" class="mt-1 opacity-80">
            {{ $t("autoplay_explanation") }}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <!-- crossfade: direct toggle (primary while enabled). The icon slowly
         crossfades while enabled and twinkles while smart fades are active. -->
    <TooltipProvider v-if="showCrossfade && queue" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, crossfadeEnabled ? activePillClass : '']"
            :aria-label="$t('crossfade')"
            @click="toggleCrossfade"
          >
            <CrossfadeIcon
              :size="16"
              :active="crossfadeEnabled"
              :smart="crossfadeEnabled && smartFadesActive"
            />
            <span v-if="showLabel">{{ $t("crossfade") }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          <p class="font-medium">
            {{
              crossfadeEnabled
                ? $t("crossfade_disable")
                : $t("crossfade_enable")
            }}
          </p>
          <p
            v-if="crossfadeEnabled && smartFadesActive"
            class="mt-1 opacity-80"
          >
            {{ $t("crossfade_smart_active") }}
          </p>
          <p v-else-if="!crossfadeEnabled" class="mt-1 opacity-80">
            {{ $t("crossfade_explanation") }}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <ShowDashboardButton
      dashboard="now_playing"
      :player-id="store.activePlayerId"
      variant="ghost-outline"
      :button-size="showLabel ? 'xs' : 'icon-xs'"
      :icon-size="16"
      content-class="z-[10001]"
    />

    <!-- audio overlay: shown only while an overlay sound is active. Clicking it
         reopens the overlay dialog to adjust the sound or volume. -->
    <TooltipProvider v-if="overlayActive && queue" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, activePillClass]"
            :aria-label="$t('audio_overlay')"
            @click="openOverlay"
          >
            <AudioLines :size="16" />
            <span v-if="showLabel">{{ $t("audio_overlay") }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          <p class="font-medium">{{ $t("audio_overlay") }}</p>
          <p v-if="overlayName" class="mt-1 opacity-80">{{ overlayName }}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import ShowDashboardButton from "@/components/ShowDashboardButton.vue";
import SleepTimerBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SleepTimerBtn.vue";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AutoplayIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/AutoplayIcon.vue";
import CrossfadeIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/CrossfadeIcon.vue";
import { useQueueModes } from "@/layouts/default/PlayerOSD/useQueueModes";
import { useAudioOverlay } from "@/composables/useAudioOverlay";
import api from "@/plugins/api";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { AudioLines, Captions, Link2, MicVocal, Unlink2 } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  lyricsState?: string;
  lyricsActive?: boolean;
  transcriptSyncEnabled?: boolean;
}>();
const emit = defineEmits<{
  (e: "toggle-lyrics"): void;
  (e: "toggle-transcript-sync"): void;
}>();

// Explanation shown in the tooltip when lyrics can't be opened (yet).
// the same panel shows lyrics for a track and a transcript for a podcast episode
const showsTranscript = computed(
  () =>
    store.curQueueItem?.media_item?.media_type === MediaType.PODCAST_EPISODE,
);

const panelLabel = computed(() =>
  showsTranscript.value ? $t("transcript") : $t("lyrics"),
);

const panelToggleTooltip = computed(() => {
  if (showsTranscript.value) {
    return props.lyricsActive ? $t("transcript_hide") : $t("transcript_show");
  }
  return props.lyricsActive ? $t("lyrics_hide") : $t("lyrics_show");
});

const transcriptSyncToggleLabel = computed(() =>
  props.transcriptSyncEnabled
    ? $t("transcript_sync_disable")
    : $t("transcript_sync_enable"),
);

const lyricsTooltip = computed(() => {
  if (props.lyricsState === "loading") {
    return showsTranscript.value
      ? $t("transcript_loading")
      : $t("lyrics_loading");
  }
  return showsTranscript.value
    ? $t("transcript_unavailable")
    : $t("lyrics_unavailable_song");
});

// Shared dynamic/autoplay state (also used by the queue mode banner).
const {
  queue,
  sources,
  dynamicModeActive,
  autoplayEnabled,
  autoplayApplicable,
  setAutoplay,
} = useQueueModes();

// Source (seed) names for the dynamic-mode tooltip (plain text — the tooltip
// can't host links, so the banner is where they're clickable).
const seedNames = computed(() =>
  sources.value
    .map((source) => source.name)
    .filter(Boolean)
    .join(", "),
);

const showLabel = computed(() => !store.mobileLayout);

// The ghost-outline variant provides the pill look (transparent with a subtle
// border, frosted background on hover only).
const pillClass = "relative";

// Solid primary pill for the "enabled" state of the toggles.
const activePillClass =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:hover:bg-primary/90";

// --- crossfade ---
const crossfadeEnabled = computed(
  () => queue.value?.crossfade_enabled === true,
);

// the server reports smart_fades_active when the effective crossfade is "smart"
const smartFadesActive = computed(
  () => queue.value?.smart_fades_active === true,
);

// Crossfade only applies to an active queue that is playing regular tracks.
// Hide the control entirely for external sources, audiosources and radio
// streams, and while an external session owns the queue (it crossfades natively).
const showCrossfade = computed(() => {
  const q = queue.value;
  if (!q || !q.active) return false;
  if (q.queue_owner) return false;
  if (isQueueInfiniteStream(q)) return false;
  return "crossfade_enabled" in q;
});

const toggleCrossfade = () => {
  const q = queue.value;
  if (!q) return;
  api.queueCommandCrossfade(q.queue_id, !q.crossfade_enabled);
};

// --- audio overlay ---
const { openOverlayDialog } = useAudioOverlay();

const overlayActive = computed(() => queue.value?.overlay_enabled === true);
const overlayName = computed(() => queue.value?.overlay_source?.name);

const openOverlay = () => {
  const q = queue.value;
  if (q) openOverlayDialog(q.queue_id);
};
</script>

<style scoped>
.fullscreen-header-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* while the lyrics panel is open the mic gently sways, like it's being sung
   into */
.mic-singing {
  transform-origin: 50% 85%;
  animation: mic-sway 2.4s ease-in-out infinite;
}

@keyframes mic-sway {
  0%,
  100% {
    transform: rotate(-8deg);
  }
  50% {
    transform: rotate(8deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mic-singing {
    animation: none;
  }
}
</style>
