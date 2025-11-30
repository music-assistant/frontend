<template>
  <ItemsListing
    itemtype="tracks"
    path="librarytracks"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :show-track-number="false"
    :load-paged-data="loadItems"
    :sort-keys="sortKeys"
    :show-album="true"
    :update-available="updateAvailable"
    :title="title"
    :show-search-button="true"
    :allow-key-hooks="true"
    :extra-menu-items="[
      {
        label: 'add_url_item',
        labelArgs: [],
        action: () => {
          showAddEditDialog = true;
        },
        icon: 'mdi-playlist-plus',
      },
    ]"
    icon="mdi-music-note"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
  />
  <AddManualLink v-model="showAddEditDialog" :type="MediaType.RADIO" />
</template>

<script setup lang="ts">
import AddManualLink from "@/components/AddManualLink.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType, MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

defineOptions({
  name: "Tracks",
});

const route = useRoute();
const { t } = useI18n();
const genreId = route.query.genre_id as string | undefined;
const genreName = route.query.genre_name as string | undefined;

const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryTracksCount);
const showAddEditDialog = ref(false);

const title = computed(() => {
  return t("tracks");
});

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "duration",
  "duration_desc",
  "timestamp_added",
  "timestamp_added_desc",
  "last_played",
  "last_played_desc",
  "play_count",
  "play_count_desc",
];

onMounted(() => {
  // signal if/when items get added within this library
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith("library://track")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadItems = async function (params: LoadDataParams) {
  params.favoritesOnly = params.favoritesOnly || undefined;
  updateAvailable.value = false;
  setTotals(params);

  if (genreId) {
    return await api.getGenreTracks(
      genreId,
      "library",
      params.libraryOnly,
      params.limit,
      params.offset,
    );
  }

  return await api.getLibraryTracks(
    params.favoritesOnly,
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
    total.value = store.libraryTracksCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryTracksCount(params.favoritesOnly || false);
};
</script>
