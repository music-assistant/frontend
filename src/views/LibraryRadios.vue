<template>
  <ItemsListing
    itemtype="radios"
    :items="items"
    :show-duration="false"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-data="loadItems"
    :sort-keys="['sort_name', 'timestamp_added DESC']"
    :update-available="updateAvailable"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { EventMessage, EventType, MediaType, type Radio } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Radio[]>([]);
const updateAvailable = ref<boolean>(false);

store.topBarContextMenuItems = [
  {
    label: 'sync_now',
    labelArgs: [t('radios')],
    action: () => {
      api.startSync([MediaType.RADIO]);
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
      if (evt.object_id?.startsWith('library://radio')) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadItems = async function (offset: number, limit: number, sort: string, search?: string, favoritesOnly = true) {
  const favorite = favoritesOnly || undefined;
  updateAvailable.value = false;
  return await api.getLibraryRadios(favorite, search, limit, offset, sort);
};

const addUrl = async function () {
  const url = prompt(t('enter_url'));
  if (!url) return;
  api
    .getItem(MediaType.RADIO, url, 'url')
    .then((item) => {
      const name = prompt(t('enter_name'), item.name);
      item.name = name || item.name;
      api.addItemToLibrary(item).then(() => updateAvailable.value = true)
    })
    .catch((e) => alert(e));
};
</script>
