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
    :title="$t('radios')"
    :show-search-button="true"
    :allow-key-hooks="true"
    :context-menu-items="[
      {
        label: 'add_url_item',
        labelArgs: [],
        action: () => {
          addUrl();
        },
        icon: 'mdi-link-plus',
      },
    ]"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { EventMessage, EventType, MediaType, type Radio } from '../plugins/api/interfaces';
import { store } from '../plugins/store';
import Container from '../components/mods/Container.vue';
import { sleep } from '@/helpers/utils';

const { t } = useI18n();
const items = ref<Radio[]>([]);
const updateAvailable = ref<boolean>(false);

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

const loadItems = async function (params: LoadDataParams) {
  if (params.refresh) {
    api.startSync([MediaType.RADIO]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (true) {
      if (api.syncTasks.value.length == 0) break;
      if (api.syncTasks.value.filter((x) => x.media_types.includes(MediaType.RADIO)).length == 0) break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  return await api.getLibraryRadios(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

const addUrl = async function () {
  const url = prompt(t('enter_url'));
  if (!url) return;
  api
    .getItem(MediaType.RADIO, url, 'url')
    .then((item) => {
      const name = prompt(t('enter_name'), item.name);
      item.name = name || item.name;
      api.addItemToLibrary(item).then(() => (updateAvailable.value = true));
    })
    .catch((e) => alert(e));
};
</script>
