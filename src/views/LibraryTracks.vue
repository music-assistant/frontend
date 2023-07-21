<template>
  <ItemsListing
    itemtype="tracks"
    :items="items"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :show-track-number="false"
    :load-data="loadItems"
    :sort-keys="['sort_name', 'timestamp_added DESC', 'sort_artist', 'duration']"
    :show-album="false"
    :update-available="updateAvailable"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { EventMessage, EventType, MediaType, type Track } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Track[]>([]);
const updateAvailable = ref<boolean>(false);

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

onMounted(() => {
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe_multi(
    [EventType.MEDIA_ITEM_ADDED, EventType.MEDIA_ITEM_UPDATED, EventType.MEDIA_ITEM_DELETED],
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith('library://track')) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadItems = async function (offset: number, limit: number, sort: string, search?: string, favoritesOnly = true) {
  const favorite = favoritesOnly || undefined;
  updateAvailable.value = false;
  return await api.getLibraryTracks(favorite, search, limit, offset, sort);
};

const addUrl = async function () {
  const url = prompt(t('enter_url'));
  if (!url) return;
  api
    .getItem(MediaType.TRACK, url, 'url')
    .then((item) => {
      const name = prompt(t('enter_name'), item.name);
      item.name = name || item.name;
      api.addItemToLibrary(item).then(() => (updateAvailable.value = true));
    })
    .catch((e) => alert(e));
};
</script>
