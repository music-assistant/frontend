<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <v-tabs
      v-model="activeTab"
      show-arrows
      grow
      hide-slider
    >
      <v-tab value="tracks">
        {{ $t("tracks") }}
      </v-tab>
      <v-tab value="albums">
        {{ $t("albums") }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <ItemsListing
      v-if="activeTab == 'tracks'"
      itemtype="artisttracks"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-track-number="false"
      :show-library="false"
      :load-data="loadArtistTracks"
      :sort-keys="['timestamp_added DESC', 'sort_name', 'sort_album']"
      :update-available="updateAvailable"
      @refresh-clicked="loadItemDetails();updateAvailable=false;"
    />
    <ItemsListing
      v-if="activeTab == 'albums'"
      itemtype="artistalbums"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-library="false"
      :load-data="loadArtistAlbums"
      :sort-keys="['timestamp_added DESC', 'sort_name', 'year']"
      :update-available="updateAvailable"
      @refresh-clicked="loadItemDetails();updateAvailable=false;"
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing from "../components/ItemsListing.vue";
import { filteredItems } from "../components/ItemsListing.vue";
import InfoHeader from "../components/InfoHeader.vue";
import { ref, watch } from "vue";
import {
  EventType,
  type Artist,
  type EventMessage,
  type MediaItemType,
} from "../plugins/api/interfaces";
import { api } from "../plugins/api";
import { onBeforeUnmount, onMounted } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const activeTab = ref("");
const updateAvailable = ref(false);

const itemDetails = ref<Artist>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getArtist(props.itemId, props.provider);
  activeTab.value = "tracks";
};


watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  }, { immediate: true }
);

onMounted(() => {

  const unsub = api.subscribe_multi(
    [EventType.MEDIA_ITEM_ADDED, EventType.MEDIA_ITEM_UPDATED],
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        updateAvailable.value = true;
      } else {
        for (const provId of updatedItem.provider_mappings) {
          if (
            provId.provider_domain == itemDetails.value?.provider &&
            provId.item_id == itemDetails.value?.item_id
          ) {
            updateAvailable.value = true;
            break;
          }
        }
      }
    }
  );
  onBeforeUnmount(unsub);
});

const loadArtistAlbums = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  const artistAlbums = await api.getArtistAlbums(props.itemId, props.provider);
  return filteredItems(
    artistAlbums,
    offset,
    limit,
    sort,
    search,
    inLibraryOnly
  );
};
const loadArtistTracks = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  const artistTopTracks = await api.getArtistTracks(
    props.itemId,
    props.provider
  );
  return filteredItems(
    artistTopTracks,
    offset,
    limit,
    sort,
    search,
    inLibraryOnly
  );
};
</script>
