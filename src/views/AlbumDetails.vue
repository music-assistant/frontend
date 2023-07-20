<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <ItemsListing
      itemtype="albumtracks"
      :parent-item="itemDetails"
      :show-provider="false"
      :show-favorites-only-filter="false"
      :load-data="loadAlbumTracks"
      :sort-keys="['track_number', 'sort_name', 'duration']"
      :update-available="updateAvailable"
      @refresh-clicked="
        loadItemDetails();
        updateAvailable = false;
      "
      :title="$t('tracks')"
      :checksum="provider+itemId"
    />
    <ItemsListing
      itemtype="albumversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :load-data="loadAlbumVersions"
      :sort-keys="['provider', 'sort_name', 'year']"
      :update-available="updateAvailable"
      @refresh-clicked="
        loadItemDetails();
        updateAvailable = false;
      "
      :title="$t('other_versions')"
      :hide-on-empty="true"
      :checksum="provider+itemId"
    />
    <!-- buttons to show more items on streaming providers-->
    <v-card v-if="itemDetails && itemDetails.provider == 'library'" style="margin-left: 20px; margin-right: 20px">
      <div v-for="providerMapping in getStreamingProviderMappings(itemDetails)" :key="providerMapping.provider_instance">
        <ListItem
          v-if="![providerMapping.provider_domain, providerMapping.provider_instance].includes(provider)"
          @click="
            $router.replace({
              name: 'album',
              params: {
                itemId: providerMapping.item_id,
                provider: providerMapping.provider_instance,
              },
            })
          "
          :subtitle="
            $t('check_item_on_provider', [
              itemDetails.name,
              api.providerManifests[providerMapping.provider_domain].name,
            ])
          "
        >
          <template #prepend>
            <div>
              <ProviderIcon :domain="providerMapping.provider_domain" :size="30" />
            </div>
          </template>
        </ListItem>
        <ListItem
          v-if="provider != 'library' && itemDetails.provider == 'library'"
          @click="
            $router.replace({
              name: 'album',
              params: {
                itemId: itemDetails.item_id,
                provider: itemDetails.provider,
              },
            })
          "
          :subtitle="$t('check_item_in_library', [itemDetails.name])"
        >
          <template #prepend>
            <div>
              <ProviderIcon domain="library" :size="30" />
            </div>
          </template>
        </ListItem>
      </div>
    </v-card>
  </section>
</template>

<script setup lang="ts">
import ItemsListing from '../components/ItemsListing.vue';
import { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { EventType, type Album, type EventMessage, type MediaItemType } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import ListItem from '../components/mods/ListItem.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import {getStreamingProviderMappings} from '../utils'

export interface Props {
  itemId: string;
  provider: string;
  forceProviderVersion?: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
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

const loadAlbumTracks = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const albumTracks = await api.getAlbumTracks(props.itemId, props.provider);
  return filteredItems(albumTracks, offset, limit, sort, search, favoritesOnly);
};

const loadAlbumVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const albumVersions = await api.getAlbumVersions(props.itemId, props.provider);
  return filteredItems(albumVersions, offset, limit, sort, search, favoritesOnly);
};
</script>

<style lang="scss"></style>
