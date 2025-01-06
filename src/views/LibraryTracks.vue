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
    :title="$t('tracks')"
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
  />
  <AddManualLink v-model="showAddEditDialog" :type="MediaType.RADIO" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType, MediaType } from "@/plugins/api/interfaces";
import AddManualLink from "@/components/AddManualLink.vue";
import { sleep } from "@/helpers/utils";
import { store } from "@/plugins/store";

defineOptions({
  name: "Tracks",
});

const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryTracksCount);
const showAddEditDialog = ref(false);

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
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe_multi(
    [
      EventType.MEDIA_ITEM_ADDED,
      EventType.MEDIA_ITEM_UPDATED,
      EventType.MEDIA_ITEM_DELETED,
    ],
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
  if (params.refresh && !updateAvailable.value) {
    api.startSync([MediaType.TRACK]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (api.syncTasks.value.length > 0) {
      if (
        api.syncTasks.value.filter((x) =>
          x.media_types.includes(MediaType.TRACK),
        ).length == 0
      )
        break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryTracks(
    params.favoritesOnly,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly) {
    total.value = store.libraryTracksCount;
    return;
  }
  total.value = await api.getLibraryTracksCount(params.favoritesOnly || false);
};
</script>
