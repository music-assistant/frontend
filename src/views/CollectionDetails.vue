<template>
  <InfoHeader :item="itemDetails" />
  <ItemsListing
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
import ItemsListing, {
  type LoadDataParams,
} from "@/components/ItemsListing.vue";
import { api } from "@/plugins/api";
import {
  type MediaCollection,
  type MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";
import { ref, computed } from "vue";
import { $t } from "@/plugins/i18n";
import { getCollectionMediaTypeFromItemId } from "@/plugins/api/helpers";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<MediaCollection<MediaItemType>>();

const collectionMediaType = computed(() => {
  return getCollectionMediaTypeFromItemId(props.itemId);
});

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

const loadCollectionItems = async function (params: LoadDataParams) {
  if (collectionMediaType.value === MediaType.AUDIOBOOK) {
    itemDetails.value = await api.getAudiobookCollection(
      props.itemId,
      params.search,
      params.limit,
      params.offset,
    );
    return itemDetails.value.items;
  }
  return [];
};
</script>
