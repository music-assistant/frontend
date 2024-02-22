<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="artisttracks"
      :parent-item="itemDetails"
      :show-provider="false"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :load-items="loadArtistTracks"
      :sort-keys="['recent', 'name', 'album']"
      :update-available="updateAvailable"
      :title="$t('tracks')"
      :provider-filter="providerFilter"
      :allow-collapse="true"
    />
    <br />
    <ItemsListing
      v-if="itemDetails"
      itemtype="artistalbums"
      :parent-item="itemDetails"
      :show-provider="false"
      :show-favorites-only-filter="false"
      :load-items="loadArtistAlbums"
      :sort-keys="['recent', 'name', 'year']"
      :update-available="updateAvailable"
      :title="$t('albums')"
      :provider-filter="providerFilter"
      :allow-collapse="true"
    />
    <br />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { ref, watch, onBeforeUnmount, onMounted, computed } from 'vue';
import {
  EventType,
  type Artist,
  type EventMessage,
  type MediaItemType,
  Album,
  Track,
} from '../plugins/api/interfaces';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { api } from '../plugins/api';
import { getStreamingProviderMappings } from '@/helpers/utils';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const activeTab = ref('library');
const updateAvailable = ref(false);
const itemDetails = ref<Artist>();

const loadItemDetails = async function () {
  const prevTab = activeTab.value;
  activeTab.value = '';
  itemDetails.value = await api.getArtist(props.itemId, props.provider);
  activeTab.value = prevTab;
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
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadArtistAlbums = async function (params: LoadDataParams) {
  let items: Album[] = [];
  if (params.refresh) {
    await loadItemDetails();
    updateAvailable.value = false;
  }
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(
      itemDetails.value!,
    )) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getArtistAlbums(
          providerMapping.item_id,
          providerMapping.provider_instance,
        );
        break;
      }
    }
  } else {
    items = await api.getArtistAlbums(
      itemDetails.value.item_id,
      itemDetails.value.provider,
    );
  }
  updateAvailable.value = false;
  return items;
};

const loadArtistTracks = async function (params: LoadDataParams) {
  let items: Track[] = [];
  if (params.refresh) {
    await loadItemDetails();
    updateAvailable.value = false;
  }
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(
      itemDetails.value,
    )) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getArtistTracks(
          providerMapping.item_id,
          providerMapping.provider_instance,
        );
        break;
      }
    }
  } else {
    items = await api.getArtistTracks(
      itemDetails.value.item_id,
      itemDetails.value.provider,
    );
  }
  updateAvailable.value = false;
  return items;
};

const providerFilter = computed(() => {
  if (itemDetails.value?.provider !== 'library') return [];
  const result: string[] = ['library'];
  for (const providerMapping of getStreamingProviderMappings(
    itemDetails.value!,
  )) {
    result.push(providerMapping.provider_instance);
  }
  return result;
});
</script>
