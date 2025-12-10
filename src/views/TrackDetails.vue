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
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
    <br />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  EventMessage,
  EventType,
  MediaItemType,
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

const loadItemDetails = async function () {
  itemDetails.value = await api.getTrack(
    props.itemId,
    props.provider,
    props.album,
  );
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
</script>
