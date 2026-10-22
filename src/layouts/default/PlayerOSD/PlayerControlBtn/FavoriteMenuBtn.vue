<template>
  <!-- the state lives outside the queue item, so the menu is told what to show
       rather than reading it from the item itself -->
  <FavoriteMenu
    v-bind="$attrs"
    v-model:favorite="favorite"
    :item="currentItem"
    variant="ghost"
    size="icon-lg"
    :icon-class="iconClass"
    side="top"
  />
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import FavoriteMenu from "@/components/FavoriteMenu.vue";
import { useCurrentItemFavorite } from "@/composables/useCurrentItemFavorite";

export interface Props {
  /** size class of the glyph; the button box comes from the call site */
  iconClass?: string;
}

withDefaults(defineProps<Props>(), {
  iconClass: "size-5",
});

const { currentItem, favorite } = useCurrentItemFavorite();
</script>
