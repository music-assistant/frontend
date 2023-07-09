<template>
  <ItemsListing
    itemtype="tracks"
    :items="items"
    :show-providers="true"
    :show-track-number="false"
    :load-data="loadItems"
    :sort-keys="['sort_name', 'timestamp_added DESC', 'sort_artist', 'duration']"
    :show-album="false"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, type Track } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Track[]>([]);

store.topBarContextMenuItems = [
  {
    label: 'sync_now',
    labelArgs: [t('tracks')],
    action: () => {
      api.startSync([MediaType.TRACK]);
    },
    icon: 'mdi-sync',
  },
  {
    label: 'add_url_item',
    labelArgs: [],
    action: () => {
      addUrl();
    },
    icon: 'mdi-link-plus',
  },
];
onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});

const loadItems = async function (offset: number, limit: number, sort: string, search?: string, inLibraryOnly = true) {
  const library = inLibraryOnly || undefined;
  return await api.getTracks(library, search, limit, offset, sort);
};

const addUrl = function () {
  const url = prompt(t('enter_url'));
  if (!url) return;
  api
    .getTrack(url, 'url', undefined, false)
    .then(() => location.reload())
    .catch((e) => alert(e));
};
</script>
