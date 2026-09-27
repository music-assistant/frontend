<script setup lang="ts">
import { favoriteActionKey } from "@/helpers/favorites";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { type MediaItem } from "@/plugins/api/interfaces";
import { Heart, ThumbsDown } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  item: MediaItem;
}

const props = defineProps<Props>();

const isFavorite = computed(() => props.item?.favorite === true);
// one slot, one tap: a dislike takes the heart's place instead of sitting beside it
const icon = computed(() =>
  props.item?.favorite === false ? ThumbsDown : Heart,
);

const favoriteButtonLabel = computed(() =>
  $t(favoriteActionKey(props.item?.favorite)),
);

const toggle = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  api.toggleFavorite(props.item);
};
</script>

<template>
  <component
    :is="icon"
    class="favorite-icon"
    :class="{ 'favorite-icon--on': isFavorite }"
    :size="22"
    :fill="isFavorite ? 'currentColor' : 'none'"
    role="button"
    tabindex="0"
    :aria-label="favoriteButtonLabel"
    :aria-pressed="isFavorite ? 'true' : 'false'"
    :title="favoriteButtonLabel"
    @click="toggle"
    @keydown.enter.space.prevent="toggle"
  />
</template>

<style scoped>
.favorite-icon {
  cursor: pointer;
  display: block;
  flex-shrink: 0;
  opacity: 0.7;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s ease;
}
.favorite-icon:hover,
.favorite-icon--on {
  opacity: 1;
}
.favorite-icon:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
