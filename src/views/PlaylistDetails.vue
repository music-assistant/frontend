<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="playlisttracks"
      :parent-item="itemDetails"
      :show-provider="false"
      :show-library="false"
      :show-favorites-only-filter="false"
      :show-track-number="false"
      :load-items="loadPlaylistTracks"
      :sort-keys="['position', 'position_desc', 'name', 'artist', 'album', 'duration', 'duration_desc']"
      :update-available="updateAvailable"
      :title="$t('playlist_tracks')"
      :allow-key-hooks="true"
    />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { EventType, type Playlist, type EventMessage, type MediaItemType, Track } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { watch, ref, onMounted, onBeforeUnmount } from 'vue';
import { sleep } from '@/helpers/utils';

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
  const unsub = api.subscribe(EventType.MEDIA_ITEM_ADDED, (evt: EventMessage) => {
    // signal user that there might be updated info available for this item
    const updatedItem = evt.data as MediaItemType;
    if (itemDetails.value?.uri == updatedItem.uri) {
      updateAvailable.value = true;
    }
  });
  onBeforeUnmount(unsub);
});

const loadPlaylistTracks = async function (params: LoadDataParams) {
  const playlistTracks: Track[] = [];
  await api.getPlaylistTracks(
    props.itemId,
    props.provider,
    (data: Track[]) => {
      playlistTracks.push(...data);
    },
    params.refresh && !updateAvailable.value,
  );
  // prevent race condition with a short sleep
  if (params.refresh) await sleep(100);
  updateAvailable.value = false;
  return playlistTracks;
};
</script>
