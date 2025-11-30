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
    :title="title"
    :allow-key-hooks="true"
    :show-search-button="true"
    :extra-menu-items="extraMenuItems"
    icon="mdi-playlist-play"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { ToolBarMenuItem } from "@/components/Toolbar.vue";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

defineOptions({
  name: "Playlists",
});

const { t } = useI18n();
const route = useRoute();
const genreId = route.query.genre_id as string | undefined;
const genreName = route.query.genre_name as string | undefined;

const updateAvailable = ref(false);
const total = ref(store.libraryPlaylistsCount);
const extraMenuItems = ref<ToolBarMenuItem[]>([]);

const title = computed(() => {
  return t("playlists");
});

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

  if (genreId) {
    return await api.getGenrePlaylists(
      genreId,
      "library",
      params.libraryOnly,
      params.limit,
      params.offset,
    );
  }

  return await api.getLibraryPlaylists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (genreId) {
    total.value = undefined;
    return;
  }
  if (!params.favoritesOnly && !params.provider) {
    total.value = store.libraryPlaylistsCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
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
