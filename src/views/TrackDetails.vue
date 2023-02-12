<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <v-tabs v-model="activeTab" show-arrows grow hide-slider>
      <v-tab value="details">
        {{ $t("track_versions") }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <ItemsListing
      v-if="activeTab == 'versions'"
      itemtype="trackversions"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-library="false"
      :show-track-number="false"
      :load-data="loadTrackVersions"
      :sort-keys="['provider', 'sort_name', 'duration']"
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { filteredItems } from "../components/ItemsListing.vue";
import InfoHeader from "../components/InfoHeader.vue";
import { ref } from "vue";
import {
  EventType,
  type Track,
  type EventMessage,
  type MediaItemType,
} from "../plugins/api/interfaces";
import { api } from "../plugins/api";
import { onBeforeUnmount, onMounted, watchEffect } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const activeTab = ref("");

const itemDetails = ref<Track>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getTrack(props.itemId, props.provider);
  activeTab.value = "versions";
};

watchEffect(() => {
  // load info
  loadItemDetails();
});

onMounted(() => {
  //reload if/when item updates
  const unsub = api.subscribe_multi(
    [EventType.MEDIA_ITEM_ADDED, EventType.MEDIA_ITEM_UPDATED],
    (evt: EventMessage) => {
      // refresh info if we receive an update for this item
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        loadItemDetails();
      } else {
        for (const provId of updatedItem.provider_mappings) {
          if (
            provId.provider_domain == itemDetails.value?.provider &&
            provId.item_id == itemDetails.value?.item_id
          ) {
            loadItemDetails();
            break;
          }
        }
      }
    }
  );
  onBeforeUnmount(unsub);
});

const loadTrackVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  const trackVersions = await api.getTrackVersions(
    props.itemId,
    props.provider
  );
  return filteredItems(
    trackVersions,
    offset,
    limit,
    sort,
    search,
    inLibraryOnly
  );
};
</script>
