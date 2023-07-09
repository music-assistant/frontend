<template>
  <ItemsListing
    itemtype="albums"
    :items="items"
    :show-providers="true"
    :load-data="loadItems"
    :sort-keys="['sort_name', 'timestamp_added DESC', 'sort_artist', 'year']"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, type Album } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Album[]>([]);

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

const loadItems = async function (offset: number, limit: number, sort: string, search?: string, inLibraryOnly = true) {
  const library = inLibraryOnly || undefined;
  return await api.getAlbums(library, search, limit, offset, sort);
};
</script>
