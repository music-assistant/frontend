<template>
  <ItemsListing
    itemtype="genres"
    path="librarygenres"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :update-available="updateAvailable"
    :title="$t('genres.genres')"
    :allow-key-hooks="true"
    :show-search-button="true"
    :sort-keys="sortKeys"
    icon="mdi-tag-multiple"
    :restore-state="true"
    :total="total"
    :extra-menu-items="extraMenuItems"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "Genres",
});

const { t } = useI18n();
const updateAvailable = ref(false);
const total = ref(store.libraryGenresCount);

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "timestamp_added",
  "timestamp_added_desc",
];

const extraMenuItems = computed(() => [
  {
    label: "settings.add_new",
    icon: "mdi-plus",
    action: () => {
      eventbus.emit("editGenre", undefined);
    },
  },
]);

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryGenres(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly) {
    total.value = store.libraryGenresCount;
    return;
  }
  total.value = await api.getLibraryGenresCount(params.favoritesOnly || false);
};

onMounted(() => {
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith("library://genre")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>
