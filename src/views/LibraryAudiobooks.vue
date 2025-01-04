<template>
  <ItemsListing
    itemtype="audiobooks"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-library="true"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="$t('audiobooks')"
    :allow-key-hooks="true"
    :show-search-button="true"
    :extra-menu-items="extraMenuItems"
    icon="mdi-book-play-outline"
    :restore-state="true"
    :total="total"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import api from "@/plugins/api";
import { EventMessage, EventType, MediaType } from "@/plugins/api/interfaces";
import { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { sleep } from "@/helpers/utils";
import { store } from "@/plugins/store";

defineOptions({
  name: "Audiobooks",
});

const updateAvailable = ref(false);
const total = ref(store.libraryAudiobooksCount);
const extraMenuItems = ref<ToolBarMenuItem[]>([]);

const sortKeys = [
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

const loadItems = async function (params: LoadDataParams) {
  if (params.refresh && !updateAvailable.value) {
    api.startSync([MediaType.PLAYLIST]);
    // prevent race condition with a short sleep
    await sleep(250);
    // wait for sync to finish
    while (api.syncTasks.value.length > 0) {
      if (
        api.syncTasks.value.filter((x) =>
          x.media_types.includes(MediaType.PLAYLIST),
        ).length == 0
      )
        break;
      await sleep(500);
    }
    await sleep(500);
  }
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryAudiobooks(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly) {
    total.value = store.libraryAudiobooksCount;
    return;
  }
  total.value = await api.getLibraryAudiobooksCount(
    params.favoritesOnly || false,
  );
};

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
      if (evt.object_id?.startsWith("library://audiobook")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});
</script>
