<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="albumtracks"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="true"
      :show-library-only-filter="
        itemDetails.provider == 'library' &&
        getStreamingProviderMappings(itemDetails).length > 0
      "
      :show-refresh-button="false"
      :load-items="loadAlbumTracks"
      :sort-keys="[
        'track_number',
        'name',
        'sort_name',
        'duration',
        'duration_desc',
      ]"
      :title="$t('tracks')"
    />
    <br />
    <ItemsListing
      v-if="itemDetails"
      itemtype="albumversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-refresh-button="false"
      :load-items="loadAlbumVersions"
      :sort-keys="['provider', 'name', 'year']"
      :title="$t('other_versions')"
      :hide-on-empty="true"
    />
    <br />
    <!-- media images -->
    <MediaItemImages
      v-if="itemDetails?.provider == 'library' && itemDetails?.metadata?.images"
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
import { type Album } from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import { ref, watch } from 'vue';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { getStreamingProviderMappings } from '@/helpers/utils';
import MediaItemImages from '@/components/MediaItemImages.vue';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Album>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getAlbum(props.itemId, props.provider);
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

const loadAlbumTracks = async function (params: LoadDataParams) {
  return await api.getAlbumTracks(
    props.itemId,
    props.provider,
    params.libraryOnly,
  );
};

const loadAlbumVersions = async function (params: LoadDataParams) {
  return await api.getAlbumVersions(
    itemDetails.value!.item_id,
    itemDetails.value!.provider,
  );
};

const UpdateItemInDb = async function () {
  if (!itemDetails.value) return;
  itemDetails.value = await api.sendCommand('music/albums/update', {
    item_id: itemDetails.value.item_id,
    update: itemDetails.value,
    overwrite: true,
  });
};
</script>
