<template>
  <ItemsListing
    itemtype="tracks"
    :items="items"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :show-track-number="false"
    :load-paged-data="loadItems"
    :sort-keys="Object.keys(sortKeys)"
    :show-album="true"
    :update-available="updateAvailable"
    :title="getBreakpointValue('bp4') ? $t('tracks') : ''"
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
import {
  EventMessage,
  EventType,
  MediaType,
  type Track,
} from '../plugins/api/interfaces';
import { sleep } from '@/helpers/utils';
import { getBreakpointValue } from '@/plugins/breakpoint';

const { t } = useI18n();
const items = ref<Track[]>([]);
const updateAvailable = ref<boolean>(false);

const sortKeys: Record<string, string> = {
  name: 'sort_name',
  recent: 'timestamp_added DESC',
  artist: 'sort_artist, sort_name',
  album: 'albums.sort_name, tracks.sort_name',
  duration: 'duration',
  duration_desc: 'duration DESC',
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
      if (evt.object_id?.startsWith('library://track')) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadItems = async function (params: LoadDataParams) {
  params.favoritesOnly = params.favoritesOnly || undefined;
  if (params.refresh && !updateAvailable.value) {
    api.startSync([MediaType.TRACK]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (api.syncTasks.value.length > 0) {
      if (
        api.syncTasks.value.filter((x) =>
          x.media_types.includes(MediaType.TRACK),
        ).length == 0
      )
        break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  return await api.getLibraryTracks(
    params.favoritesOnly,
    params.search,
    params.limit,
    params.offset,
    sortKeys[params.sortBy],
  );
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
