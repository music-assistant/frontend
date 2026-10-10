<template>
  <ItemsListing
    ref="itemsListing"
    itemtype="tracks"
    path="librarytracks"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :show-track-number="false"
    :load-paged-data="loadItems"
    :sort-media-type="MediaType.TRACK"
    :show-album="true"
    :update-available="updateAvailable"
    :title="$t('tracks')"
    :show-search-button="true"
    :show-genre-filter="true"
    :allow-key-hooks="true"
    :extra-menu-items="extraMenuItems"
    :icon="Music2"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
  />
  <AddManualLink
    v-model="showAddEditDialog"
    :type="MediaType.TRACK"
    @success="itemsListing?.reload()"
  />
</template>

<script setup lang="ts">
import AddManualLink from "@/components/AddManualLink.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { onLibrarySyncCompleted } from "@/composables/useLibrarySync";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaType,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { ListPlus, Music2 } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Tracks",
});

const updateAvailable = ref<boolean>(false);
const total = ref(store.libraryTracksCount);
const showAddEditDialog = ref(false);
const itemsListing = ref<InstanceType<typeof ItemsListing>>();

// adding a track by its url adds it to the library
const extraMenuItems = computed<ToolBarMenuItem[]>(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE)
    ? [
        {
          label: "add_url_item",
          labelArgs: [],
          action: () => {
            showAddEditDialog.value = true;
          },
          icon: ListPlus,
        },
      ]
    : [],
);

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
  // per-item add events are suppressed during provider library syncs; also
  // refresh when a sync covering this media type finishes
  const unsubSync = onLibrarySyncCompleted(MediaType.TRACK, () => {
    updateAvailable.value = true;
  });
  onBeforeUnmount(unsubSync);
});

const loadItems = async function (params: LoadDataParams) {
  params.favoritesOnly = params.favoritesOnly || undefined;
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryTracks(
    params.favoritesOnly,
    params.search,
    params.limit,
    params.offset,
    params.sort_field,
    params.sort_direction,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
  );
};

const setTotals = async function (params: LoadDataParams) {
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
