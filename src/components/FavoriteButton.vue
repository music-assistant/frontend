<script setup lang="ts">
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
const isDisliked = computed(() => props.item?.favorite === false);

const favoriteButtonLabel = computed(() =>
  isFavorite.value ? $t("favorites_remove") : $t("favorites_add"),
);

const toggle = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  api.toggleFavorite(props.item);
};
</script>

<template>
  <span class="flex items-center gap-1">
    <!-- the heart only tells likes apart, so a dislike gets a badge of its own -->
    <span
      v-if="isDisliked"
      class="opacity-70"
      role="img"
      :aria-label="$t('favorites_disliked')"
      :title="$t('favorites_disliked')"
    >
      <ThumbsDown :size="16" />
    </span>
    <Heart
      class="favorite-icon"
      :class="{ 'favorite-icon--on': isFavorite }"
      :size="22"
      :fill="isFavorite ? 'currentColor' : 'none'"
      role="button"
      tabindex="0"
      :aria-label="$t('tooltip.favorite')"
      :aria-pressed="isFavorite ? 'true' : 'false'"
      :title="favoriteButtonLabel"
      @click="toggle"
      @keydown.enter.space.prevent="toggle"
    />
  </span>
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
