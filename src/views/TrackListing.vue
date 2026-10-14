<template>
  <section class="flex min-h-full flex-col">
    <ItemsListing
      v-if="itemDetails && config"
      fill-height
      :icon="ArrowLeft"
      :icon-action="backToTrack"
      :title="$t(config.labelKey)"
      :subtitle="itemDetails.name"
      :itemtype="config.itemtype"
      :path="config.path"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :show-refresh-button="false"
      :sort-listing="config.sortListing"
      :load-paged-data="config.loadPagedData"
      :restore-state="true"
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing from "@/components/ItemsListing.vue";
import { tracksShareMapping } from "@/components/track/trackData";
import type { LoadDataParams } from "@/composables/useItemsListing";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { goBack } from "@/helpers/navigation";
import { api } from "@/plugins/api";
import {
  ListingType,
  type MediaItemType,
  type Track,
} from "@/plugins/api/interfaces";
import { ArrowLeft } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
  // which of the track page's rows is shown in full
  listing: "similar";
  // uri of the album the track was opened from, when it appears on several
  album?: string;
}
const props = defineProps<Props>();

interface ListingConfig {
  labelKey: string;
  itemtype: string;
  path: string;
  sortListing: ListingType;
  loadPagedData: (params: LoadDataParams) => Promise<MediaItemType[]>;
}

const router = useRouter();
const itemDetails = ref<Track>();
let skippedSimilarTracks = 0;

watch(
  () => [props.itemId, props.provider, props.album] as const,
  async ([itemId, provider, album]) => {
    // the listing remounts for the new track instead of keeping the old items
    itemDetails.value = undefined;
    const track = await api.getTrack(itemId, provider, album);
    // a slower response for a previous track must not replace the current one
    if (
      itemId !== props.itemId ||
      provider !== props.provider ||
      album !== props.album
    ) {
      return;
    }
    itemDetails.value = track;
  },
  { immediate: true },
);

const config = computed<ListingConfig | undefined>(() => {
  switch (props.listing) {
    case "similar":
      return {
        labelKey: "similar_tracks",
        itemtype: "similartracks",
        path: "tracksimilar",
        sortListing: ListingType.SIMILAR_TRACKS,
        loadPagedData: loadSimilarTrackPage,
      };
    default:
      return undefined;
  }
});

async function loadSimilarTrackPage(
  params: LoadDataParams,
): Promise<MediaItemType[]> {
  const track = itemDetails.value;
  if (!track) return [];
  if (params.offset === 0) skippedSimilarTracks = 0;

  const tracks = await api.getSimilarTracks(
    track.item_id,
    track.provider,
    params.limit,
    params.search,
    params.offset + skippedSimilarTracks,
    params.sortField,
    params.sortDirection,
  );
  if (itemDetails.value?.uri !== track.uri) return [];

  const visibleTracks = tracks.filter(
    (candidate) => !tracksShareMapping(candidate, track),
  );
  skippedSimilarTracks += tracks.length - visibleTracks.length;
  return visibleTracks;
}

const backToTrack = function () {
  goBack(router, {
    name: "track",
    params: { provider: props.provider, itemId: props.itemId },
    query: props.album ? { album: props.album } : undefined,
  });
};

useEscapeBack(backToTrack);
</script>
