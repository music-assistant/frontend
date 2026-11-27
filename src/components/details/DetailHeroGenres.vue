<template>
  <div
    v-if="genres.length"
    class="detail-hero-genres flex max-w-full min-w-0 flex-col [align-items:inherit] gap-0.5 text-[14px] text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]"
  >
    <!-- at most two lines, so the genres stay beside the rest and never push
         the title up; the whole list opens in a dialog. Clipped rather than
         hidden: a hidden box still scrolls to a focused name, and the margin
         leaves room for the focus ring. Blink drops the ellipsis of a
         right-aligned clamp, and a clamped list fills its column anyway -->
    <p
      ref="list"
      class="detail-hero-genres__list m-0 max-w-full [display:-webkit-box] [overflow:clip] [overflow-clip-margin:4px] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [line-clamp:2]"
      :class="{ 'text-left': isClamped }"
    >
      <!-- the names flow as text, so a long one wraps onto the next line
           instead of taking a line to itself; a button would keep each name in
           one box. The comma stays with the genre before it. Space acts on
           release, as on a native button, so holding it does not repeat -->
      <template v-for="(genre, index) in genres" :key="genre.item_id">
        <template v-if="index > 0">{{ " " }}</template>
        <span
          v-hold="(e: Event) => onHold(e, genre)"
          role="button"
          tabindex="0"
          :class="['detail-hero-genres__genre cursor-pointer', LINK_CLASSES]"
          :inert="index >= visibleCount"
          @click="(e: MouseEvent) => genreClick(e, genre)"
          @keydown.enter.prevent="(e: KeyboardEvent) => genreKey(e, genre)"
          @keydown.space.prevent
          @keyup.space.prevent="(e: KeyboardEvent) => genreKey(e, genre)"
          @contextmenu.prevent="(e: MouseEvent) => showGenreMenu(e, genre)"
          @touchstart.passive="onTouchStart"
          >{{ genre.name }}</span><template v-if="index < genres.length - 1"
          >,</template
        >
      </template>
    </p>
    <!-- the link reads as text, so the button chrome goes -->
    <button
      v-if="isClamped"
      type="button"
      :class="[
        'detail-hero-genres__all max-w-full min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-[13px] font-semibold text-inherit',
        LINK_CLASSES,
      ]"
      @click="showAll = true"
    >
      {{ $t("all_genres", { count: genres.length }) }}
    </button>
    <DetailHeroGenresDialog
      v-model:open="showAll"
      :genres="genres"
      :item-name="item.name"
      @select="handleMediaItemClick"
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

const LINK_CLASSES =
  "hover:underline focus-visible:rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--v-theme-primary))]";

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
