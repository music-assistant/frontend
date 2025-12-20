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
        itemDetails.value = updatedItem as Audiobook;
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>
