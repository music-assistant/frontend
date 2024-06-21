<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <!-- loading animation -->
    <v-progress-linear v-if="loading" indeterminate />

    <ItemsListing
      v-if="itemDetails"
      itemtype="artistalbums"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="true"
      :show-library-only-filter="
        itemDetails.provider == 'library' &&
        getStreamingProviderMappings(itemDetails).length > 0
      "
      :show-refresh-button="false"
      :load-items="loadArtistAlbums"
      :sort-keys="['name', 'sort_name', 'year']"
      :title="$t('albums')"
      :allow-collapse="true"
    />
    <br />
    <ItemsListing
      v-if="itemDetails"
      itemtype="artisttracks"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="true"
      :show-library-only-filter="
        itemDetails.provider == 'library' &&
        getStreamingProviderMappings(itemDetails).length > 0
      "
      :show-refresh-button="false"
      :show-track-number="false"
      :load-items="loadArtistTracks"
      :sort-keys="['name', 'sort_name', 'album']"
      :title="$t('tracks')"
      :allow-collapse="true"
    />
    <br />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';
import InfoHeader from '@/components/InfoHeader.vue';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EventType, type Artist } from '@/plugins/api/interfaces';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { api } from '@/plugins/api';
import { getStreamingProviderMappings } from '@/helpers/utils';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Artist>();
const loading = ref(false);

const loadItemDetails = async function () {
  loading.value = true;
  itemDetails.value = await api.getArtist(props.itemId, props.provider);
  loading.value = false;
};

onMounted(() => {
  // auto refresh the info if this (library) item is updated.
  if (props.provider == 'library') {
    const unsub = api.subscribe(
      EventType.MEDIA_ITEM_UPDATED,
      loadItemDetails,
      `library://artist/${props.itemId}`,
    );
    onBeforeUnmount(unsub);
  }
});

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

const loadArtistAlbums = async function (params: LoadDataParams) {
  return await api.getArtistAlbums(
    props.itemId,
    props.provider,
    params.libraryOnly,
  );
};

const loadArtistTracks = async function (params: LoadDataParams) {
  return await api.getArtistTracks(
    props.itemId,
    props.provider,
    params.libraryOnly,
  );
};
</script>
