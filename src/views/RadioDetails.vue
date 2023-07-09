<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <v-tabs show-arrows grow hide-slider>
      <v-tab v-if="showVersionsTab">
        {{ $t('other_versions') }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <ItemsListing
      v-if="showVersionsTab"
      itemtype="radioversions"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-library="false"
      :show-radio-number="false"
      :show-duration="false"
      :load-data="loadRadioVersions"
      :sort-keys="['provider', 'sort_name']"
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
const showVersionsTab = ref(false);

const loadItemDetails = async function () {
  itemDetails.value = await api.getRadio(props.itemId, props.provider);
  // we only show the versions tab if we actually have other versions
  // to avoid confusion
  const versions = await loadRadioVersions(0, 2, 'name');
  showVersionsTab.value = versions.count > 0;
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
  inLibraryOnly = true,
) {
  const radioVersions = await api.getRadioVersions(props.itemId, props.provider);
  return filteredItems(radioVersions, offset, limit, sort, search, inLibraryOnly);
};
</script>
