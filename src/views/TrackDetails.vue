<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <v-tabs v-model="activeTab" show-arrows grow hide-slider>
      <v-tab v-if="showVersionsTab" value="versions">
        {{ $t('other_versions') }}
      </v-tab>
      <v-tab v-if="showVersionsTab" value="appears_on">
        {{ $t('appears_on') }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <ItemsListing
      v-if="showVersionsTab && activeTab == 'versions'"
      itemtype="trackversions"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-library="true"
      :show-track-number="false"
      :load-data="loadTrackVersions"
      :sort-keys="['provider', 'sort_name', 'duration']"
      :update-available="updateAvailable"
      @refresh-clicked="
        loadItemDetails();
        updateAvailable = false;
      "
    />
    <ItemsListing
      v-if="activeTab == 'appears_on'"
      itemtype="trackalbums"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-library="true"
      :show-track-number="false"
      :load-data="loadTrackAlbums"
      :sort-keys="['provider', 'sort_name', 'duration']"
      :update-available="updateAvailable"
      @refresh-clicked="
        loadItemDetails();
        updateAvailable = false;
      "
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { ref } from 'vue';
import { EventType, type Track, type EventMessage, type MediaItemType, Album } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { onBeforeUnmount, onMounted, watch } from 'vue';

export interface Props {
  itemId: string;
  provider: string;
  album?: string;
}
const props = defineProps<Props>();
const activeTab = ref('');
const updateAvailable = ref(false);
const itemDetails = ref<Track>();
const showVersionsTab = ref(true);

const loadItemDetails = async function () {
  console.log('props', props);
  itemDetails.value = await api.getTrack(props.itemId, props.provider, undefined, undefined, props.album);
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
  const unsub = api.subscribe_multi([EventType.MEDIA_ITEM_ADDED, EventType.MEDIA_ITEM_UPDATED], (evt: EventMessage) => {
    // signal user that there might be updated info available for this item
    const updatedItem = evt.data as MediaItemType;
    if (itemDetails.value?.uri == updatedItem.uri) {
      updateAvailable.value = true;
    } else {
      for (const provId of updatedItem.provider_mappings) {
        if (provId.provider_domain == itemDetails.value?.provider && provId.item_id == itemDetails.value?.item_id) {
          updateAvailable.value = true;
          break;
        }
      }
    }
  });
  onBeforeUnmount(unsub);
});

const loadTrackVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true,
) {
  const trackVersions = await api.getTrackVersions(props.itemId, props.provider);
  showVersionsTab.value = trackVersions.length > 0;
  return filteredItems(trackVersions, offset, limit, sort, search, inLibraryOnly);
};

const loadTrackAlbums = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true,
) {
  let trackAlbums = await api.getTrackAlbums(props.itemId, props.provider);

  if (trackAlbums.length == 0 && itemDetails.value?.album) trackAlbums = [itemDetails.value?.album as Album];

  return filteredItems(trackAlbums, offset, limit, sort, search, inLibraryOnly);
};
</script>
