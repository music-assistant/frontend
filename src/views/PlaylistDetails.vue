<template>
  <InfoHeader :item="itemDetails" />
  <ItemsListing
    v-if="itemDetails"
    itemtype="playlisttracks"
    :parent-item="itemDetails"
    :show-provider="false"
    :show-library="false"
    :show-favorites-only-filter="false"
    :show-track-number="false"
    :show-refresh-button="true"
    :load-items="loadPlaylistTracks"
    :sort-keys="[
      'position',
      'position_desc',
      'name',
      'artist',
      'album',
      'duration',
      'duration_desc',
    ]"
    :update-available="updateAvailable"
    :title="$t('playlist_tracks')"
    :allow-key-hooks="true"
    :path="`playlist.${props.itemId}.${props.provider}`"
    :restore-state="true"
    :no-server-side-sorting="true"
  />

  <!-- provider mapping details -->
  <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';
import InfoHeader from '@/components/InfoHeader.vue';
import ProviderDetails from '@/components/ProviderDetails.vue';
import {
  EventType,
  type Playlist,
  type EventMessage,
  type MediaItemType,
} from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import { watch, ref, onMounted, onBeforeUnmount } from 'vue';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Playlist>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getPlaylist(props.itemId, props.provider);
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
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadPlaylistTracks = async function (params: LoadDataParams) {
  return await api.getPlaylistTracks(
    props.itemId,
    props.provider,
    params.refresh,
  );
};
</script>
