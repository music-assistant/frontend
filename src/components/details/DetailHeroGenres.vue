<template>
  <div v-if="genres.length" class="detail-hero-genres">
    <template v-for="(genre, index) in genres" :key="genre.item_id">
      <span v-if="index > 0">,&nbsp;</span>
      <button
        type="button"
        class="detail-hero-genres__genre"
        @click="(e: MouseEvent) => genreClick(e, genre)"
      >
        {{ genre.name }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { handleMediaItemClick } from "@/helpers/media_item_actions";
import { api } from "@/plugins/api";
import type { Genre, MediaItemType } from "@/plugins/api/interfaces";
import { ref, watch } from "vue";

export interface Props {
  item: MediaItemType;
}
const props = defineProps<Props>();

const genres = ref<Genre[]>([]);

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

const genreClick = function (event: MouseEvent, genre: Genre) {
  handleMediaItemClick(genre, event.clientX, event.clientY);
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
