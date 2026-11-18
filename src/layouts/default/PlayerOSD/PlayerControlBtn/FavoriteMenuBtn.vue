<template>
  <!-- the state lives outside the queue item, so the menu is told what to show
       rather than reading it from the item itself -->
  <FavoriteMenu
    v-bind="$attrs"
    v-model:favorite="favorite"
    :item="currentItem"
    :trigger-favorite="songLabel ? songFavorite : undefined"
    :labels="songLabel ? STATION_LABELS : undefined"
    :variant="variant"
    size="icon-lg"
    :icon-class="iconClass"
    side="top"
  >
    <!-- the song a station names comes first, apart from the station -->
    <template v-if="songLabel" #before>
      <DropdownMenuLabel class="max-w-64 truncate text-muted-foreground">
        {{ songLabel }}
      </DropdownMenuLabel>
      <DropdownMenuItem v-if="songFavorite" @click="unlikeSong">
        <Heart class="size-4" fill="currentColor" />
        {{ $t("favorites_song_remove") }}
      </DropdownMenuItem>
      <DropdownMenuItem v-else @click="likeSong">
        <Heart class="size-4" fill="none" />
        {{ $t("favorites_song_add") }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="addSongToPlaylist">
        <PlusCircle class="size-4" />
        {{ $t("add_song_playlist") }}
      </DropdownMenuItem>
    </template>
  </FavoriteMenu>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import FavoriteMenu, {
  type FavoriteMenuLabels,
} from "@/components/FavoriteMenu.vue";
import type { ButtonVariants } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useCurrentItemFavorite } from "@/composables/useCurrentItemFavorite";
import { useRadioSongFavorite } from "@/composables/useRadioSongFavorite";
import { Heart, PlusCircle } from "@lucide/vue";

export interface Props {
  /** look of the button */
  variant?: ButtonVariants["variant"];
  /** size class of the glyph; the button box comes from the call site */
  iconClass?: string;
}

withDefaults(defineProps<Props>(), {
  variant: "ghost",
  iconClass: "size-5",
});

// next to the song's entries, the station's say what they act on
const STATION_LABELS: FavoriteMenuLabels = {
  add: "favorites_station_add",
  remove: "favorites_station_remove",
  dislike: "favorites_station_dislike",
  dislikeRemove: "favorites_station_dislike_remove",
  playlist: "add_station_playlist",
};

const { currentItem, favorite } = useCurrentItemFavorite();
const {
  songLabel,
  favorite: songFavorite,
  like: likeSong,
  unlike: unlikeSong,
  addToPlaylist: addSongToPlaylist,
} = useRadioSongFavorite();
</script>
