<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="itemDetails?.provider_mappings[0].provider_domain" />
    <Container>
      <ItemsListing
        itemtype="playlisttracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-library="false"
        :show-favorites-only-filter="false"
        :show-track-number="false"
        :load-data="loadPlaylistTracks"
        :sort-keys="['position', 'position DESC', 'sort_name', 'sort_artist', 'sort_album']"
        :update-available="updateAvailable"
        @refresh-clicked="
          loadItemDetails();
          updateAvailable = false;
        "
        :title="$t('playlist_tracks')"
      />
    </Container>
  </section>
</template>

<script setup lang="ts">
import ItemsListing from '../components/ItemsListing.vue';
import { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import Container from '../components/mods/Container.vue';
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

const loadPlaylistTracks = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const playlistTracks: Track[] = [];

  await api.getPlaylistTracks(props.itemId, props.provider, (data: Track[]) => {
    console.log('chunk', data.length);
    playlistTracks.push(...data);
  });
  return filteredItems(playlistTracks, offset, limit, sort, search, favoritesOnly);
};
</script>
