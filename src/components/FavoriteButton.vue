<script setup lang="ts">
import FavoriteMenu from "@/components/FavoriteMenu.vue";
import { type FavoritableItem } from "@/helpers/favorites";

interface Props {
  item: FavoritableItem;
}

defineProps<Props>();
</script>

<template>
  <!-- the favorite menu as a list row wears it: a bare glyph that only comes to
       full strength on hover, or while the item is a favorite -->
  <FavoriteMenu
    :item="item"
    variant="ghost-icon"
    size="icon-xs"
    icon-class="size-5.5"
    class="opacity-70 hover:opacity-100 data-[active=true]:opacity-100"
  />
</template>
