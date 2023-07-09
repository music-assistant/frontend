<template>
  <ItemsListing
    itemtype="radios"
    :items="items"
    :show-duration="false"
    :show-providers="true"
    :show-library="true"
    :load-data="loadItems"
    :sort-keys="['sort_name', 'timestamp_added DESC']"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, type Radio } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Radio[]>([]);

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

const loadItems = async function (offset: number, limit: number, sort: string, search?: string, inLibraryOnly = true) {
  const library = inLibraryOnly || undefined;
  return await api.getRadios(library, search, limit, offset, sort);
};

const addUrl = function () {
  const url = prompt(t('enter_url'));
  if (!url) return;
  api
    .getRadio(url, 'url', undefined, false)
    .then(() => location.reload())
    .catch((e) => alert(e));
};
</script>
