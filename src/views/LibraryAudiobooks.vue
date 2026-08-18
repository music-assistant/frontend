<template>
  <ItemsListing
    itemtype="audiobooks"
    path="libraryaudiobooks"
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
    :icon="BookAudio"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
    :show-genre-filter="true"
    :show-collapse-collections="true"
    :tool-bar-tabs="artistTabs"
  />
</template>

<script setup lang="ts">
import ItemsListing, {
  LoadDataParams,
  ToolBarTab,
} from "@/components/ItemsListing.vue";
import { onLibrarySyncCompleted } from "@/composables/useLibrarySync";
import api from "@/plugins/api";
import {
  ArtistType,
  EventMessage,
  EventType,
  MediaType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { BookAudio } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Audiobooks",
});

const updateAvailable = ref(false);
const total = ref(store.libraryAudiobooksCount);
const supportedArtistTypes = ref<ArtistType[]>([]);

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
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryAudiobooks(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
    params.collapseCollections,
  );
};

const loadItemsAuthorsNarrators = async (
  params: LoadDataParams,
  artistType: ArtistType,
) => {
  updateAvailable.value = false;
  setTotals(params, artistType);

  return await api.getLibraryArtists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    false,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
    artistType,
  );
};

const loadItemsAuthors = (params: LoadDataParams) =>
  loadItemsAuthorsNarrators(params, ArtistType.AUTHOR);

const loadItemsNarrators = (params: LoadDataParams) =>
  loadItemsAuthorsNarrators(params, ArtistType.NARRATOR);

const setTotals = async function (
  params: LoadDataParams,
  artistType?: ArtistType,
) {
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  if (artistType !== undefined) {
    total.value = await api.getLibraryArtistsCount(
      params.favoritesOnly || false,
      false,
      artistType,
    );
    return;
  }
  if (!params.favoritesOnly) {
    total.value = store.libraryAudiobooksCount;
    return;
  }
  total.value = await api.getLibraryAudiobooksCount(
    params.favoritesOnly || false,
  );
};

// we switch to a tabbed view if more than just singers are supported
// singers are always included
const artistTabs = computed(() => {
  const bookTab: ToolBarTab = {
    id: "books",
    label: $t("audiobooks"),
    loadPagedData: loadItems,
  };
  const authorTab: ToolBarTab = {
    id: "authors",
    label: $t("authors"),
    loadPagedData: loadItemsAuthors,
  };
  const narratorTab: ToolBarTab = {
    id: "narrators",
    label: $t("narrators"),
    loadPagedData: loadItemsNarrators,
  };
  const tabsMap: Record<string, ToolBarTab> = {
    book: bookTab,
    author: authorTab,
    narrator: narratorTab,
  };

  const supportedTabIds = new Set<string>();

  // verify library support
  if (supportedArtistTypes.value.some((x) => x !== ArtistType.SINGER)) {
    supportedTabIds.add("book");
    supportedArtistTypes.value.forEach((x) => supportedTabIds.add(x));
  }

  // verify features of providers with a catalogue
  for (const prov of Object.values(api.providers).filter(
    (x) =>
      x.available &&
      (x.supported_features.includes(ProviderFeature.NARRATOR_AUDIOBOOKS) ||
        x.supported_features.includes(ProviderFeature.AUTHOR_AUDIOBOOKS)),
  )) {
    supportedTabIds.add("book");
    if (prov.supported_features.includes(ProviderFeature.AUTHOR_AUDIOBOOKS)) {
      supportedTabIds.add("author");
    }
    if (prov.supported_features.includes(ProviderFeature.NARRATOR_AUDIOBOOKS)) {
      supportedTabIds.add("narrator");
    }
  }

  const tabs = ["book", "author", "narrator"]
    .filter((id) => supportedTabIds.has(id))
    .map((id) => tabsMap[id]);

  return tabs.length > 0 ? tabs : undefined;
});

const refreshArtistTypes = async function () {
  supportedArtistTypes.value = await api.getLibraryArtistTypes();
};

onMounted(() => {
  refreshArtistTypes();
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
  // per-item add events are suppressed during provider library syncs; also
  // refresh when a sync covering this media type finishes
  const unsubSync = onLibrarySyncCompleted(MediaType.AUDIOBOOK, () => {
    updateAvailable.value = true;
    refreshArtistTypes();
  });
  onBeforeUnmount(unsubSync);

  const unsubArtistSync = onLibrarySyncCompleted(MediaType.ARTIST, () => {
    refreshArtistTypes();
  });
  onBeforeUnmount(unsubArtistSync);
});
</script>
