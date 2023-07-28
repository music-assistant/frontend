<template>
  <ItemsListing
    itemtype="albums"
    :items="items"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-data="loadItems"
    :sort-keys="['sort_name', 'timestamp_added DESC', 'sort_artist', 'year']"
    :update-available="updateAvailable"
    :title="getBreakpointValue('bp4') ? $t('albums') : ''"
    :allow-key-hooks="true"
    :show-search-button="true"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, type Album, EventMessage, EventType } from '../plugins/api/interfaces';
import { sleep } from '@/helpers/utils';
import { getBreakpointValue } from '@/plugins/breakpoint';

const items = ref<Album[]>([]);
const updateAvailable = ref<boolean>(false);

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

const loadItems = async function (params: LoadDataParams) {
  if (params.refresh) {
    api.startSync([MediaType.ALBUM]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (api.syncTasks.value.length > 0) {
      if (api.syncTasks.value.filter((x) => x.media_types.includes(MediaType.ALBUM)).length == 0) break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  return await api.getLibraryAlbums(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};
</script>
