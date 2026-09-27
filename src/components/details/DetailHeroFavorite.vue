<template>
  <button
    v-if="canEditLibrary"
    type="button"
    class="detail-hero-favorite"
    :class="{ 'detail-hero-favorite--on': isFavorite }"
    :aria-label="label"
    :aria-pressed="isFavorite ? 'true' : 'false'"
    :title="label"
    @click="api.toggleFavorite(item)"
  >
    <!-- one slot, one tap: a dislike takes the heart's place -->
    <IconThumbDown v-if="isDisliked" :stroke-width="2" :size="20" />
    <IconHeartFilled v-else-if="isFavorite" :size="20" />
    <IconHeart v-else :stroke-width="2" :size="20" />
  </button>
</template>

<script setup lang="ts">
import { favoriteActionKey } from "@/helpers/favorites";
import { api } from "@/plugins/api";
import { Scope, type MediaItem } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { IconHeart, IconHeartFilled, IconThumbDown } from "@tabler/icons-vue";
import { computed } from "vue";

export interface Props {
  item: MediaItem;
}
const props = defineProps<Props>();

const isFavorite = computed(() => props.item.favorite === true);
const isDisliked = computed(() => props.item.favorite === false);

const label = computed(() => $t(favoriteActionKey(props.item.favorite)));

// favouring an item changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);
</script>

<style scoped>
/* sits on the artwork beside the overflow menu, so it carries its own backdrop */
.detail-hero-favorite {
  margin-right: 8px;
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  border: 0;
  border-radius: 8px;
  color: currentColor;
  cursor: pointer;
  display: inline-flex;
  height: 40px;
  justify-content: center;
  padding: 0;
  width: 40px;
}
.detail-hero-favorite--on {
  color: rgb(var(--v-theme-primary));
}
.detail-hero-favorite:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
