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
import { computed, ref, watch } from "vue";
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

watch(
  () => [props.itemId, props.provider] as const,
  async ([itemId, provider]) => {
    itemDetails.value = undefined;
    if (collectionMediaType.value !== MediaType.AUDIOBOOK) return;
    const collection = await api.getAudiobookCollection(itemId, undefined, 0);
    if (itemId === props.itemId && provider === props.provider) {
      itemDetails.value = collection;
    }
  },
  { immediate: true },
);

const loadCollectionItems = async function (params: LoadDataParams) {
  if (collectionMediaType.value === MediaType.AUDIOBOOK) {
    const collection = await api.getAudiobookCollection(
      props.itemId,
      params.search,
      params.limit,
      params.offset,
      params.favoritesOnly,
    );
    return collection.items;
  }
  return [];
};
</script>
