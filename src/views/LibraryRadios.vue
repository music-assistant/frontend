<template>
  <ItemsListing
    itemtype="radios"
    :items="items"
    :show-duration="false"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :sort-keys="Object.keys(sortKeys)"
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
  type Radio,
} from '@/plugins/api/interfaces';
import { sleep } from '@/helpers/utils';
import { getBreakpointValue } from '@/plugins/breakpoint';
import router from '@/plugins/router';

defineOptions({
  name: 'Radios',
});

const { t } = useI18n();
const items = ref<Radio[]>([]);
const updateAvailable = ref<boolean>(false);

const sortKeys: Record<string, string> = {
  name: 'name COLLATE NOCASE ASC',
  name_desc: 'name COLLATE NOCASE DESC',
  sort_name: 'sort_name',
  sort_name_desc: 'sort_name DESC',
  timestamp_added: 'timestamp_added',
  timestamp_added_desc: 'timestamp_added DESC',
  last_played: 'last_played',
  last_played_desc: 'last_played DESC',
  play_count: 'play_count',
  play_count_desc: 'play_count DESC',
};

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
  return await api.getLibraryRadios(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    sortKeys[params.sortBy],
  );
};

const addUrl = async function () {
  const url = prompt(t('enter_url'));
  if (!url) return;
  if (!url?.startsWith('http')) {
    alert(t('invalid_input'));
    return;
  }
  api
    .getItem(MediaType.RADIO, url, 'builtin')
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
      api.addItemToLibrary(item).then(() => router.go(0));
    })
    .catch((e) => alert(e));
};
</script>
