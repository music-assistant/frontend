<template>
  <!-- sits on the artwork beside the overflow menu, so it carries its own
       backdrop -->
  <FavoriteMenu
    :item="item"
    variant="ghost-icon"
    size="icon-lg"
    icon-class="size-5"
    class="mr-2 rounded-lg bg-black/35 hover:bg-black/45 data-[active=true]:text-primary"
  />
</template>

<script setup lang="ts">
import FavoriteMenu from "@/components/FavoriteMenu.vue";
import { type FavoritableItem } from "@/helpers/favorites";

export interface Props {
  item: FavoritableItem;
}
defineProps<Props>();
</script>
