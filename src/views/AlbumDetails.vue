<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="albumtracks"
      :parent-item="itemDetails"
      :show-provider="false"
      :show-favorites-only-filter="false"
      :load-data="loadAlbumTracks"
      :sort-keys="['track_number', 'sort_name', 'duration']"
      :update-available="updateAvailable"
      :title="$t('tracks')"
      :provider-filter="providerFilter"
    />
    <br />
    <ItemsListing
      v-if="itemDetails"
      itemtype="albumversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :load-data="loadAlbumVersions"
      :sort-keys="['provider', 'sort_name', 'year']"
      :update-available="updateAvailable"
      :title="$t('other_versions')"
      :hide-on-empty="true"
    />
    <br />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { EventType, type Album, type EventMessage, type MediaItemType, Track } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { getStreamingProviderMappings } from '@/helpers/utils';

export interface Props {
  itemId: string;
  provider: string;
  forceProviderVersion?: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Album>();

const providerFilter = computed(() => {
  if (itemDetails.value?.provider !== 'library') return [];
  const result: string[] = ['library'];
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    result.push(providerMapping.provider_instance);
  }
  return result;
});

const loadItemDetails = async function () {
  itemDetails.value = await api.getAlbum(props.itemId, props.provider);
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

const loadAlbumTracks = async function (params: LoadDataParams) {
  let items: Track[] = [];
  if (params.refresh) {
    await loadItemDetails();
    updateAvailable.value = false;
  }
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(itemDetails.value)) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getAlbumTracks(providerMapping.item_id, providerMapping.provider_instance);
        break;
      }
    }
  } else {
    items = await api.getAlbumTracks(itemDetails.value.item_id, itemDetails.value.provider);
  }
  updateAvailable.value = false;
  return filteredItems(items, params);
};

const loadAlbumVersions = async function (params: LoadDataParams) {
  return filteredItems(await api.getAlbumVersions(itemDetails.value!.item_id, itemDetails.value!.provider), params);
};
</script>
