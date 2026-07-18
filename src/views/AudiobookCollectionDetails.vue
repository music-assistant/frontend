<template>
  <InfoHeader :item="itemDetails" />
  <ItemsListing
    itemtype="audiobooks"
    :parent-item="itemDetails"
    :show-refresh-button="false"
    :load-items="loadCollectionAudiobooks"
    :sort-keys="[
      'position',
      'sort_name',
      'name',
      'year',
      'name_desc',
      'sort_name_desc',
      'year_desc',
    ]"
    :title="$t('audiobooks_in_collection')"
    :empty-message="$t('collection_no_audiobooks')"
    :allow-collapse="true"
  />
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing from "@/components/ItemsListing.vue";
import { api } from "@/plugins/api";
import { MediaCollection } from "@/plugins/api/interfaces";
import { ref } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<MediaCollection>();

const loadCollectionAudiobooks = async function () {
  itemDetails.value = await api.getAudiobookCollection(props.itemId);
  return itemDetails.value.items;
};
</script>
