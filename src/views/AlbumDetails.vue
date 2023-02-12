<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <v-tabs v-model="activeTab" show-arrows grow hide-slider>
      <v-tab
        value="tracks"
      >
        {{ $t("tracks") }}
      </v-tab>
      <v-tab
        value="versions"
      >
        {{ $t("album_versions") }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <ItemsListing
      v-if="activeTab == 'tracks'"
      itemtype="albumtracks"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-library="true"
      :load-data="loadAlbumTracks"
      :sort-keys="['track_number', 'sort_name', 'duration']"
    />
    <ItemsListing
      v-if="activeTab == 'versions'"
      itemtype="albumversions"
      :parent-item="itemDetails"
      :show-providers="true"
      :show-library="false"
      :load-data="loadAlbumVersions"
      :sort-keys="['provider', 'sort_name', 'year']"
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing from "../components/ItemsListing.vue";
import { filteredItems } from "../components/ItemsListing.vue";
import InfoHeader from "../components/InfoHeader.vue";
import {
  EventType,
  type Album,
  type EventMessage,
  type MediaItemType,
} from "../plugins/api/interfaces";
import { api } from "../plugins/api";
import { watchEffect, ref, onMounted, onBeforeUnmount } from "vue";
import { parseBool } from "@/utils";

export interface Props {
  itemId: string;
  provider: string;
  forceProviderVersion?: string;
}
const props = defineProps<Props>();
const activeTab = ref("");

const itemDetails = ref<Album>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getAlbum(
    props.itemId,
    props.provider,
    undefined,
    undefined,
    undefined,
    parseBool(props.forceProviderVersion || "")
  );
  activeTab.value = "tracks";
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

const loadAlbumTracks = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  const albumTracks = await api.getAlbumTracks(props.itemId, props.provider);
  return filteredItems(albumTracks, offset, limit, sort, search, inLibraryOnly);
};

const loadAlbumVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  const albumVersions = await api.getAlbumVersions(
    props.itemId,
    props.provider
  );
  return filteredItems(
    albumVersions,
    offset,
    limit,
    sort,
    search,
    inLibraryOnly
  );
};
</script>

<style lang="scss">

</style>
