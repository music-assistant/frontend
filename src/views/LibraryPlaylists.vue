<template>
  <ItemsListing
    itemtype="playlists"
    :items="items"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="true"
    :load-data="loadItems"
    :show-library="true"
    :sort-keys="['sort_name', 'timestamp_added DESC']"
    :update-available="updateAvailable"
    @refresh-clicked="updateAvailable = false"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, ProviderFeature, type Playlist, EventMessage, EventType } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Playlist[]>([]);
const updateAvailable = ref(false);

store.topBarContextMenuItems = [
  {
    label: 'sync_now',
    labelArgs: [t('playlists')],
    action: () => {
      api.startSync([MediaType.PLAYLIST]);
    },
    icon: 'mdi-sync',
  },
];

for (const prov of Object.values(api.providers).filter(
  (x) => x.available && x.supported_features.includes(ProviderFeature.PLAYLIST_CREATE),
)) {
  store.topBarContextMenuItems.push({
    label: 'create_playlist',
    labelArgs: [prov.name],
    action: () => {
      newPlaylist(prov.instance_id);
    },
    icon: 'mdi-sync',
  });
}

onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  return await api.getLibraryPlaylists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

onMounted(() => {
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe_multi(
    [EventType.MEDIA_ITEM_ADDED, EventType.MEDIA_ITEM_UPDATED, EventType.MEDIA_ITEM_DELETED],
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
