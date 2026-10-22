<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <!-- tracklisted station (dynamic or finite): show its tracks instead of "other versions" -->
    <DynamicItemSample
      v-if="
        itemDetails &&
        (itemDetails.is_dynamic || itemDetails.is_endless === false)
      "
      :item-details="itemDetails"
      :provider="props.provider"
    />
    <ItemsListing
      v-else-if="itemDetails"
      itemtype="radioversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="false"
      :show-radio-number="false"
      :show-duration="false"
      :sort-listing="ListingType.VERSIONS"
      :load-paged-data="loadRadioVersions"
      :title="$t('other_versions')"
      :hide-on-empty="true"
    />
    <br />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import DynamicItemSample from "@/components/DynamicItemSample.vue";
import { ref, watch } from "vue";
import { ListingType, type Radio } from "@/plugins/api/interfaces";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import { api } from "@/plugins/api";

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

useDetailItemUpdates(itemDetails);

const loadRadioVersions = async function (params: LoadDataParams) {
  const radio = itemDetails.value;
  if (!radio) return [];
  return await api.getRadioVersions(
    radio.item_id,
    radio.provider,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
  );
};
</script>
