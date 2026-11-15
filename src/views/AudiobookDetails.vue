<template>
  <InfoHeader :item="itemDetails" />

  <!-- audiobook chapters, with the user's bookmarks inside them -->
  <Chapters v-if="itemDetails" :item-details="itemDetails" />

  <!-- provider mapping details, as a card like on the other detail pages -->
  <DetailAdminCard v-if="itemDetails">
    <ProviderDetails :item-details="itemDetails" />
  </DetailAdminCard>
</template>

<script setup lang="ts">
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import Chapters from "@/components/Chapters.vue";

import type { Audiobook } from "@/plugins/api/interfaces";
import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import { api } from "@/plugins/api";
import { watch, ref } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
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

useDetailItemUpdates(itemDetails);
</script>
