<template>
  <ItemsListing
    itemtype="audiobooks"
    path="libraryaudiobooks"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="collection === undefined"
    :load-paged-data="loadItems"
    :show-library="true"
    :sort-keys="sortKeys()"
    :update-available="updateAvailable"
    :title="getTitle()"
    :allow-key-hooks="true"
    :show-search-button="true"
    :icon="BookAudio"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
    :show-genre-filter="true"
    :show-audiobook-collections-collapsed="true"
    :collection="collection"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaItemType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { BookAudio } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { $t } from "@/plugins/i18n";

defineOptions({
  name: "Audiobooks",
});

const updateAvailable = ref(false);
const total = ref(store.libraryAudiobooksCount);

const route = useRoute();
const collection = ref<string | undefined>();
collection.value = route.query.collection as string | undefined;

const sortKeys = function () {
  if (collection.value === undefined)
    return [
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
  return [];
};

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);
  if (collection.value) {
    return await api.getAudiobookCollection(collection.value, params.search);
  }
  const items: MediaItemType[] = [];
  if (params.audiobookCollectionsCollapsed) {
    items.push(...(await api.getAudiobookCollectionFolders(params.search)));
  }
  items.push(
    ...(await api.getLibraryAudiobooks(
      params.favoritesOnly || undefined,
      params.search,
      params.limit,
      params.offset,
      params.sortBy,
      params.provider && params.provider.length > 0
        ? params.provider
        : undefined,
      params.genreIds,
      params.audiobookCollectionsCollapsed,
    )),
  );
  return items;
};

const getTitle = function () {
  if (collection.value != undefined) {
    return (
      collection.value + " (" + $t("audiobook") + " " + $t("collection") + ")"
    );
  }
  return $t("audiobooks");
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly && !params.provider) {
    total.value = store.libraryAudiobooksCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryAudiobooksCount(
    params.favoritesOnly || false,
  );
};

watch(
  () => route.query.collection,
  (val) => {
    if (val) {
      collection.value = route.query.collection as string;
    } else {
      collection.value = undefined;
    }
  },
  { immediate: true },
);

onMounted(() => {
  // signal if/when items get added within this library
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith("library://audiobook")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>
