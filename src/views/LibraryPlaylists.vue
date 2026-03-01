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
    :show-genre-filter="true"
    :extra-menu-items="extraMenuItems"
    :icon="ListMusic"
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
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { ListMusic } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Playlists",
});

const updateAvailable = ref(false);
const total = ref(store.libraryPlaylistsCount);
const extraMenuItems = ref<ToolBarMenuItem[]>([]);

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
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
  );
};

const setTotals = async function (params: LoadDataParams) {
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
      overflowAllowed: true,
    });
  }
  if (playListCreateItems.length) {
    extraMenuItems.value.push({
      label: "create_playlist_on",
      icon: "mdi-playlist-plus",
      subItems: playListCreateItems,
      overflowAllowed: true,
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

const newPlaylist = function (provId: string) {
  eventbus.emit("createPlaylist", { providerId: provId });
};
</script>
