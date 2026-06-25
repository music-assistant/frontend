<!--
  A single row in the fullscreen player's unified queue list.

  Dedicated, shadcn/Tailwind-based replacement for the generic (Vuetify)
  ListItem when rendering PlayerQueue items. It is state-aware so the list can
  visually distinguish already played tracks, the currently playing track, the
  items locked in the stream buffer and the freely reorderable up-next items.
-->
<template>
  <div
    class="qitem"
    :class="{
      'qitem--played': state === 'played',
      'qitem--playing': state === 'playing',
      'qitem--buffered': state === 'buffered',
      'qitem--unavailable': !item.available,
      'qitem--dragging': dragging,
      'qitem--ghost': ghost,
    }"
    :data-queue-current="state === 'playing' ? 'true' : undefined"
    role="button"
    tabindex="0"
    @click="emit('click', $event)"
    @contextmenu.prevent="emit('menu', $event)"
    @keydown.enter.prevent="emit('click', $event)"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <!-- thumbnail (with now-playing equalizer overlay) -->
    <div class="qitem__thumb">
      <MediaItemThumb size="48" :item="item" />
      <div v-if="showEqualizer" class="qitem__eq" aria-hidden="true">
        <NowPlayingBadge :show-badge="false" :show-icon="true" />
      </div>
    </div>

    <!-- title + subtitle -->
    <div class="qitem__body">
      <MarqueeText :sync="marqueeSync" :disabled="!marqueeActive">
        <span class="qitem__title">{{ item.name }}</span>
      </MarqueeText>
      <div class="qitem__subtitle">
        <span class="qitem__duration">{{ formatDuration(item.duration) }}</span>
        <template v-if="albumName">
          <span class="qitem__sep">·</span>
          <MarqueeText
            class="qitem__album"
            :sync="marqueeSync"
            :disabled="!marqueeActive"
          >
            <span>{{ albumName }}</span>
          </MarqueeText>
        </template>
      </div>
    </div>

    <!-- trailing badges + actions -->
    <div class="qitem__append">
      <PartyPlayerBadge
        v-if="item.extra_attributes?.party_guest === true"
        :type="
          item.extra_attributes?.party_boosted === true ? 'boost' : 'request'
        "
        :badge-color="
          item.extra_attributes?.party_boosted === true
            ? boostBadgeColor
            : requestBadgeColor
        "
      />
      <!-- buffered indicator: already loaded into the stream to play next -->
      <TooltipProvider v-if="state === 'buffered'" :delay-duration="200">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="qitem__info" @click.stop>
              <InfoIcon class="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" class="z-[10001] max-w-[240px]">
            {{ $t("queue_buffered_explanation") }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TriangleAlertIcon
        v-if="!item.available"
        class="size-4 shrink-0 text-destructive"
      />
      <!-- drag handle to reorder (up-next items only) -->
      <button
        v-if="state === 'upcoming'"
        type="button"
        class="qitem__action qitem__grip"
        :aria-label="$t('queue_reorder')"
        @pointerdown.stop.prevent="emit('dragstart', $event)"
        @click.stop
        @contextmenu.prevent
      >
        <GripVerticalIcon class="size-4" />
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="qitem__action qitem__menu"
        :aria-label="$t('queue_options')"
        @click.stop="emit('menu', $event)"
        @pointerdown.stop
      >
        <EllipsisVerticalIcon class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarqueeText from "@/components/MarqueeText.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import PartyPlayerBadge from "@/components/party/PartyPlayerBadge.vue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import { formatDuration } from "@/helpers/utils";
import { QueueItem } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  EllipsisVerticalIcon,
  GripVerticalIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "@lucide/vue";
import { computed, ref } from "vue";

export type QueueItemState = "played" | "playing" | "buffered" | "upcoming";

interface Props {
  item: QueueItem;
  state: QueueItemState;
  // Whether the player is actually rendering audio (drives the equalizer).
  isPlaying?: boolean;
  // Shared marquee sync group so the visible scrolling title(s) stay in sync.
  marqueeSync?: MarqueeTextSync;
  requestBadgeColor?: string;
  boostBadgeColor?: string;
  // Whether this row is the one currently being dragged to reorder.
  dragging?: boolean;
  // Whether this is the floating "ghost" clone that follows the pointer.
  ghost?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
  marqueeSync: undefined,
  requestBadgeColor: "#2196f3",
  boostBadgeColor: "#ff5722",
  dragging: false,
  ghost: false,
});

const emit = defineEmits<{
  (e: "click", event: Event): void;
  (e: "menu", event: Event): void;
  (e: "dragstart", event: PointerEvent): void;
}>();

const hovered = ref(false);

// Only animate the title/album marquee for the now-playing track, or while a
// row is hovered — keeps the list calm and avoids dozens of scrolling rows.
const marqueeActive = computed(
  () => props.state === "playing" || hovered.value,
);

const showEqualizer = computed(
  () => props.state === "playing" && props.isPlaying,
);

const albumName = computed(() => {
  const mediaItem = props.item.media_item;
  if (mediaItem && "album" in mediaItem && mediaItem.album) {
    return mediaItem.album.name;
  }
  return "";
});
</script>

<style scoped>
.qitem {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-color, currentColor);
  transition:
    background-color 0.12s ease,
    opacity 0.12s ease;
  user-select: none;
}

.qitem:hover {
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 8%,
    transparent
  );
}

.qitem--played {
  opacity: 0.5;
}

.qitem--played:hover {
  opacity: 0.72;
}

.qitem--playing {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

.qitem--playing:hover {
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}

/* Buffered = already loaded into the stream and locked to play next. Sits in
   the "up next" list but keeps a faint tint so it reads as already cued. */
.qitem--buffered {
  background: color-mix(in srgb, var(--primary) 5%, transparent);
}

.qitem--buffered:hover {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.qitem--unavailable {
  opacity: 0.5;
}

.qitem__thumb {
  position: relative;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
}

.qitem__eq {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.qitem__body {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.qitem__title {
  font-size: var(--queue-title-size, 0.9rem);
  font-weight: 500;
  line-height: 1.3;
}

.qitem--playing .qitem__title {
  color: var(--primary);
  font-weight: 600;
}

.qitem__subtitle {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 1px;
  font-size: var(--queue-subtitle-size, 0.78rem);
  opacity: 0.7;
}

.qitem__duration {
  white-space: nowrap;
}

.qitem__sep {
  opacity: 0.6;
}

.qitem__album {
  min-width: 0;
  overflow: hidden;
}

.qitem__append {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.qitem__info {
  display: inline-flex;
  align-items: center;
  color: var(--text-color, currentColor);
  cursor: help;
  opacity: 0.5;
}

.qitem__info:hover {
  opacity: 0.85;
}

.qitem__action {
  opacity: 0;
}

.qitem:hover .qitem__action,
.qitem:focus-within .qitem__action {
  opacity: 1;
}

/* Touch devices have no hover — always reveal the action affordances. */
@media (hover: none) {
  .qitem__action {
    opacity: 1;
  }
}

/* Drag handle: a plain button (not a shadcn Button) so we fully control the
   pointer gesture. Sized to match the icon-sm buttons beside it. */
.qitem__grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
  color: var(--text-color, currentColor);
  cursor: grab;
  /* Stop the browser from hijacking the gesture as a scroll on touch. */
  touch-action: none;
}

.qitem__grip:hover {
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 12%,
    transparent
  );
}

/* The source row stays in place but invisible while dragging — the floating
   ghost is its stand-in, and the other rows slide to open the landing gap. */
.qitem--dragging {
  opacity: 0;
  pointer-events: none;
}

.qitem--dragging .qitem__grip {
  cursor: grabbing;
}

/* The floating clone that tracks the pointer. Tinted with the same themed
   color the rows use (no clashing gray) and lifted with a soft shadow so it
   reads as picked-up, not detached. Its own action buttons are hidden. */
.qitem--ghost {
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 10%,
    transparent
  );
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  cursor: grabbing;
}

.qitem--ghost .qitem__action {
  display: none;
}
</style>
