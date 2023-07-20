<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />

      <ItemsListing
        itemtype="artisttracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :show-track-number="false"
        :load-data="loadArtistTracks"
        :sort-keys="['timestamp_added DESC', 'sort_name', 'sort_album']"
        :update-available="updateAvailable"
        @refresh-clicked="
          loadItemDetails();
          updateAvailable = false;
        "
        :title="$t('tracks')"
        :checksum="provider+itemId"
      />

      <ItemsListing
        itemtype="artistalbums"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :load-data="loadArtistAlbums"
        :sort-keys="['timestamp_added DESC', 'sort_name', 'year']"
        :update-available="updateAvailable"
        @refresh-clicked="
          loadItemDetails();
          updateAvailable = false;
        "
        :title="$t('albums')"
        :checksum="provider+itemId"
      />

      <!-- buttons to show more items on streaming providers-->
      <v-card v-if="itemDetails && itemDetails.provider == 'library'" style="margin-left: 20px; margin-right: 20px">
        <div
          v-for="providerMapping in getStreamingProviderMappings(itemDetails)"
          :key="providerMapping.provider_instance"
        >
          <ListItem
            v-if="![providerMapping.provider_domain, providerMapping.provider_instance].includes(provider)"
            @click="
              $router.push({
                name: 'artist',
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
              $router.push({
                name: 'artist',
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
import ItemsListing, { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { ref, watch, onBeforeUnmount, onMounted } from 'vue';
import { EventType, type Artist, type EventMessage, type MediaItemType } from '../plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { api } from '../plugins/api';
import ListItem from '../components/mods/ListItem.vue';
import { getStreamingProviderMappings } from '../utils';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const activeTab = ref('library');
const updateAvailable = ref(false);

const itemDetails = ref<Artist>();

const loadItemDetails = async function () {
  const prevTab = activeTab.value;
  activeTab.value = '';
  itemDetails.value = await api.getArtist(props.itemId, props.provider);
  activeTab.value = prevTab;
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

const loadArtistAlbums = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const artistAlbums = await api.getArtistAlbums(props.itemId, props.provider);
  return filteredItems(artistAlbums, offset, limit, sort, search, favoritesOnly);
};
const loadArtistTracks = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const artistTopTracks = await api.getArtistTracks(props.itemId, props.provider);
  return filteredItems(artistTopTracks, offset, limit, sort, search, favoritesOnly);
};
</script>
