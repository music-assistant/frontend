<template>
  <ItemsListing
    :key="refreshKey"
    itemtype="genres"
    path="librarygenres"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :update-available="updateAvailable"
    :title="$t('genres')"
    :allow-key-hooks="true"
    :show-search-button="true"
    :sort-keys="sortKeys"
    :icon="Tag"
    :restore-state="restoreState"
    :total="total"
    :show-provider-filter="true"
    :extra-menu-items="extraMenuItems"
  />
  <AddGenreDialog v-model="showAddGenreDialog" @success="handleGenreAdded" />
</template>

<script setup lang="ts">
import AddGenreDialog from "@/components/AddGenreDialog.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { Plus, Tag } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Genres",
});

const updateAvailable = ref(false);
const total = ref(store.libraryGenresCount);
const showAddGenreDialog = ref(false);
const refreshKey = ref(0);
const restoreState = ref(true);

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "timestamp_added",
  "timestamp_added_desc",
  "play_count",
  "play_count_desc",
];

const extraMenuItems = computed(() => {
  if (!authManager.isAdmin()) return [];
  return [
    {
      label: "add_genre",
      labelArgs: [],
      action: () => {
        showAddGenreDialog.value = true;
      },
      icon: Plus,
    },
  ];
});

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);

  return await api.getLibraryGenres(
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
    total.value = store.libraryGenresCount;
    return;
  }
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryGenresCount(params.favoritesOnly || false);
};

const handleGenreAdded = async () => {
  // Update the total count from store
  total.value = store.libraryGenresCount;
  // Disable restore state temporarily to force fresh data load
  restoreState.value = false;
  // Trigger a refresh by setting updateAvailable and incrementing the key
  updateAvailable.value = true;
  // Force ItemsListing to remount and reload data
  refreshKey.value++;
  // Re-enable restore state after a short delay
  await new Promise((resolve) => setTimeout(resolve, 50));
  restoreState.value = true;
};

const triggerRefresh = async () => {
  // Disable restore state temporarily to force fresh data load
  restoreState.value = false;
  updateAvailable.value = true;
  refreshKey.value++;
  // Re-enable restore state after a short delay
  await new Promise((resolve) => setTimeout(resolve, 50));
  restoreState.value = true;
};

onMounted(() => {
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      if (evt.object_id?.startsWith("library://genre")) {
        triggerRefresh();
      }
    },
  );

  onBeforeUnmount(() => {
    unsub();
  });
});
</script>
