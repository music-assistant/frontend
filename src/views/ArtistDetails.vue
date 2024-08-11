<template>
  <section>
    <InfoHeader :item="itemDetails" />
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
      :show-album-type-filter="true"
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
    <!-- media images -->
    <MediaItemImages
      v-if="itemDetails?.metadata?.images"
      v-model="itemDetails.metadata.images"
      @update:model-value="UpdateItemInDb"
    />
    <br />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
    <br />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';
import InfoHeader from '@/components/InfoHeader.vue';
import { ref, watch } from 'vue';
import { type Artist } from '@/plugins/api/interfaces';
import ProviderDetails from '@/components/ProviderDetails.vue';
import MediaItemImages from '@/components/MediaItemImages.vue';
import { api } from '@/plugins/api';
import { getStreamingProviderMappings } from '@/helpers/utils';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Artist>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getArtist(props.itemId, props.provider);
};

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

const UpdateItemInDb = async function () {
  if (!itemDetails.value) return;
  itemDetails.value = await api.sendCommand('music/artists/update', {
    item_id: itemDetails.value.item_id,
    update: itemDetails.value,
    overwrite: true,
  });
};
</script>
