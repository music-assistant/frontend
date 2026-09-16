<template>
  <div class="fullscreen-header-controls">
    <!-- sleep timer countdown (only while a timer is running) -->
    <SleepTimerBtn pill />

    <!-- streaming quality details chip (moved up from under the track info) -->
    <QualityDetailsBtn v-if="hasActiveAudioPath" pill />

    <!-- transcript: split button - left toggles the panel, right toggles auto-scroll -->
    <template v-if="lyricsState === 'available' && showsTranscript">
      <ButtonGroup>
        <TooltipProvider :delay-duration="200">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="overlay"
                :size="showLabel ? 'default' : 'icon-sm'"
                :data-active="lyricsActive || undefined"
                :aria-pressed="lyricsActive"
                :aria-label="panelLabel"
                @click="emit('toggle-lyrics')"
              >
                <Captions />
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
                variant="overlay"
                :size="showLabel ? 'default' : 'icon-sm'"
                :data-active="props.transcriptSyncEnabled || undefined"
                :aria-pressed="props.transcriptSyncEnabled"
                :aria-label="transcriptSyncToggleLabel"
                @click="emit('toggle-transcript-sync')"
              >
                <Unlink2 v-if="!props.transcriptSyncEnabled" />
                <Link2 v-else />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
              {{ transcriptSyncToggleLabel }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ButtonGroup>
    </template>

    <!-- lyrics: available -> clickable toggle (icon turns primary while the panel is open) -->
    <TooltipProvider
      v-else-if="lyricsState === 'available'"
      :delay-duration="200"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="overlay"
            :size="showLabel ? 'default' : 'icon-sm'"
            :data-active="lyricsActive || undefined"
            :aria-pressed="lyricsActive"
            :aria-label="panelLabel"
            @click="emit('toggle-lyrics')"
          >
            <MicVocal :class="{ 'mic-singing': lyricsActive }" />
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
            variant="overlay"
            :size="showLabel ? 'default' : 'icon-sm'"
            class="text-overlay-foreground/50 cursor-default"
            :aria-label="panelLabel"
          >
            <Captions
              v-if="showsTranscript"
              :class="lyricsState === 'loading' ? 'animate-pulse' : ''"
            />
            <MicVocal
              v-else
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
            variant="overlay"
            :size="showLabel ? 'default' : 'icon-sm'"
            class="cursor-default"
            data-active="true"
            :aria-label="$t('autoplay')"
          >
            <AutoplayIcon active />
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

    <!-- autoplay: direct toggle (icon turns primary while enabled). Hidden while
         dynamic mode is active or for infinite streams (autoplay is moot there). -->
    <AutoplayRepeatLockButton
      v-if="autoplayApplicable && queue && repeatLocked"
      :aria-label="$t('autoplay')"
      aria-checked="false"
      aria-disabled="true"
      role="switch"
      :class="[
        buttonVariants({
          variant: 'overlay',
          size: showLabel ? 'default' : 'icon-sm',
        }),
        'text-overlay-foreground/50 cursor-help',
      ]"
      :description="$t('autoplay_repeat_disabled')"
    >
      <AutoplayIcon />
      <span v-if="showLabel">{{ $t("autoplay") }}</span>
    </AutoplayRepeatLockButton>
    <TooltipProvider
      v-else-if="autoplayApplicable && queue"
      :delay-duration="200"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="overlay"
            :size="showLabel ? 'default' : 'icon-sm'"
            :data-active="autoplayEnabled || undefined"
            :aria-pressed="autoplayEnabled"
            :aria-label="$t('autoplay')"
            @click="setAutoplay(!autoplayEnabled)"
          >
            <AutoplayIcon :active="autoplayEnabled" />
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

    <!-- crossfade: direct toggle (icon turns primary while enabled) -->
    <TooltipProvider v-if="showCrossfade && queue" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="overlay"
            :size="showLabel ? 'default' : 'icon-sm'"
            :data-active="crossfadeEnabled || undefined"
            :aria-pressed="crossfadeEnabled"
            :aria-label="$t('crossfade')"
            @click="toggleCrossfade"
          >
            <CrossfadeIcon :smart="smartCrossfadeActive" />
            <span v-if="showLabel">{{ $t("crossfade") }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          <p class="font-medium">{{ $t("crossfade") }}</p>
          <p class="mt-1 opacity-80">{{ crossfadeDescription }}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <ShowDashboardButton
      dashboard="now_playing"
      :player-id="store.activePlayerId"
      variant="overlay"
      :button-size="showLabel ? 'icon' : 'icon-sm'"
      content-class="z-[10001]"
    />

    <!-- audio overlay: shown only while an overlay sound is active. Clicking it
         reopens the overlay dialog to adjust the sound or volume. -->
    <TooltipProvider v-if="overlayActive && queue" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="overlay"
            :size="showLabel ? 'default' : 'icon-sm'"
            data-active="true"
            :aria-label="$t('audio_overlay')"
            @click="openOverlay"
          >
            <AudioLines />
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
import { Button, buttonVariants } from "@/components/ui/button";
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
import AutoplayRepeatLockButton from "@/layouts/default/PlayerOSD/AutoplayRepeatLockButton.vue";
import { useQueueModes } from "@/layouts/default/PlayerOSD/useQueueModes";
import { useActiveAudioPath } from "@/composables/useActiveAudioPath";
import { useAudioOverlay } from "@/composables/useAudioOverlay";
import api from "@/plugins/api";
import {
  isQueueInfiniteStream,
  queueSourceCrossfadeProvider,
} from "@/plugins/api/helpers";
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

// The same panel shows lyrics for a track and a transcript for a podcast episode.
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

// Explanation shown in the tooltip when the panel can't be opened (yet).
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

const { hasActiveAudioPath } = useActiveAudioPath();

// Shared dynamic/autoplay state (also used by the queue mode banner).
const {
  queue,
  sources,
  dynamicModeActive,
  autoplayEnabled,
  repeatLocked,
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

// Phones get icon-only 32px controls so the row fits; desktop matches the
// 36px hero buttons with their labels.
const showLabel = computed(() => !store.mobileLayout);

// --- crossfade ---
const crossfadeEnabled = computed(
  () => queue.value?.crossfade_enabled === true,
);

// the server reports smart_fades_active when the effective crossfade is "smart"
const smartFadesActive = computed(
  () => queue.value?.smart_fades_active === true,
);

const sourceCrossfadeName = computed(() => {
  const provider = queueSourceCrossfadeProvider(queue.value);
  return provider ? api.getProviderName(provider) : undefined;
});
const smartCrossfadeActive = computed(
  () =>
    crossfadeEnabled.value &&
    smartFadesActive.value &&
    !sourceCrossfadeName.value,
);
const crossfadeDescription = computed(() => {
  if (!crossfadeEnabled.value) return $t("crossfade_explanation");
  if (sourceCrossfadeName.value) {
    return $t("streamdetails.audio_processing.crossfade_mode.source", [
      sourceCrossfadeName.value,
    ]);
  }
  return smartFadesActive.value
    ? $t("streamdetails.audio_processing.crossfade_mode.smart")
    : $t("streamdetails.audio_processing.crossfade_mode.standard");
});

// Crossfade only applies to an active queue that is playing regular tracks.
// Hide the control entirely for external sources, audiosources and radio streams.
const showCrossfade = computed(() => {
  const q = queue.value;
  if (!q || !q.active) return false;
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
