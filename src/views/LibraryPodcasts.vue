<template>
  <ItemsListing
    itemtype="podcasts"
    path="librarypodcasts"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-library="true"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="$t('podcasts')"
    :allow-key-hooks="true"
    :show-search-button="true"
    :icon="Podcast"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
    :show-genre-filter="true"
  >
    <template #title>
      <div class="podcasts-title">
        <span>{{ $t("podcasts") }}</span>
        <v-btn
          class="latest-episodes-link"
          variant="text"
          color="primary"
          size="small"
          prepend-icon="mdi-new-box"
          :title="$t('latest_episodes')"
          :aria-label="$t('latest_episodes')"
          @click.stop="router.push({ name: 'podcasts-latest' })"
        >
          <span class="latest-episodes-label">{{ $t("latest_episodes") }}</span>
        </v-btn>
      </div>
    </template>
  </ItemsListing>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { onLibrarySyncCompleted } from "@/composables/useLibrarySync";
import api from "@/plugins/api";
import { EventMessage, EventType, MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Podcast } from "@lucide/vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

defineOptions({
  name: "Podcasts",
});

const router = useRouter();
const updateAvailable = ref(false);
const total = ref(store.libraryPodcastsCount);

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
  return await api.getLibraryPodcasts(
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
    total.value = store.libraryPodcastsCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryPodcastsCount(
    params.favoritesOnly || false,
  );
};

onMounted(() => {
  // signal if/when items get added within this library
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_ADDED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith("library://podcast")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
  // per-item add events are suppressed during provider library syncs; also
  // refresh when a sync covering this media type finishes
  const unsubSync = onLibrarySyncCompleted(MediaType.PODCAST, () => {
    updateAvailable.value = true;
  });
  onBeforeUnmount(unsubSync);
});
</script>

<style scoped>
.podcasts-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.25rem;
}

.latest-episodes-link {
  flex-shrink: 0;
  text-transform: none;
  letter-spacing: normal;
}

@media (max-width: 600px) {
  .latest-episodes-link {
    min-width: 36px;
    padding-inline: 6px;
  }

  .latest-episodes-label {
    display: none;
  }
}
</style>
