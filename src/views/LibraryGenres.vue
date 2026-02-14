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
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
    :extra-menu-items="extraMenuItems"
  />
  <AddGenreAliasDialog v-model="showAddGenreDialog" :type="MediaType.GENRE" />
  <AddGenreAliasDialog
    v-model="showAddAliasDialog"
    :type="MediaType.GENRE_ALIAS"
  />
</template>

<script setup lang="ts">
import AddGenreAliasDialog from "@/components/AddGenreAliasDialog.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType, MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { authManager } from "@/plugins/auth";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Tag, Tags, Plus } from "lucide-vue-next";

defineOptions({
  name: "Genres",
});

const updateAvailable = ref(false);
const total = ref(store.libraryGenresCount);
const showAddGenreDialog = ref(false);
const showAddAliasDialog = ref(false);
const refreshKey = ref(0);

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
    {
      label: "add_alias",
      labelArgs: [],
      action: () => {
        showAddAliasDialog.value = true;
      },
      icon: Tags,
    },
  ];
});

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);

  // Always fetch genres
  const genres = await api.getLibraryGenres(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
  );

  // If searching, also fetch aliases and include their parent genres in results
  // The genres field is always populated on library_items responses
  if (params.search) {
    const aliases = await api.getLibraryAliases(
      params.favoritesOnly || undefined,
      params.search,
      params.limit,
      params.offset,
      params.sortBy,
    );

    // Extract parent genres from aliases (genres field is pre-populated)
    const parentGenresFromAliases = aliases
      .filter((alias) => alias.genres && alias.genres.length > 0)
      .flatMap((alias) => alias.genres || []);

    // Remove duplicates (genres already in the main results)
    const genreUris = new Set(genres.map((g) => g.uri));
    const uniqueParentGenres = parentGenresFromAliases.filter(
      (genre) => !genreUris.has(genre.uri),
    );

    // Combine genres with unique parent genres from aliases
    return [...genres, ...uniqueParentGenres];
  }

  return genres;
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

onMounted(() => {
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      if (evt.object_id?.startsWith("library://genre")) {
        // Silently refresh the genre list by incrementing the key
        refreshKey.value++;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>
