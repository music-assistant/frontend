<template>
  <ItemsListing
    itemtype="artists"
    :items="items"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-data="loadItems"
    :show-album-artists-only-filter="true"
    :update-available="updateAvailable"
    :title="$t('artists')"
    :allow-key-hooks="true"
    :show-search-button="true"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, type Artist, EventMessage, EventType } from '../plugins/api/interfaces';

const items = ref<Artist[]>([]);
const updateAvailable = ref(false);

const loadItems = async function (params: LoadDataParams) {
  if (params.refresh) {
    api.startSync([MediaType.ARTIST]);
    updateAvailable.value = false;
  }
  return await api.getLibraryArtists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

onMounted(() => {
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe_multi(
    [EventType.MEDIA_ITEM_ADDED, EventType.MEDIA_ITEM_UPDATED, EventType.MEDIA_ITEM_DELETED],
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith('library://artist')) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>
