<template>
  <ItemsListing
    itemtype="albums"
    :items="items"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-data="loadItems"
    :sort-keys="['sort_name', 'timestamp_added DESC', 'sort_artist', 'year']"
    :update-available="updateAvailable"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, type Album, EventMessage, EventType } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Album[]>([]);
const updateAvailable = ref<boolean>(false);

store.topBarContextMenuItems = [
  {
    label: 'sync_now',
    labelArgs: [t('albums')],
    action: () => {
      api.startSync([MediaType.ALBUM]);
    },
    icon: 'mdi-sync',
  },
];
onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});

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

const loadItems = async function (offset: number, limit: number, sort: string, search?: string, favoritesOnly = true) {
  const favorite = favoritesOnly || undefined;
  updateAvailable.value = false;
  return await api.getLibraryAlbums(favorite, search, limit, offset, sort);
};
</script>
