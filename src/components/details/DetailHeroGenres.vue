<template>
  <div v-if="genres.length" class="detail-hero-genres">
    <!-- at most two lines, so the genres stay beside the rest and never push
         the title up; the whole list opens in a dialog -->
    <p
      ref="list"
      class="detail-hero-genres__list"
      :class="{ 'detail-hero-genres__list--clamped': isClamped }"
    >
      <!-- the names flow as text, so a long one wraps onto the next line
           instead of taking a line to itself; a button would keep each name in
           one box. The comma stays with the genre before it -->
      <template v-for="(genre, index) in genres" :key="genre.item_id">
        <template v-if="index > 0">{{ " " }}</template>
        <span
          v-hold="(e: Event) => onHold(e, genre)"
          role="button"
          tabindex="0"
          class="detail-hero-genres__genre"
          :inert="index >= visibleCount"
          @click="(e: MouseEvent) => genreClick(e, genre)"
          @keydown.enter.prevent="(e: KeyboardEvent) => genreKey(e, genre)"
          @keydown.space.prevent="(e: KeyboardEvent) => genreKey(e, genre)"
          @contextmenu.prevent="(e: MouseEvent) => showGenreMenu(e, genre)"
          @touchstart.passive="onTouchStart"
          >{{ genre.name }}</span><template v-if="index < genres.length - 1"
          >,</template
        >
      </template>
    </p>
    <button
      v-if="isClamped"
      type="button"
      class="detail-hero-genres__all"
      @click="showAll = true"
    >
      {{ $t("all_genres", { count: genres.length }) }}
    </button>
    <DetailHeroGenresDialog
      v-model:open="showAll"
      :genres="genres"
      :item-name="item.name"
      @select="(e: MouseEvent, genre: Genre) => genreClick(e, genre)"
      @menu="showGenreMenu"
    />
  </div>
</template>

<script setup lang="ts">
import DetailHeroGenresDialog from "@/components/details/DetailHeroGenresDialog.vue";
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import { handleMediaItemClick } from "@/helpers/media_item_actions";
import { api } from "@/plugins/api";
import {
  Scope,
  type Genre,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { Ban } from "@lucide/vue";
import { useResizeObserver } from "@vueuse/core";
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

export interface Props {
  item: MediaItemType;
}
const props = defineProps<Props>();

const genres = ref<Genre[]>([]);

const list = useTemplateRef<HTMLElement>("list");
const showAll = ref(false);
const isClamped = ref(false);
// the names past the clamp are out of sight, so out of the tab order and the
// screen reader too; the dialog has them all
const visibleCount = ref(Infinity);

const measureClamp = function () {
  const el = list.value;
  // subpixel line heights can round scrollHeight a pixel above clientHeight
  isClamped.value = !!el && el.scrollHeight > el.clientHeight + 1;
  if (!el || !isClamped.value) {
    visibleCount.value = Infinity;
    return;
  }
  const bottom = el.getBoundingClientRect().bottom;
  const names = el.querySelectorAll(".detail-hero-genres__genre");
  const firstHidden = Array.from(names).findIndex(
    (name) => (name.getClientRects()[0]?.top ?? bottom) >= bottom - 1,
  );
  visibleCount.value = firstHidden === -1 ? names.length : firstHidden;
};
useResizeObserver(list, measureClamp);
watch(genres, () => nextTick(measureClamp));

// only a library manager can change which genres a library item carries
const canExcludeGenre = computed(
  () =>
    props.item.provider === "library" &&
    authManager.hasScope(Scope.LIBRARY_MANAGE),
);

watch(
  () => props.item,
  async (item) => {
    showAll.value = false;
    const loaded = await api
      .getGenresForMediaItem(item.media_type, item.item_id)
      .catch(() => [] as Genre[]);
    // a slower response for a previous item must not replace the current one
    if (props.item.uri === item.uri) genres.value = loaded;
  },
  { immediate: true },
);

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu<
  [Genre]
>((event, genre) => showGenreMenu(event, genre));

const genreKey = function (event: KeyboardEvent, genre: Genre) {
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  handleMediaItemClick(genre, rect.left, rect.bottom);
};

const genreClick = function (event: MouseEvent, genre: Genre) {
  // the click a long-press leaves behind opened the menu, it is not a tap
  if (swallowClickAfterHold(event)) return;
  handleMediaItemClick(genre, event.clientX, event.clientY);
};

const showGenreMenu = function (event: Event, genre: Genre) {
  if (!canExcludeGenre.value) return;
  const item = props.item;
  const position = getEventPosition(event);
  eventbus.emit("contextmenu", {
    items: [
      {
        label: "exclude_genre",
        icon: Ban,
        action: async () => {
          await api.excludeGenreFromItem(
            genre.item_id,
            item.media_type,
            item.item_id,
          );
          genres.value = genres.value.filter(
            (candidate) => candidate.item_id !== genre.item_id,
          );
          eventbus.emit("genreExcluded");
        },
      },
    ],
    posX: position.x,
    posY: position.y,
  });
};
</script>

<style scoped>
.detail-hero-genres {
  display: flex;
  flex-direction: column;
  align-items: inherit;
  gap: 2px;
  min-width: 0;
  /* as a flex child it would size to its longest name, not the column */
  max-width: 100%;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.detail-hero-genres__list {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  /* clip rather than hide: a hidden box still scrolls to a focused name, and
     the margin leaves room for the focus ring */
  overflow: clip;
  overflow-clip-margin: 4px;
  overflow-wrap: anywhere;
  max-width: 100%;
  margin: 0;
}
/* Blink drops the ellipsis of a right-aligned clamp; a clamped list fills its
   column anyway */
.detail-hero-genres__list--clamped {
  text-align: left;
}
.detail-hero-genres__genre {
  cursor: pointer;
}
/* the link reads as text, so the button chrome goes */
.detail-hero-genres__all {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
.detail-hero-genres__all {
  font-size: 13px;
  font-weight: 600;
}
.detail-hero-genres__genre:hover,
.detail-hero-genres__all:hover {
  text-decoration: underline;
}
.detail-hero-genres__genre:focus-visible,
.detail-hero-genres__all:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
