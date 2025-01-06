<template>
  <InfoHeader :item="itemDetails" />

  <!-- audiobook chapters -->
  <Chapters
    v-if="itemDetails && itemDetails.metadata?.chapters"
    :item-details="itemDetails"
  />

  <!-- provider mapping details -->
  <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import Chapters from "@/components/Chapters.vue";

import {
  EventType,
  type Audiobook,
  type EventMessage,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { watch, ref, onMounted, onBeforeUnmount } from "vue";
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import { eventbus } from "@/plugins/eventbus";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Audiobook>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getAudiobook(props.itemId, props.provider);
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

onMounted(() => {
  //signal if/when item updates
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const onMenu = function (
  item: MediaItemType | MediaItemType[],
  posX: number,
  posY: number,
) {
  const mediaItems: MediaItemType[] = Array.isArray(item) ? item : [item];
  const menuItems: ContextMenuItem[] = [];
  const chapter = mediaItems[0] as Chapter;
  if (chapter.fully_played || chapter.resume_position_ms > 0) {
    menuItems.push({
      label: "mark_unplayed",
      action: async () => {
        await api.markItemUnPlayed(
          chapter.media_type,
          chapter.item_id,
          chapter.provider,
        );
        loadItemDetails();
      },
    });
  } else {
    menuItems.push({
      label: "mark_played",
      action: async () => {
        await api.markItemPlayed(
          chapter.media_type,
          chapter.item_id,
          chapter.provider,
          true,
        );
        loadItemDetails();
      },
    });
  }
  // open the contextmenu by emitting the event
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: posX,
    posY: posY,
  });
};

const onClick = function (item: MediaItemType, posX: number, posY: number) {
  if (!itemDetails.value || !itemIsAvailable(item)) return;
  api.playMedia(itemDetails.value.uri, undefined, undefined, item.uri);
};
</script>
