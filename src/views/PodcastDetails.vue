<template>
  <InfoHeader :item="itemDetails" />
  <ItemsListing
    v-if="itemDetails"
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
      'position',
      'position_desc',
      'name',
      'duration',
      'duration_desc',
    ]"
    :update-available="updateAvailable"
    :title="$t('podcast_episodes')"
    :allow-key-hooks="true"
    :path="`podcast.${props.itemId}.${props.provider}`"
    :restore-state="true"
    :no-server-side-sorting="true"
  />

  <!-- provider mapping details -->
  <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import {
  EventType,
  type Podcast,
  type EventMessage,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { watch, ref, onMounted, onBeforeUnmount } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Podcast>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getPodcast(props.itemId, props.provider);
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
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
        itemDetails.value = updatedItem as Podcast;
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadPodcastEpisodes = async function (params: LoadDataParams) {
  return await api.getPodcastEpisodes(props.itemId, props.provider);
};
</script>
