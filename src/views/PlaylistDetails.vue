<template>
  <section>
    <InfoHeader :item="itemDetails" />

    <v-tabs show-arrows grow hide-slider>
      <v-tab>
        {{ $t('playlist_tracks') }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <ItemsListing
      itemtype="playlisttracks"
      :parent-item="itemDetails"
      :show-providers="false"
      :show-library="false"
      :show-track-number="false"
      :load-data="loadPlaylistTracks"
      :sort-keys="['position', 'position DESC', 'sort_name', 'sort_artist', 'sort_album']"
      :update-available="updateAvailable"
      @refresh-clicked="
        loadItemDetails();
        updateAvailable = false;
      "
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing from '../components/ItemsListing.vue';
import { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { EventType, type Playlist, type EventMessage, type MediaItemType, Track } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { watch, ref, onMounted, onBeforeUnmount } from 'vue';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Playlist>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getPlaylist(props.itemId, props.provider);
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

const loadPlaylistTracks = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true,
) {
  const playlistTracks: Track[] = [];

  await api.getPlaylistTracks(props.itemId, props.provider, (data: Track[]) => {
    console.log('chunk', data.length);
    playlistTracks.push(...data);
  });
  return filteredItems(playlistTracks, offset, limit, sort, search, inLibraryOnly);
};
</script>
