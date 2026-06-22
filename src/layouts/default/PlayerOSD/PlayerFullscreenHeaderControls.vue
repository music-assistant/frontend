<template>
  <div class="fullscreen-header-controls">
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

    <!-- lyrics: clickable toggle while available or still loading -->
    <Button
      v-if="lyricsState === 'available' || lyricsState === 'loading'"
      variant="outline"
      :size="showLabel ? 'xs' : 'icon-xs'"
      :class="pillClass"
      :aria-label="$t('lyrics')"
      @click="emit('toggle-lyrics')"
    >
      <MicVocal
        :size="16"
        :class="lyricsState === 'loading' ? 'animate-pulse' : ''"
      />
      <span v-if="showLabel">{{ $t("lyrics") }}</span>
      <span
        v-if="lyricsActive"
        class="bg-primary ring-background absolute -top-1 -right-1 size-2 rounded-full ring-2"
        aria-hidden="true"
      ></span>
    </Button>

    <!-- lyrics: unavailable -> short explanation popout -->
    <Popover
      v-else-if="lyricsState !== 'none'"
      v-model:open="lyricsInfoOpen"
      modal
    >
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :size="showLabel ? 'xs' : 'icon-xs'"
          :class="['text-muted-foreground', pillClass]"
          :aria-label="$t('lyrics')"
        >
          <MicVocal :size="16" />
          <span v-if="showLabel">{{ $t("lyrics") }}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" :side-offset="6" class="w-64">
        <div class="flex items-start gap-2">
          <MicVocal :size="18" class="text-muted-foreground mt-0.5 shrink-0" />
          <p class="text-muted-foreground text-sm leading-snug">
            {{
              lyricsState === "unavailable-content"
                ? $t("lyrics_unavailable_content")
                : $t("lyrics_unavailable_song")
            }}
          </p>
        </div>
      </PopoverContent>
    </Popover>

    <!-- radio mode (infinite mix) popout -->
    <Popover v-if="showRadio && queue" v-model:open="radioOpen" modal>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :size="showLabel ? 'xs' : 'icon-xs'"
          :class="[radioModeActive ? '' : 'text-muted-foreground', pillClass]"
          :aria-label="$t('radio')"
        >
          <RadioTower :size="16" />
          <span v-if="showLabel">{{ $t("radio") }}</span>
          <span
            v-if="radioModeActive"
            class="bg-primary ring-background absolute -top-1 -right-1 size-2 rounded-full ring-2"
            aria-hidden="true"
          ></span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" :side-offset="6">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <RadioTower :size="20" />
            <span class="text-[0.95rem] font-semibold">{{ $t("radio") }}</span>
          </div>

          <p class="text-muted-foreground text-sm leading-snug">
            {{ $t("radio_explanation") }}
          </p>

          <div
            v-if="radioModeActive"
            class="bg-primary/10 rounded-md px-3 py-2"
          >
            <p class="text-primary text-sm font-semibold">
              {{ $t("radio_active") }}
            </p>
            <div class="mt-1 flex flex-col gap-0.5">
              <button
                v-for="source in radioSources"
                :key="source.uri"
                type="button"
                class="text-muted-foreground hover:text-foreground truncate text-left text-sm underline-offset-2 hover:underline"
                @click="openSource(source)"
              >
                {{ source.name }}
              </button>
            </div>
          </div>

          <div v-else class="bg-accent rounded-md px-3 py-2">
            <p class="text-muted-foreground text-sm font-semibold">
              {{ $t("radio_not_active") }}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <!-- auto play (don't stop the music) popout -->
    <Popover v-if="showAutoPlay && queue" v-model:open="autoPlayOpen" modal>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :size="showLabel ? 'xs' : 'icon-xs'"
          :class="[
            autoPlayBlockedByRadio ? 'text-muted-foreground' : '',
            pillClass,
          ]"
          :aria-label="$t('auto_play')"
        >
          <InfinityIcon :size="16" />
          <span v-if="showLabel">{{ $t("auto_play") }}</span>
          <span
            v-if="autoPlayEnabled && !autoPlayBlockedByRadio"
            class="bg-primary ring-background absolute -top-1 -right-1 size-2 rounded-full ring-2"
            aria-hidden="true"
          ></span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" :side-offset="6">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <InfinityIcon :size="20" />
            <span class="text-[0.95rem] font-semibold">{{
              $t("auto_play")
            }}</span>
          </div>

          <p class="text-muted-foreground text-sm leading-snug">
            {{ $t("auto_play_explanation") }}
          </p>

          <div
            v-if="autoPlayBlockedByRadio"
            class="bg-accent rounded-md px-3 py-2"
          >
            <p class="text-muted-foreground text-sm font-semibold">
              {{ $t("auto_play_radio_active") }}
            </p>
          </div>
          <div
            v-else-if="autoPlayEnabled"
            class="bg-primary/10 rounded-md px-3 py-2"
          >
            <p class="text-primary text-sm font-semibold">
              {{ $t("auto_play_active") }}
            </p>
          </div>

          <Button
            class="mt-1 w-full"
            :variant="autoPlayEnabled ? 'outline' : 'default'"
            size="sm"
            :disabled="autoPlayBlockedByRadio"
            @click="toggleAutoPlay(!autoPlayEnabled)"
          >
            {{
              autoPlayEnabled
                ? $t("dont_stop_the_music_disable")
                : $t("dont_stop_the_music_enable")
            }}
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <!-- crossfade control with explanation popout -->
    <Popover v-if="showCrossfade && queue" v-model:open="crossfadeOpen" modal>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :size="showLabel ? 'xs' : 'icon-xs'"
          :class="pillClass"
          :aria-label="$t('crossfade')"
        >
          <CrossfadeIcon :size="16" />
          <span v-if="showLabel">{{ $t("crossfade") }}</span>
          <span
            v-if="crossfadeEnabled"
            class="bg-primary ring-background absolute -top-1 -right-1 size-2 rounded-full ring-2"
            aria-hidden="true"
          ></span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" :side-offset="6">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <CrossfadeIcon :size="20" :smart="smartFadesActive" />
            <span class="text-[0.95rem] font-semibold">{{
              $t("crossfade")
            }}</span>
          </div>

          <p class="text-muted-foreground text-sm leading-snug">
            {{ $t("crossfade_explanation") }}
          </p>

          <div
            v-if="crossfadeEnabled"
            class="rounded-md px-3 py-2"
            :class="smartFadesActive ? 'bg-primary/10' : 'bg-accent'"
          >
            <div class="flex items-start gap-2">
              <Sparkles
                v-if="smartFadesActive"
                :size="16"
                class="smart-twinkle text-primary mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p class="text-primary text-sm font-semibold">
                  {{
                    smartFadesActive
                      ? $t("crossfade_active_with_smart")
                      : $t("crossfade_active")
                  }}
                </p>
                <p
                  v-if="smartFadesActive"
                  class="text-muted-foreground mt-1 text-sm leading-snug"
                >
                  {{ $t("crossfade_smart_active") }}
                </p>
              </div>
            </div>
          </div>

          <Button
            class="mt-1 w-full"
            :variant="crossfadeEnabled ? 'outline' : 'default'"
            size="sm"
            @click="toggleCrossfade"
          >
            {{
              crossfadeEnabled
                ? $t("crossfade_disable")
                : $t("crossfade_enable")
            }}
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <!-- subtle scrim/blur behind whichever popout is open -->
    <Teleport to="body">
      <Transition name="fs-popover-scrim">
        <div
          v-if="
            radioOpen ||
            autoPlayOpen ||
            crossfadeOpen ||
            offsetOpen ||
            lyricsInfoOpen
          "
          class="fullscreen-popover-scrim"
          aria-hidden="true"
        ></div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CrossfadeIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/CrossfadeIcon.vue";
import api from "@/plugins/api";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import type { MediaItemType } from "@/plugins/api/interfaces";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import {
  ChevronsLeftRight,
  InfinityIcon,
  MicVocal,
  Minus,
  Plus,
  RadioTower,
  Sparkles,
} from "lucide-vue-next";
import { computed, ref } from "vue";

defineProps<{
  lyricsState?: string;
  lyricsActive?: boolean;
  showLyricsOffset?: boolean;
  lyricsOffsetDisplay?: string;
}>();
const emit = defineEmits<{
  (e: "toggle-lyrics"): void;
  (e: "offset-press", delta: number): void;
}>();

const queue = computed(() => store.activePlayerQueue);

// local open-state so we can render a shared scrim behind whichever popout shows
const crossfadeOpen = ref(false);
const radioOpen = ref(false);
const autoPlayOpen = ref(false);
const offsetOpen = ref(false);
const lyricsInfoOpen = ref(false);

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

// --- radio mode (infinite mix) + auto play ---
const radioSources = computed<MediaItemType[]>(
  () => queue.value?.radio_source ?? [],
);
const radioModeActive = computed(() => radioSources.value.length > 0);
const autoPlayEnabled = computed(
  () => queue.value?.dont_stop_the_music_enabled === true,
);
// Radio mode and auto play are mutually exclusive: while radio is active the
// queue keeps refilling itself, so auto play (which only kicks in when the queue
// runs out) is moot. Grey it out / disable toggling while radio mode is active.
const autoPlayBlockedByRadio = computed(() => radioModeActive.value);
// Radio (infinite mix) applies to an active queue playing the user's selection.
// Always shown for such queues so it can be opened to start the mix; it appears
// greyed-out (muted) until radio mode is actually active.
const showRadio = computed(() => {
  const q = queue.value;
  if (!q || !q.active) return false;
  if (isQueueInfiniteStream(q)) return false;
  return true;
});
const showAutoPlay = computed(() => {
  const q = queue.value;
  if (!q || !q.active) return false;
  if (isQueueInfiniteStream(q)) return false;
  return "dont_stop_the_music_enabled" in q;
});

const toggleAutoPlay = (val: boolean) => {
  const q = queue.value;
  if (!q) return;
  api.queueCommandDontStopTheMusic(q.queue_id, val);
};

const openSource = (item: MediaItemType) => {
  radioOpen.value = false;
  store.showFullscreenPlayer = false;
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
  });
};
</script>

<style scoped>
.fullscreen-header-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* gentle "twinkle" to reinforce that smart fades are active */
.smart-twinkle {
  transform-origin: center;
  animation: smart-twinkle 1.8s ease-in-out infinite;
}

@keyframes smart-twinkle {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.82) rotate(-8deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(8deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .smart-twinkle {
    animation: none;
    opacity: 1;
  }
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
