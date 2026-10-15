<template>
  <section class="podcast-details">
    <PodcastHero
      :item="itemDetails"
      :backdrop="backdrop.url"
      :blur-backdrop="backdrop.blurred"
      :episode-count="episodeCount"
      @edit-rows="rowsEditorOpen = true"
    />

    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <!-- the podcast's description -->
        <DetailTextRow
          v-if="rowId === 'about' && itemDetails.metadata.description"
          :title="$t('about_podcast')"
          :text="itemDetails.metadata.description"
          :dialog-title="itemDetails.name"
          markdown
          :lines="4"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- the podcast's episodes -->
        <ItemsListing
          v-else-if="rowId === 'episodes'"
          ref="episodesListing"
          itemtype="podcastepisodes"
          :parent-item="itemDetails"
          :show-provider="false"
          :show-library="false"
          :show-favorites-only-filter="false"
          :show-hide-fully-played-filter="true"
          :show-track-number="true"
          :show-refresh-button="true"
          :sort-listing="ListingType.PODCAST_EPISODES"
          :load-paged-data="loadPodcastEpisodes"
          :update-available="updateAvailable"
          :title="$t('podcast_episodes')"
          :allow-key-hooks="true"
          :path="`podcast.${itemDetails.item_id}.${itemDetails.provider}`"
          :restore-state="true"
        />

        <!-- provider mapping details -->
        <DetailAdminCard v-else-if="rowId === 'provider_mappings'">
          <ProviderDetails :item-details="itemDetails" />
        </DetailAdminCard>
      </template>
    </template>
    <RowsEditor
      v-if="itemDetails"
      v-model:open="rowsEditorOpen"
      :item="itemDetails"
      :registry="podcastRows"
      :available-ids="availableRows"
      :row-meta="rowMeta"
      :subtitle="$t('edit_rows_subtitle_podcast')"
    />
    <br />
  </section>
</template>

<script setup lang="ts">
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import RowsEditor from "@/components/details/RowsEditor.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { podcastBackdrop } from "@/components/podcast/podcastData";
import PodcastHero from "@/components/podcast/PodcastHero.vue";
import {
  PODCAST_ROWS,
  podcastRows,
  type PodcastRowId,
} from "@/components/podcast/podcastRows";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import { api } from "@/plugins/api";
import {
  ListingType,
  type Podcast,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, watch, ref } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Podcast>();
// how many episodes the podcast holds, counted from the loaded episodes since
// the stored total_episodes of a library podcast is never updated
const countedEpisodeCount = ref<number>();
const countedEpisodes = ref<PodcastEpisode[]>([]);
const episodesListing = ref<InstanceType<typeof ItemsListing>[]>();
const episodeCount = computed(() => {
  const listing = episodesListing.value?.[0];
  return listing?.allItemsReceived && !listing.hasActiveFilters
    ? listing.pagedItems.length
    : countedEpisodeCount.value;
});
const rowsEditorOpen = ref(false);

// every row applies to every user; the editor lists the same set
const availableRows = PODCAST_ROWS.map((row) => row.id);

// reads the user's preferences from the store, so the page follows the editor
const visibleRows = computed(() => {
  const { order, hidden } = podcastRows.resolve(availableRows);
  return order.filter((rowId) => !hidden.has(rowId));
});

// how much each row currently holds, for the editor's per-row meta line
const rowMeta = computed<Partial<Record<PodcastRowId, string>>>(() => ({
  episodes:
    episodeCount.value != null
      ? $t("n_episodes", episodeCount.value, {
          named: { count: episodeCount.value },
        })
      : undefined,
}));

const backdrop = computed(() =>
  itemDetails.value
    ? podcastBackdrop(itemDetails.value)
    : { url: undefined, blurred: false },
);

const loadItemDetails = async function () {
  const { itemId, provider } = props;
  // the previous podcast must not stay actionable under the new route
  itemDetails.value = undefined;
  countedEpisodeCount.value = undefined;
  countedEpisodes.value = [];
  updateAvailable.value = false;
  rowsEditorOpen.value = false;
  const podcast = await api.getPodcast(itemId, provider);
  // a slower response for a previous podcast must not replace the current one
  if (itemId !== props.itemId || provider !== props.provider) return;
  itemDetails.value = podcast;
};

watch(
  () => [props.itemId, props.provider],
  ([itemId]) => {
    if (itemId) loadItemDetails();
  },
  { immediate: true },
);

useDetailItemUpdates(itemDetails, {
  onUpdate: () => (updateAvailable.value = true),
});

const loadPodcastEpisodes = async function (params: LoadDataParams) {
  const { itemId, provider } = props;
  const episodes = await api.getPodcastEpisodes(
    itemId,
    provider,
    params.hideFullyPlayed ? false : undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
  );
  if (
    itemId === props.itemId &&
    provider === props.provider &&
    !params.search &&
    !params.hideFullyPlayed
  ) {
    const restoredItems =
      (episodesListing.value?.[0]?.pagedItems as
        PodcastEpisode[] | undefined) ?? [];
    const previousItems =
      restoredItems.length > countedEpisodes.value.length
        ? restoredItems
        : countedEpisodes.value;
    countedEpisodes.value = params.offset
      ? [...previousItems, ...episodes]
      : episodes;
    countedEpisodeCount.value =
      episodes.length < params.limit ? countedEpisodes.value.length : undefined;
  }
  return episodes;
};
</script>
