<template>
  <div class="fullscreen-header-controls">
    <!-- sleep timer countdown (only while a timer is running) -->
    <SleepTimerBtn pill />

    <!-- streaming quality details chip (moved up from under the track info) -->
    <QualityDetailsBtn v-if="store.curQueueItem?.streamdetails" pill />

    <!-- lyrics sync offset (only while lyrics are open) -->
    <Popover
      v-if="lyricsActive && showLyricsOffset"
      v-model:open="offsetOpen"
      modal
    >
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :size="showLabel ? 'xs' : 'icon-xs'"
          :class="pillClass"
          :aria-label="$t('lyrics_offset')"
        >
          <ChevronsLeftRight :size="16" />
          <span v-if="showLabel">{{ lyricsOffsetDisplay }}s</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" :side-offset="6" class="w-auto">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <ChevronsLeftRight :size="18" />
            <span class="text-[0.95rem] font-semibold">{{
              $t("lyrics_offset")
            }}</span>
          </div>
          <div class="flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="icon-sm"
              class="rounded-full"
              :aria-label="$t('tooltip.decrease_offset')"
              @click.stop
              @mousedown.stop="emit('offset-press', -0.1)"
              @touchstart.stop.prevent="emit('offset-press', -0.1)"
            >
              <Minus :size="16" />
            </Button>
            <span class="min-w-[3.5ch] text-center text-sm tabular-nums">
              {{ lyricsOffsetDisplay
              }}<span class="text-muted-foreground">s</span>
            </span>
            <Button
              variant="secondary"
              size="icon-sm"
              class="rounded-full"
              :aria-label="$t('tooltip.increase_offset')"
              @click.stop
              @mousedown.stop="emit('offset-press', 0.1)"
              @touchstart.stop.prevent="emit('offset-press', 0.1)"
            >
              <Plus :size="16" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <!-- lyrics: available -> clickable toggle (fully primary while the panel is open) -->
    <TooltipProvider v-if="lyricsState === 'available'" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[
              pillClass,
              lyricsActive
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:hover:bg-primary/90'
                : '',
            ]"
            :aria-label="$t('lyrics')"
            @click="emit('toggle-lyrics')"
          >
            <MicVocal :size="16" />
            <span v-if="showLabel">{{ $t("lyrics") }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
          {{ lyricsActive ? $t("lyrics_hide") : $t("lyrics_show") }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <!-- lyrics: loading or unavailable -> greyed out with an explanatory tooltip -->
    <TooltipProvider v-else-if="lyricsState !== 'none'" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="['text-muted-foreground cursor-default', pillClass]"
            :aria-label="$t('lyrics')"
          >
            <MicVocal
              :size="16"
              :class="lyricsState === 'loading' ? 'animate-pulse' : ''"
            />
            <span v-if="showLabel">{{ $t("lyrics") }}</span>
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
            variant="outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[
              pillClass,
              'cursor-default border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:hover:bg-primary/90',
            ]"
            :aria-label="$t('autoplay')"
          >
            <InfinityIcon :size="16" />
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
            variant="outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[
              pillClass,
              autoplayEnabled
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:hover:bg-primary/90'
                : '',
            ]"
            :aria-label="$t('autoplay')"
            @click="setAutoplay(!autoplayEnabled)"
          >
            <InfinityIcon :size="16" />
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

    <!-- crossfade: direct toggle (primary while enabled). The icon twinkles
         while smart fades are active. -->
    <TooltipProvider v-if="showCrossfade && queue" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[
              pillClass,
              crossfadeEnabled
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:hover:bg-primary/90'
                : '',
            ]"
            :aria-label="$t('crossfade')"
            @click="toggleCrossfade"
          >
            <CrossfadeIcon
              :size="16"
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

    <!-- subtle scrim/blur behind whichever popout is open -->
    <Teleport to="body">
      <Transition name="fs-popover-scrim">
        <div
          v-if="offsetOpen"
          class="fullscreen-popover-scrim"
          aria-hidden="true"
        ></div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import SleepTimerBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SleepTimerBtn.vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CrossfadeIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/CrossfadeIcon.vue";
import { useQueueModes } from "@/layouts/default/PlayerOSD/useQueueModes";
import api from "@/plugins/api";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  ChevronsLeftRight,
  InfinityIcon,
  MicVocal,
  Minus,
  Plus,
} from "@lucide/vue";
import { computed, ref } from "vue";

const props = defineProps<{
  lyricsState?: string;
  lyricsActive?: boolean;
  showLyricsOffset?: boolean;
  lyricsOffsetDisplay?: string;
}>();
const emit = defineEmits<{
  (e: "toggle-lyrics"): void;
  (e: "offset-press", delta: number): void;
}>();

// Explanation shown in the tooltip when lyrics can't be opened (yet).
const lyricsTooltip = computed(() =>
  props.lyricsState === "loading"
    ? $t("lyrics_loading")
    : $t("lyrics_unavailable_song"),
);

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

// local open-state so we can render a shared scrim behind whichever popout shows
const offsetOpen = ref(false);

const showLabel = computed(() => !store.mobileLayout);

// Frosted-glass pill styling: in light mode the outline variant uses a solid
// white background (harsh over the cover gradient), while dark mode already uses
// a translucent background. Override the light background with a translucent one
// + backdrop blur so the pills blend with the cover artwork in both themes.
const pillClass =
  "relative bg-background/40 backdrop-blur-md hover:bg-background/60";

// --- crossfade ---
const crossfadeEnabled = computed(
  () => queue.value?.crossfade_enabled === true,
);

// the server reports smart_fades_active when the effective crossfade is "smart"
const smartFadesActive = computed(
  () => queue.value?.smart_fades_active === true,
);

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
</script>

<style scoped>
.fullscreen-header-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* subtle blurred scrim behind an open popout to set it apart from the player */
.fullscreen-popover-scrim {
  position: fixed;
  inset: 0;
  z-index: 9990;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  pointer-events: none;
}

.fs-popover-scrim-enter-active,
.fs-popover-scrim-leave-active {
  transition: opacity 0.18s ease;
}

.fs-popover-scrim-enter-from,
.fs-popover-scrim-leave-to {
  opacity: 0;
}
</style>
