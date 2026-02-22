<template>
  <ItemsListing
    itemtype="artists"
    path="libraryartists"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-album-artists-only-filter="true"
    :update-available="updateAvailable"
    :title="$t('artists')"
    :allow-key-hooks="true"
    :show-search-button="true"
    :sort-keys="sortKeys"
    :icon="ArtistIcon"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import ArtistIcon from "@/components/icons/ArtistIcon.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Artists",
});

const updateAvailable = ref(false);
const total = ref(store.libraryArtistsCount);

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "timestamp_added",
  "timestamp_added_desc",
  "last_played",
  "last_played_desc",
  "play_count",
  "play_count_desc",
];

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryArtists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    params.albumArtistsFilter,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly && !params.albumArtistsFilter && !params.provider) {
    total.value = store.libraryArtistsCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryArtistsCount(
    params.favoritesOnly || false,
    params.albumArtistsFilter || false,
  );
};

onMounted(() => {
  // signal if/when items get added/updated/removed within this library
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
</script>
