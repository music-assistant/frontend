<template>
  <ItemsListing
    itemtype="albums"
    path="libraryalbums"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="title"
    :allow-key-hooks="true"
    :show-search-button="true"
    icon="mdi-album"
    :restore-state="true"
    :total="total"
    :show-album-type-filter="true"
    :show-provider-filter="true"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

defineOptions({
  name: "Albums",
});

const route = useRoute();
const { t } = useI18n();
const genreId = route.query.genre_id as string | undefined;
const genreName = route.query.genre_name as string | undefined;

const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryAlbumsCount);

const title = computed(() => {
  return t("albums");
});

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

  if (genreId) {
    return await api.getGenreAlbums(
      genreId,
      "library",
      params.libraryOnly,
      params.limit,
      params.offset,
    );
  }

  return await api.getLibraryAlbums(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    params.albumType,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (genreId) {
    total.value = undefined;
    return;
  }
  if (!params.favoritesOnly && !params.albumType && !params.provider) {
    total.value = store.libraryAlbumsCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryAlbumsCount(
    params.favoritesOnly || undefined,
    params.albumType || undefined,
  );
};
</script>
