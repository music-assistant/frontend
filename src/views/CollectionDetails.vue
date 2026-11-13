<template>
  <section>
    <CollectionHero :item="audiobookCollection" />
    <ItemsListing
      :key="`${provider}:${itemId}`"
      :itemtype="collectionMediaType"
      :parent-item="itemDetails"
      :show-refresh-button="false"
      library-toolbar
      :show-count="false"
      detail-row
      :load-paged-data="loadCollectionItems"
      :title="title"
      :empty-message="emptyMessage"
      :allow-collapse="false"
    />
  </section>
</template>

<script setup lang="ts">
import CollectionHero from "@/components/collection/CollectionHero.vue";
import ItemsListing from "@/components/ItemsListing.vue";
import { useCollectionDetails } from "@/composables/useCollectionDetails";
import {
  MediaType,
  type Audiobook,
  type MediaCollection,
} from "@/plugins/api/interfaces";
import { computed } from "vue";
import { $t } from "@/plugins/i18n";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const { itemDetails, collectionMediaType, loadCollectionItems } =
  useCollectionDetails(() => props);

const audiobookCollection = computed(() =>
  collectionMediaType.value === MediaType.AUDIOBOOK
    ? (itemDetails.value as MediaCollection<Audiobook> | undefined)
    : undefined,
);

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
