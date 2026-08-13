<template>
  <!-- reka owns the open state; mirroring it here keeps the trigger's hover
       suppression in step with it -->
  <DropdownMenu @update:open="menuOpen = $event">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon-lg"
        v-bind="$attrs"
        :disabled="!currentItem"
        :data-suppress-hover="suppressHover"
        :title="$t('tooltip.favorite')"
        :aria-label="$t('tooltip.favorite')"
        @pointerenter="onPointerEnter"
      >
        <Heart :size="size" :fill="isFavorite ? 'currentColor' : 'none'" />
      </Button>
    </DropdownMenuTrigger>
    <!-- the button sits low on both surfaces it is used on, so the menu hangs
         above it rather than over the volume slider under it -->
    <DropdownMenuContent side="top" align="center" class="z-[100001]">
      <DropdownMenuItem @click="onToggleFavorite">
        <Heart class="size-4" :fill="isFavorite ? 'currentColor' : 'none'" />
        {{ isFavorite ? $t("favorites_remove") : $t("favorites_add") }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="onAddToPlaylist">
        <PlusCircle class="size-4" />
        {{ $t("add_playlist") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePopoutTriggerHover } from "@/composables/usePopoutTriggerHover";
import api from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Heart, PlusCircle } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface Props {
  /** glyph size in px; the button box comes from the call site */
  size?: number;
}

withDefaults(defineProps<Props>(), {
  size: 20,
});

const menuOpen = ref(false);
const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
  () => menuOpen.value,
);

// a line-in or other live source has nothing to favourite or collect
const currentItem = computed(() => {
  const item = store.curQueueItem?.media_item;
  return item?.media_type === MediaType.AUDIO_SOURCE ? undefined : item;
});

// Held apart from media_item.favorite: the server replaces the whole queue item
// on refresh, which would drop an optimistic change with it.
const isFavorite = ref(false);
watch(
  () => store.curQueueItem?.queue_item_id,
  () => {
    isFavorite.value = currentItem.value?.favorite ?? false;
  },
  { immediate: true },
);

const onToggleFavorite = async () => {
  const item = currentItem.value;
  if (!item) return;
  if (!isFavorite.value) {
    isFavorite.value = true;
    api.addItemToFavorites(item);
    return;
  }
  isFavorite.value = false;
  item.favorite = false;
  // the queue can hold the provider's copy of the item, whose id the library
  // does not know - the favourite sits on the library item
  const libraryItem =
    item.provider === "library"
      ? item
      : await api.getLibraryItem(item.media_type, item.item_id, item.provider);
  if (libraryItem) {
    api.removeItemFromFavorites(libraryItem.media_type, libraryItem.item_id);
  }
};

const onAddToPlaylist = () => {
  if (!currentItem.value) return;
  eventbus.emit("playlistdialog", { items: [currentItem.value] });
};

// follow the server's own view of the favourite once it confirms a change
onMounted(() => {
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      if (
        "favorite" in updatedItem &&
        currentItem.value?.uri === updatedItem.uri
      ) {
        isFavorite.value = updatedItem.favorite;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>
