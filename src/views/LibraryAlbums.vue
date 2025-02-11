<template>
  <ItemsListing
    itemtype="albums"
    path="libraryalbums"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="$t('albums')"
    :allow-key-hooks="true"
    :show-search-button="true"
    icon="mdi-album"
    :restore-state="true"
    :total="total"
    :show-album-type-filter="true"
    :extra-menu-items="[
      {
        label: 'sync_now',
        icon: 'mdi-sync',
        action: () => {
          api.startSync([MediaType.ALBUM]);
        },
        overflowAllowed: true,
        disabled: api.syncTasks.value.length > 0,
      },
    ]"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { MediaType, EventMessage, EventType } from "@/plugins/api/interfaces";
import { sleep } from "@/helpers/utils";
import { store } from "@/plugins/store";

defineOptions({
  name: "Albums",
});

const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryAlbumsCount);

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "year",
  "year_desc",
  "timestamp_added",
  "timestamp_added_desc",
  "last_played",
  "last_played_desc",
  "play_count",
  "play_count_desc",
  "artist_name",
  "artist_name_desc",
];

onMounted(() => {
  // signal if/when items get added within this library
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith("library://artist")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryAlbums(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    params.albumType,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly && !params.albumType) {
    total.value = store.libraryAlbumsCount;
    return;
  }
  total.value = await api.getLibraryAlbumsCount(
    params.favoritesOnly || undefined,
    params.albumType || undefined,
  );
};
</script>
