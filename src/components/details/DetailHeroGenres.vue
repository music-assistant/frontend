<template>
  <div v-if="genres.length" class="detail-hero-genres">
    <template v-for="(genre, index) in genres" :key="genre.item_id">
      <span v-if="index > 0">,&nbsp;</span>
      <button
        v-hold="(e: Event) => onHold(e, genre)"
        type="button"
        class="detail-hero-genres__genre"
        @click="(e: MouseEvent) => genreClick(e, genre)"
        @contextmenu.prevent="(e: MouseEvent) => showGenreMenu(e, genre)"
        @touchstart.passive="onTouchStart"
      >
        {{ genre.name }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
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
import { computed, ref, watch } from "vue";

export interface Props {
  item: MediaItemType;
}
const props = defineProps<Props>();

const genres = ref<Genre[]>([]);

// only a library manager can change which genres a library item carries
const canExcludeGenre = computed(
  () =>
    props.item.provider === "library" &&
    authManager.hasScope(Scope.LIBRARY_MANAGE),
);

watch(
  () => props.item,
  async (item) => {
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
  min-width: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
/* the genres read as links in the line of text, so the button chrome goes */
.detail-hero-genres__genre {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  vertical-align: baseline;
  cursor: pointer;
}
.detail-hero-genres__genre:hover {
  text-decoration: underline;
}
.detail-hero-genres__genre:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
