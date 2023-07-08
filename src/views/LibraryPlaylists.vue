<template>
  <ItemsListing
    itemtype="playlists"
    :items="items"
    :show-duration="false"
    :show-providers="true"
    :load-data="loadItems"
    :show-library="true"
    :sort-keys="['sort_name', 'timestamp_added DESC']"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemsListing from '../components/ItemsListing.vue';
import api from '../plugins/api';
import { MediaType, ProviderFeature, type Playlist } from '../plugins/api/interfaces';
import { store } from '../plugins/store';

const { t } = useI18n();
const items = ref<Playlist[]>([]);

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

const loadItems = async function (offset: number, limit: number, sort: string, search?: string, inLibraryOnly = true) {
  const library = inLibraryOnly || undefined;
  return await api.getPlaylists(library, search, limit, offset, sort);
};

const newPlaylist = async function (provId: string) {
  const name = prompt(t('new_playlist_name'));
  if (!name) return;
  await api
    .createPlaylist(name, provId)
    .then(() => location.reload())
    .catch((e) => alert(e));
};
</script>
