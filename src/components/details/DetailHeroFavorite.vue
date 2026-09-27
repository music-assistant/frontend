<template>
  <!-- a fragment, so the button stays a direct child of the toolbar's append
       slot, which styles it -->
  <template v-if="canEditLibrary">
    <button
      type="button"
      class="detail-hero-favorite"
      :class="{ 'detail-hero-favorite--on': isFavorite }"
      :aria-label="label"
      :aria-pressed="isFavorite ? 'true' : 'false'"
      :title="label"
      @click="api.toggleFavorite(item)"
    >
      <IconHeartFilled v-if="isFavorite" :size="20" />
      <IconHeart v-else :stroke-width="2" :size="20" />
    </button>
    <!-- the heart only tells likes apart, so a dislike gets a badge of its own -->
    <span
      v-if="isDisliked"
      class="detail-hero-disliked"
      role="img"
      :aria-label="$t('favorites_disliked')"
      :title="$t('favorites_disliked')"
    >
      <IconThumbDown :stroke-width="2" :size="18" />
    </span>
  </template>
</template>

<script setup lang="ts">
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

const label = computed(() =>
  isFavorite.value ? $t("favorites_remove") : $t("favorites_add"),
);

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
/* read-only badge, so it carries the same backdrop but no button affordance */
.detail-hero-disliked {
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  display: inline-flex;
  height: 40px;
  justify-content: center;
  margin-right: 8px;
  width: 40px;
}
</style>
