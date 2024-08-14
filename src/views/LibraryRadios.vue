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
          addUrl();
        },
        icon: 'mdi-playlist-plus',
      },
    ]"
    icon="mdi-access-point"
    :restore-state="true"
    :total="total"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';
import api from '@/plugins/api';
import {
  EventMessage,
  EventType,
  ImageType,
  MediaType,
} from '@/plugins/api/interfaces';
import { sleep } from '@/helpers/utils';
import router from '@/plugins/router';
import { store } from '@/plugins/store';

defineOptions({
  name: 'Radios',
});

const { t } = useI18n();
const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryRadiosCount);

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

const addUrl = async function () {
  const url = prompt(t('enter_url'));
  if (!url) return;
  if (!url?.startsWith('http')) {
    alert(t('invalid_input'));
    return;
  }
  api
    .getRadio(url, 'builtin')
    .then((item) => {
      const name = prompt(t('enter_name'), item.name);
      item.name = name || item.name;
      delete item.sort_name;

      const imgUrl = prompt(
        t('image_url'),
        item.metadata.images?.length ? item.metadata.images[0].path : '',
      );
      if (imgUrl) {
        item.metadata.images = [
          {
            type: ImageType.THUMB,
            path: imgUrl,
            provider: 'builtin',
            remotely_accessible: true,
          },
        ];
      }
      api.addItemToLibrary(item).then(() => window.location.reload());
    })
    .catch((e) => alert(e));
};
</script>
