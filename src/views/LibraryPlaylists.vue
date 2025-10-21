<template>
  <ItemsListing
    itemtype="playlists"
    path="libraryplaylists"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-library="true"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="$t('playlists')"
    :allow-key-hooks="true"
    :show-search-button="true"
    :extra-menu-items="extraMenuItems"
    icon="mdi-playlist-play"
    :restore-state="true"
    :total="total"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { ToolBarMenuItem } from "@/components/Toolbar.vue";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "Playlists",
});

const { t } = useI18n();
const updateAvailable = ref(false);
const total = ref(store.libraryPlaylistsCount);
const extraMenuItems = ref<ToolBarMenuItem[]>([
  {
    label: "sync_now",
    icon: "mdi-sync",
    action: () => {
      api.startSync([MediaType.PLAYLIST]);
    },
    overflowAllowed: true,
    disabled: api.syncTasks.value.length > 0,
  },
]);

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "timestamp_added",
  "timestamp_added_desc",
  "timestamp_modified",
  "timestamp_modified_desc",
  "last_played",
  "last_played_desc",
  "play_count",
  "play_count_desc",
];

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryPlaylists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly) {
    total.value = store.libraryPlaylistsCount;
    return;
  }
  total.value = await api.getLibraryPlaylistsCount(
    params.favoritesOnly || false,
  );
};

onMounted(() => {
  const playListCreateItems: ToolBarMenuItem[] = [];
  for (const prov of Object.values(api.providers).filter(
    (x) =>
      x.available &&
      x.supported_features.includes(ProviderFeature.PLAYLIST_CREATE),
  )) {
    playListCreateItems.push({
      label: "create_playlist_on",
      labelArgs: [prov.name],
      action: () => {
        newPlaylist(prov.instance_id);
      },
      icon: "mdi-playlist-plus",
    });
  }
  if (playListCreateItems.length) {
    extraMenuItems.value.push({
      label: "create_playlist_on",
      icon: "mdi-playlist-plus",
      subItems: playListCreateItems,
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
      if (evt.object_id?.startsWith("library://playlist")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const newPlaylist = async function (provId: string) {
  const name = prompt(t("new_playlist_name"));
  if (!name) return;
  await api
    .createPlaylist(name, provId)
    .then(() => location.reload())
    .catch((e) => alert(e));
};
</script>
