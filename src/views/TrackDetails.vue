<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="trackalbums"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library-only-filter="
        itemDetails.provider == 'library' && api.hasStreamingProviders.value
      "
      :show-track-number="false"
      :show-refresh-button="false"
      :load-items="loadTrackAlbums"
      :sort-keys="['name', 'sort_name', 'year', 'year_desc']"
      :title="$t('appears_on')"
      :path="provider + itemId"
      :allow-collapse="true"
    />
    <br />
    <ItemsListing
      v-if="itemDetails"
      itemtype="trackversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :load-items="loadTrackVersions"
      :sort-keys="['name', 'sort_name', 'duration']"
      :title="$t('other_versions')"
      :hide-on-empty="true"
      :path="provider + itemId"
      :allow-collapse="true"
      :show-refresh-button="false"
      :refresh-on-parent-update="true"
    />
    <br />
    <!-- similar tracks -->
    <ItemsListing
      v-if="itemDetails && !loading && hasSimilarTracksProvider"
      itemtype="similartracks"
      :parent-item="itemDetails"
      :show-provider="false"
      :show-favorites-only-filter="false"
      :show-library-only-filter="false"
      :show-refresh-button="false"
      :load-items="loadSimilarTracks"
      :title="$t('similar_tracks')"
      :allow-collapse="true"
    />
    <br />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
    <br />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  EventMessage,
  EventType,
  MediaItemType,
  ProviderFeature,
  type Track,
} from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { watch } from "vue";
import ProviderDetails from "@/components/ProviderDetails.vue";

export interface Props {
  itemId: string;
  provider: string;
  album?: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Track>();
const loading = ref(true);

const loadItemDetails = async function () {
  loading.value = true;
  itemDetails.value = await api.getTrack(
    props.itemId,
    props.provider,
    props.album,
  );
  loading.value = false;
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
      const updatedItem = evt.data as MediaItemType;
      // check if the updated item is the current item
      if (itemDetails.value?.uri == updatedItem.uri) {
        // update UI with the updated item
        itemDetails.value = updatedItem as Track;
      } else if ("provider_mappings" in updatedItem) {
        for (const provMap of updatedItem.provider_mappings) {
          if (
            provMap.item_id == props.itemId &&
            [provMap.provider_instance, provMap.provider_domain].includes(
              props.provider,
            )
          ) {
            itemDetails.value = updatedItem as Track;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadTrackVersions = async function (params: LoadDataParams) {
  return await api.getTrackVersions(
    itemDetails.value!.item_id,
    itemDetails.value!.provider,
  );
};

const loadTrackAlbums = async function (params: LoadDataParams) {
  return await api.getTrackAlbums(
    props.itemId,
    props.provider,
    params.libraryOnly,
  );
};

const hasSimilarTracksProvider = computed(() =>
  Object.values(api.providers).some((p) =>
    (p.supported_features as unknown as string[]).includes(
      ProviderFeature.SIMILAR_TRACKS,
    ),
  ),
);

const loadSimilarTracks = async function (_params: LoadDataParams) {
  if (!itemDetails.value) return [];
  const tracks = await api.getSimilarTracks(props.itemId, props.provider);
  return tracks.filter(
    (t) =>
      !itemDetails.value!.provider_mappings.some((refPm) =>
        t.provider_mappings.some(
          (tpm) =>
            tpm.item_id === refPm.item_id &&
            tpm.provider_domain === refPm.provider_domain,
        ),
      ),
  );
};
</script>
