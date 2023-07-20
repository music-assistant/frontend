<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <ItemsListing
      itemtype="radioversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="false"
      :show-radio-number="false"
      :show-duration="false"
      :load-data="loadRadioVersions"
      :sort-keys="['provider', 'sort_name']"
      :title="$t('other_versions')"
      :checksum="provider+itemId"
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { ref } from 'vue';
import type { Radio } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { watch } from 'vue';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Radio>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getRadio(props.itemId, props.provider);
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

const loadRadioVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const radioVersions = await api.getRadioVersions(props.itemId, props.provider);
  return filteredItems(radioVersions, offset, limit, sort, search, favoritesOnly);
};
</script>
