<template>
  <ItemsListing
    itemtype="playlists"
    :items="items"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-library="true"
    :sort-keys="Object.keys(sortKeys)"
    :update-available="updateAvailable"
    :title="getBreakpointValue('bp4') ? $t('playlists') : ''"
    :allow-key-hooks="true"
    :show-search-button="true"
    :context-menu-items="contextMenuItems"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';
import api from '@/plugins/api';
import {
  ProviderFeature,
  type Playlist,
  EventMessage,
  EventType,
  MediaType,
} from '@/plugins/api/interfaces';
import { ContextMenuItem } from '@/helpers/contextmenu';
import { sleep } from '@/helpers/utils';
import { getBreakpointValue } from '@/plugins/breakpoint';

defineOptions({
  name: 'Playlists',
});

const { t } = useI18n();
const items = ref<Playlist[]>([]);
const updateAvailable = ref(false);
const contextMenuItems = ref<ContextMenuItem[]>([]);

const sortKeys: Record<string, string> = {
  name: 'name',
  name_desc: 'name DESC',
  sort_name: 'sort_name',
  sort_name_desc: 'sort_name DESC',
  timestamp_added: 'timestamp_added',
  timestamp_added_desc: 'timestamp_added DESC',
  timestamp_modified: 'timestamp_modified',
  timestamp_modified_desc: 'timestamp_modified DESC',
  last_played: 'last_played',
  last_played_desc: 'last_played DESC',
  play_count: 'play_count',
  play_count_desc: 'play_count DESC',
};

const loadItems = async function (params: LoadDataParams) {
  if (params.refresh && !updateAvailable.value) {
    api.startSync([MediaType.PLAYLIST]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (api.syncTasks.value.length > 0) {
      if (
        api.syncTasks.value.filter((x) =>
          x.media_types.includes(MediaType.PLAYLIST),
        ).length == 0
      )
        break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  return await api.getLibraryPlaylists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    sortKeys[params.sortBy],
  );
};

onMounted(() => {
  for (const prov of Object.values(api.providers).filter(
    (x) =>
      x.available &&
      x.supported_features.includes(ProviderFeature.PLAYLIST_CREATE),
  )) {
    contextMenuItems.value.push({
      label: 'create_playlist_on',
      labelArgs: [prov.name],
      action: () => {
        newPlaylist(prov.instance_id);
      },
      icon: 'mdi-playlist-plus',
    });
  }
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe_multi(
    [
      EventType.MEDIA_ITEM_ADDED,
      EventType.MEDIA_ITEM_UPDATED,
      EventType.MEDIA_ITEM_DELETED,
    ],
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith('library://playlist')) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const newPlaylist = async function (provId: string) {
  const name = prompt(t('new_playlist_name'));
  if (!name) return;
  await api
    .createPlaylist(name, provId)
    .then(() => location.reload())
    .catch((e) => alert(e));
};
</script>
