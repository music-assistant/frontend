<template>
  <div
    v-hold="onMenu"
    :class="[TRACK_TABLE_GRID_CLASS, { 'opacity-30': !isAvailable }]"
    class="group h-14 cursor-pointer rounded-md hover:bg-accent"
    :style="{ gridTemplateColumns: gridTemplate }"
    @click="onClick"
    @click.right.prevent="onMenu"
  >
    <template v-for="column in columns" :key="column">
      <!-- drags the row to a new place; the arrow keys move it one place -->
      <div v-if="column === 'handle'" class="flex justify-center">
        <button
          type="button"
          class="flex h-10 w-5 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
          :aria-label="reorderLabel"
          :title="reorderLabel"
          @pointerdown.stop.prevent="emit('dragStart', $event)"
          @touchstart.stop
          @keydown.up.prevent="emit('moveBy', -1)"
          @keydown.down.prevent="emit('moveBy', 1)"
          @click.stop
        >
          <GripVertical class="size-4" aria-hidden="true" />
        </button>
      </div>

      <!-- position, or the selection checkbox -->
      <div
        v-else-if="column === 'number'"
        class="flex text-sm tabular-nums text-muted-foreground"
      >
        <Checkbox
          v-if="showCheckboxes"
          :model-value="isSelected"
          :aria-label="item.name"
          @click.stop
          @update:model-value="onSelect"
        />
        <NowPlayingBadge
          v-else-if="isPlaying"
          :show-badge="false"
          icon-style="margin: 0"
        />
        <span v-else>{{ position }}</span>
      </div>

      <!-- artwork, title and artists -->
      <div
        v-else-if="column === 'title'"
        class="flex min-w-0 items-center gap-3"
      >
        <Checkbox
          v-if="showCheckboxes && !columns.includes('number')"
          :model-value="isSelected"
          :aria-label="item.name"
          @click.stop
          @update:model-value="onSelect"
        />
        <div class="relative size-10 shrink-0 overflow-hidden rounded-sm">
          <MediaItemThumb
            size="40"
            :item="isAvailable ? item : undefined"
            alt=""
          />
          <button
            v-if="showHoverPlay"
            type="button"
            class="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            :aria-label="playButtonLabel"
            :disabled="disablePlayButton"
            @click.stop="onPlayClick"
          >
            <span
              class="flex size-7 items-center justify-center rounded-full bg-primary text-white"
            >
              <Play :size="13" fill="currentColor" :stroke-width="0" />
            </span>
          </button>
        </div>
        <div class="min-w-0">
          <div
            class="truncate text-sm font-medium"
            :class="{ 'text-primary': isPlaying }"
          >
            {{ item.name }}
          </div>
          <div class="truncate text-sm text-muted-foreground">
            <TrackTableLinks :targets="artists" route-name="artist" />
            <!-- the album moves under the title when its own column is hidden -->
            <template v-if="albumInSubtitle">
              <span v-if="artists.length"> • </span>
              <TrackTableLinks :targets="[album!]" route-name="album" />
            </template>
          </div>
        </div>
      </div>

      <div
        v-else-if="column === 'album'"
        class="truncate text-sm text-muted-foreground"
      >
        <TrackTableLinks v-if="album" :targets="[album]" route-name="album" />
      </div>

      <div
        v-else-if="column === 'year'"
        class="text-sm tabular-nums text-muted-foreground"
      >
        {{ album?.year }}
      </div>

      <div
        v-else-if="column === 'bpm'"
        class="text-sm tabular-nums text-muted-foreground"
      >
        {{ bpm }}
      </div>

      <!-- the Camelot code on its wheel colour; the key name is in the tooltip -->
      <div
        v-else-if="column === 'key'"
        class="truncate text-sm text-muted-foreground"
        :title="audioMetadata?.musical_key ?? undefined"
      >
        <span
          v-if="camelotKey"
          class="inline-flex h-5 min-w-9 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums text-black"
          :style="{ backgroundColor: camelotColor(camelotKey) }"
        >
          {{ camelotKey }}
        </span>
        <template v-else>{{ audioMetadata?.musical_key }}</template>
      </div>

      <!-- on hover-capable devices only a favorite shows its heart until the row is hovered -->
      <div
        v-else-if="column === 'favorite'"
        class="flex justify-center focus-within:opacity-100 group-hover:opacity-100"
        :class="{ 'opacity-0': !isTouch && !isFavorite }"
      >
        <FavoriteButton
          v-if="canHoldFavorite(item) && canEditLibrary"
          :item="item"
        />
      </div>

      <div
        v-else-if="column === 'duration'"
        class="text-right text-sm tabular-nums text-muted-foreground"
      >
        <template v-if="'duration' in item && item.duration">
          {{ formatDuration(item.duration) }}
        </template>
      </div>

      <div v-else-if="column === 'play'" class="flex justify-center">
        <button
          v-if="showPlay"
          type="button"
          class="flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          :aria-label="playButtonLabel"
          :disabled="disablePlayButton"
          @click.stop="onPlayClick"
        >
          <span
            class="flex size-[22px] items-center justify-center rounded-full bg-primary text-white"
          >
            <Play :size="11" fill="currentColor" :stroke-width="0" />
          </span>
        </button>
      </div>

      <div v-else-if="column === 'menu'" class="flex justify-center">
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="menuButtonLabel"
          :title="menuButtonLabel"
          @click.stop="onMenu"
        >
          <EllipsisVertical class="size-5" />
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import FavoriteButton from "@/components/FavoriteButton.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { canHoldFavorite, favoriteState } from "@/helpers/favorites";
import {
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/media_item_actions";
import { camelotColor } from "@/helpers/camelot";
import { formatDuration } from "@/helpers/utils";
import {
  Scope,
  type MediaItemType,
  type SortDirection,
  type SortField,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { EllipsisVertical, GripVertical, Play } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
import { computed } from "vue";
import TrackTableLinks from "./TrackTableLinks.vue";
import {
  TRACK_TABLE_GRID_CLASS,
  trackTableGridTemplate,
  type TrackColumn,
} from "./trackTableColumns";

export interface Props {
  item: MediaItemType;
  // the row's place in the listing, for items without a playlist position
  index: number;
  // the columns shown, in order
  columns: TrackColumn[];
  isSelected: boolean;
  isAvailable?: boolean;
  isPlaying?: boolean;
  showCheckboxes?: boolean;
  disablePlayButton?: boolean;
  parentItem?: MediaItemType;
  sortBy?: string;
  sortField?: SortField;
  sortDirection?: SortDirection;
}

const props = withDefaults(defineProps<Props>(), {
  isAvailable: true,
  isPlaying: false,
  showCheckboxes: false,
  disablePlayButton: false,
  parentItem: undefined,
  sortBy: undefined,
  sortField: undefined,
  sortDirection: undefined,
});

const emit = defineEmits<{
  select: [item: MediaItemType, selected: boolean];
  dragStart: [evt: PointerEvent];
  moveBy: [delta: number];
}>();

const isTouch = useMediaQuery("(hover: none)");

const gridTemplate = computed(() => trackTableGridTemplate(props.columns));

const position = computed(
  () => ("position" in props.item && props.item.position) || props.index + 1,
);

const album = computed(() =>
  "album" in props.item ? props.item.album : undefined,
);

const audioMetadata = computed(() =>
  "audio_metadata" in props.item ? props.item.audio_metadata : undefined,
);

const bpm = computed(() =>
  audioMetadata.value?.bpm ? Math.round(audioMetadata.value.bpm) : undefined,
);

const camelotKey = computed(
  () => audioMetadata.value?.camelot_key ?? undefined,
);

const artists = computed(() =>
  "artists" in props.item ? props.item.artists : [],
);

const albumInSubtitle = computed(
  () => !!album.value && !props.columns.includes("album"),
);

// favouring an item changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);

const isFavorite = computed(() => favoriteState(props.item) === true);

// a row that is not available has nothing to play, whatever its flag says
const showPlay = computed(() => props.item.is_playable && props.isAvailable);

const showHoverPlay = computed(
  () => showPlay.value && !isTouch.value && !props.showCheckboxes,
);

const playButtonLabel = computed(() => `${$t("play")} ${props.item.name}`);
const reorderLabel = computed(() =>
  $t("track_table.reorder_track", [props.item.name]),
);
const menuButtonLabel = computed(
  () => `${$t("more_options")}: ${props.item.name}`,
);

const onClick = function (evt: MouseEvent) {
  if (props.showCheckboxes) return;
  handleMediaItemClick(props.item, evt.clientX, evt.clientY, props.parentItem);
};

const onMenu = function (evt: Event) {
  const mouseEvt = evt as MouseEvent;
  handleMenuBtnClick(
    props.item,
    mouseEvt.clientX,
    mouseEvt.clientY,
    props.parentItem,
    true,
    props.sortBy,
    props.sortField,
    props.sortDirection,
  );
};

const onPlayClick = function (evt: MouseEvent) {
  if (props.showCheckboxes) return;
  handlePlayBtnClick(
    props.item,
    evt.clientX,
    evt.clientY,
    props.parentItem,
    undefined,
    props.sortBy,
    undefined,
    props.sortField,
    props.sortDirection,
  );
};

const onSelect = function (value: boolean | "indeterminate") {
  if (value !== "indeterminate") emit("select", props.item, value);
};
</script>
