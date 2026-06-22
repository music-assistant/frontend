<template>
  <DropdownMenu v-if="currentItem">
    <DropdownMenuTrigger as-child>
      <Button variant="icon" :ripple="false" icon :title="$t('more_options')">
        <EllipsisIcon />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="z-[100001]">
      <DropdownMenuItem @click="onToggleFavorite">
        <Heart
          class="size-4"
          :fill="currentItem?.favorite ? 'currentColor' : 'none'"
        />
        {{
          currentItem?.favorite ? $t("favorites_remove") : $t("favorites_add")
        }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="onAddToPlaylist">
        <PlusCircle class="size-4" />
        {{ $t("add_playlist") }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="onShowInfo">
        <Info class="size-4" />
        {{ $t("show_info") }}
      </DropdownMenuItem>
      <DropdownMenuItem v-if="radioModeSupported" @click="onStartRadio">
        <RadioTower class="size-4" />
        {{ $t("play_radio") }}
      </DropdownMenuItem>
      <DropdownMenuItem
        v-if="playbackSpeedSupported"
        @click="onOpenPlaybackSpeed"
      >
        <Gauge class="size-4" />
        {{ $t("change_playback_speed") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <Dialog v-model:open="playbackSpeedDialogOpen">
    <DialogContent class="playback-speed-dialog">
      <DialogHeader>
        <DialogTitle>{{ $t("change_playback_speed") }}</DialogTitle>
      </DialogHeader>
      <div class="playback-speed-current">
        {{ formatSpeed(currentPlaybackSpeed) }}
      </div>
      <Slider
        :model-value="[sliderPlaybackSpeed]"
        :min="PLAYBACK_SPEED_SLIDER_MIN"
        :max="PLAYBACK_SPEED_SLIDER_MAX"
        :step="0.05"
        class="playback-speed-slider"
        @update:model-value="onSliderPlaybackSpeed"
      />
      <div class="playback-speed-options">
        <Button
          v-for="option in PLAYBACK_SPEED_OPTIONS"
          :key="option"
          :variant="option === currentPlaybackSpeed ? 'default' : 'plain'"
          @click="onSelectPlaybackSpeed(option)"
        >
          {{ formatSpeed(option) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import api from "@/plugins/api";
import { isQueueDynamicPlaylist } from "@/plugins/api/helpers";
import {
    MediaType,
    ProviderFeature,
    QueueOption,
    type Audiobook,
    type PodcastEpisode,
    type Radio,
    type Track,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import {
    EllipsisIcon,
    Gauge,
    Heart,
    Info,
    PlusCircle,
    RadioTower,
} from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const PLAYBACK_SPEED_OPTIONS = [1, 1.25, 1.5, 2, 3] as const;
const PLAYBACK_SPEED_SLIDER_MIN = 0.5;
const PLAYBACK_SPEED_SLIDER_MAX = 2;

const playbackSpeedDialogOpen = ref(false);
const currentPlaybackSpeed = ref<number>(1);

const formatSpeed = (value: number) =>
  Number.isInteger(value) ? value.toFixed(1) : value.toString();

// Slider only spans 0.5–2.0; values outside (e.g. the 3.0 preset) peg the
// thumb at the corresponding end so the slider stays in sync visually.
const sliderPlaybackSpeed = computed(() =>
  Math.min(
    PLAYBACK_SPEED_SLIDER_MAX,
    Math.max(PLAYBACK_SPEED_SLIDER_MIN, currentPlaybackSpeed.value),
  ),
);

const currentTrack = computed(() => {
  const item = store.curQueueItem?.media_item;
  if (item?.media_type === MediaType.TRACK) return item as Track;
  return undefined;
});

const currentRadio = computed(() => {
  const item = store.curQueueItem?.media_item;
  if (item?.media_type === MediaType.RADIO) return item as Radio;
  return undefined;
});

const currentAudiobook = computed(() => {
  const item = store.curQueueItem?.media_item;
  if (item?.media_type === MediaType.AUDIOBOOK) return item as Audiobook;
  return undefined;
});

const currentPodcastEpisode = computed(() => {
  const item = store.curQueueItem?.media_item;
  if (item?.media_type === MediaType.PODCAST_EPISODE)
    return item as PodcastEpisode;
  return undefined;
});

const currentItem = computed(
  () =>
    currentTrack.value ??
    currentRadio.value ??
    currentAudiobook.value ??
    currentPodcastEpisode.value,
);

const playbackSpeedSupported = computed(
  () => !!(currentAudiobook.value || currentPodcastEpisode.value),
);

watch(
  () => store.curQueueItem,
  (queueItem) => {
    currentPlaybackSpeed.value =
      queueItem?.extra_attributes?.playback_speed ?? 1;
  },
  { immediate: true },
);

const radioModeSupported = computed(() => {
  const item = currentTrack.value;
  if (!item) return false;
  // hide radio mode for dynamic playlists
  const queue = store.activePlayer
    ? api.queues[store.activePlayer.player_id]
    : undefined;
  if (isQueueDynamicPlaylist(queue)) return false;
  for (const provId of item.provider_mappings) {
    if (
      api.providers[provId.provider_instance]?.supported_features.includes(
        ProviderFeature.SIMILAR_TRACKS,
      )
    )
      return true;
  }
  // generic radio mode: any provider supports SIMILAR_TRACKS and track is in library
  if (item.provider === "library") {
    for (const prov of Object.values(api.providers)) {
      if (prov.supported_features.includes(ProviderFeature.SIMILAR_TRACKS))
        return true;
    }
  }
  return false;
});

const onAddToPlaylist = () => {
  if (!currentItem.value) return;
  eventbus.emit("playlistdialog", { items: [currentItem.value] });
};

const onShowInfo = () => {
  const item = currentItem.value;
  if (!item) return;
  const query = currentTrack.value?.album?.uri
    ? { album: currentTrack.value.album.uri }
    : {};
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
    query,
  });
};

const onToggleFavorite = () => {
  if (!currentItem.value) return;
  api.toggleFavorite(currentItem.value);
};

const onStartRadio = () => {
  if (!currentTrack.value) return;
  api.playMedia([currentTrack.value.uri], QueueOption.REPLACE, true);
};

const onOpenPlaybackSpeed = () => {
  // Sync from latest queue state before opening so the displayed value is
  // current even if the queue item updated since the menu was last touched.
  currentPlaybackSpeed.value =
    store.curQueueItem?.extra_attributes?.playback_speed ?? 1;
  playbackSpeedDialogOpen.value = true;
};

// Debounce backend updates so dragging the slider doesn't spam the API —
// only the value held for >=1s gets sent. If the dialog is closed before
// the timer fires, the pending change is flushed immediately.
const PLAYBACK_SPEED_DEBOUNCE_MS = 1000;
let speedDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSpeed: {
  value: number;
  queueId: string;
  queueItemId: string;
} | null = null;

const flushPendingSpeed = () => {
  if (speedDebounceTimer !== null) {
    clearTimeout(speedDebounceTimer);
    speedDebounceTimer = null;
  }
  if (!pendingSpeed) return;
  const { value, queueId, queueItemId } = pendingSpeed;
  pendingSpeed = null;
  api.queueCommandSetPlaybackSpeed(queueId, value, queueItemId);
};

const applyPlaybackSpeed = (value: number) => {
  currentPlaybackSpeed.value = value;
  const queueItem = store.curQueueItem;
  if (!queueItem) return;
  pendingSpeed = {
    value,
    queueId: queueItem.queue_id,
    queueItemId: queueItem.queue_item_id,
  };
  if (speedDebounceTimer !== null) clearTimeout(speedDebounceTimer);
  speedDebounceTimer = setTimeout(
    flushPendingSpeed,
    PLAYBACK_SPEED_DEBOUNCE_MS,
  );
};

const onSelectPlaybackSpeed = (value: number) => {
  applyPlaybackSpeed(value);
};

const onSliderPlaybackSpeed = (value: number[] | undefined) => {
  if (!value || value.length === 0) return;
  applyPlaybackSpeed(Math.round(value[0] * 100) / 100);
};

// Flush any pending change as soon as the dialog closes, so the user's
// final selection is sent even if they close before the 1s window elapses.
watch(playbackSpeedDialogOpen, (open) => {
  if (!open) flushPendingSpeed();
});

onBeforeUnmount(flushPendingSpeed);
</script>

<style scoped>
/* Anchor the dialog near the player bar (bottom-right) instead of the
   default screen-centre, so it appears close to the overflow menu that
   opened it. */
.playback-speed-dialog {
  width: 360px;
  max-width: calc(100vw - 2rem) !important;
  top: auto !important;
  left: auto !important;
  right: 1rem !important;
  bottom: calc(env(safe-area-inset-bottom, 0) + 6rem) !important;
  transform: none !important;
}

.playback-speed-current {
  text-align: center;
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  padding: 4px 0 8px;
  opacity: 0.85;
}

.playback-speed-slider {
  width: 100%;
  margin-bottom: 12px;
}

.playback-speed-options {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: center;
  padding: 4px 0 0;
}

.playback-speed-options > * {
  flex: 1 1 0;
  min-width: 0;
  border: 1px solid var(--border, hsl(var(--border, 0 0% 80%)));
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}
</style>
