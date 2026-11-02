<template>
  <section class="radio-details">
    <RadioHero :item="itemDetails" @edit-rows="rowsEditorOpen = true" />

    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <DetailTextRow
          v-if="rowId === 'description' && description"
          :title="$t('description')"
          :text="description"
          :dialog-title="itemDetails.name"
          markdown
          @edit-rows="rowsEditorOpen = true"
        />

        <DynamicItemSample
          v-else-if="rowId === 'dynamic_sample' || rowId === 'tracklist'"
          :item-details="itemDetails"
          :provider="itemDetails.provider"
        />

        <ItemsListing
          v-else-if="rowId === 'other_versions'"
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

        <DetailAdminCard v-else-if="rowId === 'provider_mappings'">
          <ProviderDetails :item-details="itemDetails" />
        </DetailAdminCard>
      </template>
    </template>

    <RowsEditor
      v-if="itemDetails"
      v-model:open="rowsEditorOpen"
      :item="itemDetails"
      :registry="radioRows"
      :available-ids="availableRows"
      :subtitle="$t('edit_rows_subtitle_radio')"
    />
    <br />
  </section>
</template>

<script setup lang="ts">
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import RowsEditor from "@/components/details/RowsEditor.vue";
import DynamicItemSample from "@/components/DynamicItemSample.vue";
import ItemsListing, {
  type LoadDataParams,
} from "@/components/ItemsListing.vue";
import { availableRadioRowIds, radioRows } from "@/components/radio/radioRows";
import RadioHero from "@/components/radio/RadioHero.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import { api } from "@/plugins/api";
import { ListingType, type Radio } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Radio>();
const rowsEditorOpen = ref(false);

const availableRows = computed(() =>
  itemDetails.value ? availableRadioRowIds(itemDetails.value) : [],
);
const visibleRows = computed(() => {
  const { order, hidden } = radioRows.resolve(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});
const description = computed(
  () =>
    itemDetails.value?.metadata?.description ||
    itemDetails.value?.metadata?.copyright ||
    undefined,
);

const loadItemDetails = async function () {
  const { itemId, provider } = props;
  itemDetails.value = undefined;
  rowsEditorOpen.value = false;
  const radio = await api.getRadio(itemId, provider);
  if (itemId !== props.itemId || provider !== props.provider) return;
  itemDetails.value = radio;
};

watch(
  () => [props.itemId, props.provider],
  ([itemId]) => {
    if (itemId) loadItemDetails();
  },
  { immediate: true },
);

useDetailItemUpdates(itemDetails, { providerItem: props });

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
