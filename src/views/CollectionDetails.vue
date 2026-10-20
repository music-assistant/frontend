<template>
  <InfoHeader :item="itemDetails" />
  <ItemsListing
    :key="`${provider}:${itemId}`"
    :itemtype="collectionMediaType"
    :parent-item="itemDetails"
    :show-refresh-button="false"
    :load-paged-data="loadCollectionItems"
    :title="title"
    :empty-message="emptyMessage"
    :allow-collapse="false"
  />
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing from "@/components/ItemsListing.vue";
import { useCollectionDetails } from "@/composables/useCollectionDetails";
import { MediaType } from "@/plugins/api/interfaces";
import { computed } from "vue";
import { $t } from "@/plugins/i18n";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const { itemDetails, collectionMediaType, loadCollectionItems } =
  useCollectionDetails(() => props);

const title = computed(() => {
  if (collectionMediaType.value === MediaType.AUDIOBOOK) {
    return $t("audiobooks_in_collection");
  }
  return "";
});

const emptyMessage = computed(() => {
  if (collectionMediaType.value === MediaType.AUDIOBOOK) {
    return $t("collection_no_audiobooks");
  }
  return "";
});
</script>
