<template>
  <section>
    <ItemsListing
      v-if="itemDetails && config"
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
      :sort-keys="config.sortKeys"
      :load-items="config.loadItems"
      :restore-state="true"
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing from "@/components/ItemsListing.vue";
import { loadSimilarTracks } from "@/components/track/trackData";
import { goBack } from "@/helpers/navigation";
import { api } from "@/plugins/api";
import type { MediaItemType, Track } from "@/plugins/api/interfaces";
import { ArrowLeft } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
  // which of the track page's rows is shown in full
  listing: "similar";
}
const props = defineProps<Props>();

interface ListingConfig {
  labelKey: string;
  itemtype: string;
  path: string;
  sortKeys: string[];
  loadItems: () => Promise<MediaItemType[]>;
}

const router = useRouter();
const itemDetails = ref<Track>();

watch(
  () => [props.itemId, props.provider],
  async ([itemId, provider]) => {
    // the listing remounts for the new track instead of keeping the old items
    itemDetails.value = undefined;
    const track = await api.getTrack(itemId, provider);
    // a slower response for a previous track must not replace the current one
    if (itemId !== props.itemId || provider !== props.provider) return;
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
        sortKeys: ["name", "sort_name", "artist", "duration"],
        loadItems: async () =>
          itemDetails.value ? await loadSimilarTracks(itemDetails.value) : [],
      };
    default:
      return undefined;
  }
});

const backToTrack = function () {
  goBack(router, {
    name: "track",
    params: { provider: props.provider, itemId: props.itemId },
  });
};
</script>
