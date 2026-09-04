<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { type MediaItem } from "@/plugins/api/interfaces";
import { Heart } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  item: MediaItem;
}

const props = defineProps<Props>();

const favoriteButtonLabel = computed(() =>
  props.item?.favorite ? $t("favorites_remove") : $t("favorites_add"),
);

const toggle = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  api.toggleFavorite(props.item);
};
</script>

<template>
  <Heart
    class="favorite-icon"
    :class="{ 'favorite-icon--on': item?.favorite }"
    :size="22"
    :fill="item?.favorite ? 'currentColor' : 'none'"
    role="button"
    tabindex="0"
    :aria-label="favoriteButtonLabel"
    :aria-pressed="item?.favorite ? 'true' : 'false'"
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
