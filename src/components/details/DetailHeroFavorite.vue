<template>
  <button
    v-if="canEditLibrary"
    type="button"
    class="detail-hero-favorite"
    :class="{ 'detail-hero-favorite--on': item.favorite }"
    :aria-label="label"
    :aria-pressed="item.favorite ? 'true' : 'false'"
    :title="label"
    @click="api.toggleFavorite(item)"
  >
    <IconHeartFilled v-if="item.favorite" :size="20" />
    <IconHeart v-else :stroke-width="2" :size="20" />
  </button>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { Scope, type MediaItem } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { IconHeart, IconHeartFilled } from "@tabler/icons-vue";
import { computed } from "vue";

export interface Props {
  item: MediaItem;
}
const props = defineProps<Props>();

const label = computed(() =>
  props.item.favorite ? $t("favorites_remove") : $t("favorites_add"),
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
</style>
