<template>
  <section class="podcast-details">
    <PodcastHero
      :item="itemDetails"
      :backdrop="backdrop.url"
      :blur-backdrop="backdrop.blurred"
      :episode-count="episodeCount"
    />

    <template v-if="itemDetails">
      <DetailTextRow
        v-if="itemDetails.metadata.description"
        :title="$t('about_podcast')"
        :text="itemDetails.metadata.description"
        :dialog-title="itemDetails.name"
        markdown
        :lines="4"
      />

      <ItemsListing
        itemtype="podcastepisodes"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-library="false"
        :show-favorites-only-filter="false"
        :show-hide-fully-played-filter="true"
        :show-track-number="true"
        :show-refresh-button="true"
        :load-items="loadPodcastEpisodes"
        :sort-keys="[
          'position_desc',
          'position',
          'name',
          'duration',
          'duration_desc',
        ]"
        :update-available="updateAvailable"
        :title="$t('podcast_episodes')"
        :allow-key-hooks="true"
        :path="`podcast.${itemDetails.item_id}.${itemDetails.provider}`"
        :restore-state="true"
        :no-server-side-sorting="true"
      />

      <!-- provider mapping details -->
      <DetailAdminCard>
        <ProviderDetails :item-details="itemDetails" />
      </DetailAdminCard>
    </template>
    <br />
  </section>
</template>

<script setup lang="ts">
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { podcastBackdrop } from "@/components/podcast/podcastData";
import PodcastHero from "@/components/podcast/PodcastHero.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import {
  EventType,
  type Podcast,
  type PodcastEpisode,
  type EventMessage,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { keepOwnFavorite, subscribeOwnFavorites } from "@/helpers/favorites";
import { api } from "@/plugins/api";
import { computed, watch, ref, onMounted, onBeforeUnmount } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Podcast>();
// how many episodes the podcast holds, counted from the loaded episodes since
// the stored total_episodes of a library podcast is never updated
const episodeCount = ref<number>();
// fetched along with the podcast, so the hero gets its count even when the
// listing restores its episodes from a previous visit
let prefetchedEpisodes: Promise<PodcastEpisode[]> | undefined;

const backdrop = computed(() =>
  itemDetails.value
    ? podcastBackdrop(itemDetails.value)
    : { url: undefined, blurred: false },
);

const loadItemDetails = async function () {
  const { itemId, provider } = props;
  // the previous podcast must not stay actionable under the new route
  itemDetails.value = undefined;
  episodeCount.value = undefined;
  updateAvailable.value = false;
  prefetchedEpisodes = fetchEpisodes();
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

onMounted(() => {
  //signal if/when item updates
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        itemDetails.value = keepOwnFavorite(
          updatedItem,
          itemDetails.value,
        ) as Podcast;
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);

  // the user's own like or dislike, wherever they made it
  const unsubFavorite = subscribeOwnFavorites((update) => {
    const item = itemDetails.value;
    if (item?.uri == update.uri) item.favorite = update.favorite;
  });
  onBeforeUnmount(unsubFavorite);
});

const loadPodcastEpisodes = async function (params: LoadDataParams) {
  // only a first load takes the prefetch, later ones need fresh played states
  const request = (!params.refresh && prefetchedEpisodes) || fetchEpisodes();
  prefetchedEpisodes = undefined;
  return await request;
};

// a declaration, since the immediate route watcher calls it during setup
function fetchEpisodes() {
  const { itemId, provider } = props;
  const request = api.getPodcastEpisodes(itemId, provider);
  request.then(
    (episodes) => {
      if (itemId === props.itemId && provider === props.provider) {
        episodeCount.value = episodes.length;
      }
    },
    // the prefetch may go unused, so its failure must not go unhandled
    () => undefined,
  );
  return request;
}
</script>
