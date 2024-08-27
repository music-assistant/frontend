<template>
  <ItemsListing
    itemtype="radios"
    :show-duration="false"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="$t('radios')"
    :show-search-button="true"
    :allow-key-hooks="true"
    :extra-menu-items="[
      {
        label: 'add_url_item',
        labelArgs: [],
        action: () => {
          showAddEditDialog = true;
        },
        icon: 'mdi-playlist-plus',
      },
    ]"
    icon="mdi-access-point"
    :restore-state="true"
    :total="total"
  />
  <AddManualLink v-model="showAddEditDialog" :type="MediaType.RADIO" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';
import api from '@/plugins/api';
import { EventMessage, EventType, MediaType } from '@/plugins/api/interfaces';
import AddManualLink from '@/components/AddManualLink.vue';
import { sleep } from '@/helpers/utils';
import { store } from '@/plugins/store';

defineOptions({
  name: 'Radios',
});

const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryRadiosCount);
const showAddEditDialog = ref(false);

const sortKeys = [
  'name',
  'name_desc',
  'sort_name',
  'sort_name_desc',
  'timestamp_added',
  'timestamp_added_desc',
  'last_played',
  'last_played_desc',
  'play_count',
  'play_count_desc',
];

onMounted(() => {
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe_multi(
    [
      EventType.MEDIA_ITEM_ADDED,
      EventType.MEDIA_ITEM_UPDATED,
      EventType.MEDIA_ITEM_DELETED,
    ],
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith('library://radio')) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadItems = async function (params: LoadDataParams) {
  if (params.refresh && !updateAvailable.value) {
    api.startSync([MediaType.RADIO]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (api.syncTasks.value.length > 0) {
      if (
        api.syncTasks.value.filter((x) =>
          x.media_types.includes(MediaType.RADIO),
        ).length == 0
      )
        break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryRadios(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly) {
    total.value = store.libraryRadiosCount;
    return;
  }
  total.value = await api.getLibraryRadiosCount(params.favoritesOnly || false);
};
</script>
