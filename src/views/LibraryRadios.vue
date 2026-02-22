<template>
  <ItemsListing
    itemtype="radios"
    path="libraryradios"
    :show-duration="false"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="$t('radios')"
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
    :icon="Radio"
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
import { Radio } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Radios",
});

const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryRadiosCount);
const showAddEditDialog = ref(false);

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

onMounted(() => {
  // signal if/when items get added within this library
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith("library://radio")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryRadios(
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
    total.value = store.libraryRadiosCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryRadiosCount(params.favoritesOnly || false);
};
</script>
