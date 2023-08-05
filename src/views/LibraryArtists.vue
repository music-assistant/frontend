<template>
  <ItemsListing
    itemtype="artists"
    :items="items"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-album-artists-only-filter="true"
    :update-available="updateAvailable"
    :title="getBreakpointValue('bp4') ? $t('artists') : ''"
    :allow-key-hooks="true"
    :show-search-button="true"
    :sort-keys="Object.keys(sortKeys)"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, type Artist, EventMessage, EventType } from '../plugins/api/interfaces';
import { sleep } from '@/helpers/utils';
import { getBreakpointValue } from '@/plugins/breakpoint';

const items = ref<Artist[]>([]);
const updateAvailable = ref(false);

const sortKeys: Record<string, string> = {
  name: 'sort_name',
  recent: 'timestamp_added DESC',
};

const loadItems = async function (params: LoadDataParams) {
  if (params.refresh && !updateAvailable.value) {
    api.startSync([MediaType.ARTIST]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (api.syncTasks.value.length > 0) {
      if (api.syncTasks.value.filter((x) => x.media_types.includes(MediaType.ARTIST)).length == 0) break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  return await api.getLibraryArtists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    sortKeys[params.sortBy],
    params.albumArtistsFilter,
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
