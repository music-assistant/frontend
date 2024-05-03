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
      :sort-keys="['track_number', 'name', 'duration']"
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
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '@/components/ItemsListing.vue';
import InfoHeader from '@/components/InfoHeader.vue';
import { EventType, type Album } from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { getStreamingProviderMappings } from '@/helpers/utils';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Album>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getAlbum(props.itemId, props.provider);
};

onMounted(() => {
  // auto refresh the info if this (library) item is updated.
  if (props.provider == 'library') {
    const unsub = api.subscribe(
      EventType.MEDIA_ITEM_UPDATED,
      loadItemDetails,
      `library://album/${props.itemId}`,
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
</script>
