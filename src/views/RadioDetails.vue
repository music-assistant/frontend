<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="radioversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="false"
      :show-radio-number="false"
      :show-duration="false"
      :load-items="loadRadioVersions"
      :sort-keys="['provider', 'sort_name']"
      :title="$t('other_versions')"
      :hide-on-empty="true"
      :checksum="provider + itemId"
    />
    <br />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { ref } from 'vue';
import type { Radio } from '../plugins/api/interfaces';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { api } from '../plugins/api';
import { watch } from 'vue';
import { getStreamingProviderMappings } from '@/helpers/utils';

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

const loadRadioVersions = async function (params: LoadDataParams) {
  const allVersions: Radio[] = [];
  if (props.provider == 'library') {
    const radioVersions = await api.getRadioVersions(props.itemId, props.provider);
    allVersions.push(...radioVersions);
  }
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    const radioVersions = await api.getRadioVersions(providerMapping.item_id, providerMapping.provider_instance);
    allVersions.push(...radioVersions);
  }
  return allVersions;
};
</script>
