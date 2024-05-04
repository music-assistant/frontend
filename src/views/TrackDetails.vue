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
        itemDetails.provider == 'library' &&
        getStreamingProviderMappings(itemDetails).length > 0
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
      :show-refresh-button="false"
      :sort-keys="['name', 'sort_name', 'duration']"
      :title="$t('other_versions')"
      :hide-on-empty="true"
      :path="provider + itemId"
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
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { EventType, type Track } from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import { watch } from 'vue';
import ProviderDetails from '@/components/ProviderDetails.vue';
import { getStreamingProviderMappings } from '@/helpers/utils';

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
