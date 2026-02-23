<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <ItemsListing
      v-if="itemDetails"
      itemtype="albumtracks"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-track-number="true"
      :show-favorites-only-filter="true"
      :show-library-only-filter="
        itemDetails.provider == 'library' && api.hasStreamingProviders.value
      "
      :show-refresh-button="false"
      :allow-key-hooks="true"
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
      :refresh-on-parent-update="true"
    />
    <br />
    <!-- media images -->
    <MediaItemImages
      v-if="
        itemDetails?.provider == 'library' &&
        itemDetails?.metadata?.images &&
        authManager.isAdmin()
      "
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
  type Album,
} from "@/plugins/api/interfaces";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Album>();
const loading = ref(false);

const loadItemDetails = async function () {
  loading.value = true;
  itemDetails.value = await api.getAlbum(props.itemId, props.provider);
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
        itemDetails.value = updatedItem as Album;
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
            itemDetails.value = updatedItem as Album;
            loading.value = false;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);
});

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
  itemDetails.value = await api.sendCommand("music/albums/update", {
    item_id: itemDetails.value.item_id,
    update: itemDetails.value,
    overwrite: true,
  });
};
</script>
