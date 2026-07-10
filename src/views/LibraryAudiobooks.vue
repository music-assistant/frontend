<template>
  <ItemsListing
    itemtype="audiobooks"
    path="libraryaudiobooks"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-library="true"
    :sort-keys="sortKeys()"
    :update-available="updateAvailable"
    :title="$t(audiobooksViewMode)"
    :allow-key-hooks="true"
    :show-search-button="true"
    :icon="icon()"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
    :show-genre-filter="true"
    :title-drop-down-items="getTitleDropDownItems()"
    :title-drop-down-action="onDropDownClick"
    :reload-data="reloadData"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { onLibrarySyncCompleted } from "@/composables/useLibrarySync";
import { useUserPreferences } from "@/composables/userPreferences";
import api from "@/plugins/api";
import {
  ArtistType,
  EventMessage,
  EventType,
  MediaType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { BookAudio, Mic, UserPen } from "@lucide/vue";
import { watch, onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Audiobooks",
});

type AudiobooksViewModes = "audiobooks" | "authors" | "narrators";

const { getPreference, setPreference } = useUserPreferences();
const savedAudiobooksViewMode = getPreference<AudiobooksViewModes>(
  "audiobooks_view_mode",
  "audiobooks",
);
const audiobooksViewMode = ref<AudiobooksViewModes>(
  savedAudiobooksViewMode.value,
);

const updateAvailable = ref(false);
const reloadData = ref(false);
const authorsSupported = ref(false);
const narratorsSupported = ref(false);
const total = ref(store.libraryAudiobooksCount);

const sortKeys = function () {
  if (audiobooksViewMode.value == "audiobooks") {
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
  }
  return [
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
};

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);

  console.error(getPreference("foo", "bah"));

  if (audiobooksViewMode.value == "audiobooks") {
    return await api.getLibraryAudiobooks(
      params.favoritesOnly || undefined,
      params.search,
      params.limit,
      params.offset,
      params.sortBy,
      params.provider && params.provider.length > 0
        ? params.provider
        : undefined,
      params.genreIds,
    );
  }

  let artistType = ArtistType.AUTHOR;
  if (audiobooksViewMode.value == "narrators") {
    artistType = ArtistType.NARRATOR;
  }
  return await api.getLibraryArtists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    undefined,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
    artistType,
  );
};

const icon = function () {
  if (audiobooksViewMode.value === "authors") {
    return UserPen;
  } else if (audiobooksViewMode.value === "narrators") {
    return Mic;
  } else {
    return BookAudio;
  }
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

const getTitleDropDownItems = function () {
  if (narratorsSupported.value === false && authorsSupported.value === false)
    return undefined;
  if (audiobooksViewMode.value == "audiobooks") {
    if (narratorsSupported.value === true && authorsSupported.value === true)
      return ["authors", "narrators"];
    if (authorsSupported.value === true) return ["authors"];
    if (narratorsSupported.value === true) return ["narrators"];
  }

  const array = ["audiobooks"];
  if (
    audiobooksViewMode.value == "authors" &&
    narratorsSupported.value === true
  ) {
    array.push("narrators");
  }
  if (
    audiobooksViewMode.value == "narrators" &&
    authorsSupported.value === true
  ) {
    array.push("authors");
  }

  return array;
};

const onDropDownClick = function (item: string) {
  if (narratorsSupported.value === false && authorsSupported.value === false)
    return undefined;
  audiobooksViewMode.value = item as AudiobooksViewModes;
  reloadData.value = !reloadData.value;
};

onMounted(() => {
  // determine if there is author or narrator support by a provider
  for (const prov of Object.values(api.providers).filter(
    (x) =>
      x.available &&
      x.supported_features.includes(ProviderFeature.AUTHOR_AUDIOBOOKS),
  )) {
    authorsSupported.value = true;
  }
  for (const prov of Object.values(api.providers).filter(
    (x) =>
      x.available &&
      x.supported_features.includes(ProviderFeature.NARRATOR_AUDIOBOOKS),
  )) {
    narratorsSupported.value = true;
  }

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
  });
  onBeforeUnmount(unsubSync);
});

watch(audiobooksViewMode, (newVal) => {
  setPreference("audiobooks_view_mode", newVal);
});
</script>
