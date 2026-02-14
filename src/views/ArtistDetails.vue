<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <ItemsListing
      v-if="itemDetails && !loading"
      itemtype="artistalbums"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="true"
      :show-library-only-filter="
        itemDetails.provider == 'library' && api.hasStreamingProviders.value
      "
      :show-album-type-filter="true"
      :show-refresh-button="false"
      :load-items="loadArtistAlbums"
      :sort-keys="[
        'name',
        'sort_name',
        'year',
        'name_desc',
        'sort_name_desc',
        'year_desc',
      ]"
      :title="$t('albums')"
      :allow-collapse="true"
    />
    <br />
    <ItemsListing
      v-if="itemDetails && !loading"
      itemtype="artisttracks"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="true"
      :show-library-only-filter="
        itemDetails.provider == 'library' && api.hasStreamingProviders.value
      "
      :show-provider-filter="itemDetails.provider == 'library'"
      :show-refresh-button="false"
      :show-track-number="false"
      :load-items="loadArtistTracks"
      :sort-keys="[
        'original',
        'name',
        'sort_name',
        'album',
        'duration',
        'name_desc',
        'sort_name_desc',
        'duration_desc',
      ]"
      :title="$t('tracks')"
      :allow-collapse="true"
    />
    <br />
    <!-- media images -->
    <MediaItemImages
      v-if="itemDetails?.provider == 'library' && itemDetails?.metadata?.images && authManager.isAdmin()"
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
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import MediaItemImages from "@/components/MediaItemImages.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import {
  EventMessage,
  EventType,
  MediaItemType,
  type Artist,
} from "@/plugins/api/interfaces";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

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
      const updatedItem = evt.data as MediaItemType;
      // check if the updated item is the current item
      if (itemDetails.value?.uri == updatedItem.uri) {
        // update UI with the updated item
        loading.value = true;
        itemDetails.value = updatedItem as Artist;
        loading.value = false;
      } else if ("provider_mappings" in updatedItem) {
        for (const provMap of updatedItem.provider_mappings) {
          if (
            provMap.item_id == props.itemId &&
            [provMap.provider_instance, provMap.provider_domain].includes(
              props.provider,
            )
          ) {
            loading.value = true;
            itemDetails.value = updatedItem as Artist;
            loading.value = false;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);
});

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
    params.provider && params.provider.length > 0 ? params.provider : undefined,
  );
};

const UpdateItemInDb = async function () {
  if (!itemDetails.value) return;
  itemDetails.value = await api.sendCommand("music/artists/update", {
    item_id: itemDetails.value.item_id,
    update: itemDetails.value,
    overwrite: true,
  });
};
</script>
