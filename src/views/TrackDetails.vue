<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="trackalbums"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="true"
      :show-track-number="false"
      :load-data="loadTrackAlbums"
      :sort-keys="['provider', 'sort_name', 'duration']"
      :update-available="updateAvailable"
      :title="$t('appears_on')"
      :checksum="provider + itemId"
      :provider-filter="providerFilter"
    />
    <br />
    <ItemsListing
      v-if="itemDetails"
      itemtype="trackversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="true"
      :show-track-number="false"
      :load-data="loadTrackVersions"
      :sort-keys="['provider', 'sort_name', 'duration']"
      :update-available="updateAvailable"
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
import ItemsListing, { LoadDataParams, filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { computed, ref } from 'vue';
import { EventType, type Track, type EventMessage, type MediaItemType, Album } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { onBeforeUnmount, onMounted, watch } from 'vue';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { getStreamingProviderMappings } from '@/helpers/utils';

export interface Props {
  itemId: string;
  provider: string;
  album?: string;
}
const props = defineProps<Props>();
const activeTab = ref('');
const updateAvailable = ref(false);
const itemDetails = ref<Track>();

const providerFilter = computed(() => {
  if (itemDetails.value?.provider !== 'library') return [];
  const result: string[] = ['library'];
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    result.push(providerMapping.provider_instance);
  }
  return result;
});

const loadItemDetails = async function () {
  itemDetails.value = await api.getTrack(props.itemId, props.provider, props.album);
  activeTab.value = 'versions';
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

onMounted(() => {
  //signal if/when item updates
  const unsub = api.subscribe(EventType.MEDIA_ITEM_ADDED, (evt: EventMessage) => {
    // signal user that there might be updated info available for this item
    const updatedItem = evt.data as MediaItemType;
    if (itemDetails.value?.uri == updatedItem.uri) {
      updateAvailable.value = true;
    }
  });
  onBeforeUnmount(unsub);
});

const loadTrackVersions = async function (params: LoadDataParams) {
  return filteredItems(await api.getTrackVersions(itemDetails.value!.item_id, itemDetails.value!.provider), params);
};

const loadTrackAlbums = async function (params: LoadDataParams) {
  let items: Album[] = [];
  if (params.refresh) {
    await loadItemDetails();
    updateAvailable.value = false;
  }
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(itemDetails.value)) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getTrackAlbums(providerMapping.item_id, providerMapping.provider_instance);
        break;
      }
    }
  } else {
    items = await api.getTrackAlbums(itemDetails.value.item_id, itemDetails.value.provider);
  }
  return filteredItems(items, params);
};
</script>
