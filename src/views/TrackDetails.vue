<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <v-tabs v-model="activeTab" show-arrows grow hide-slider>
      <v-tab value="versions">
        {{ $t('all_versions') }}
      </v-tab>
      <v-tab value="appears_on">
        {{ $t('appears_on') }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <ItemsListing
      v-if="activeTab == 'versions'"
      itemtype="trackversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="true"
      :show-track-number="false"
      :load-data="loadTrackVersions"
      :sort-keys="['provider', 'sort_name', 'duration']"
      :update-available="updateAvailable"
      @refresh-clicked="
        loadItemDetails();
        updateAvailable = false;
      "
    />
    <ItemsListing
      v-if="activeTab == 'appears_on'"
      itemtype="trackalbums"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="true"
      :show-track-number="false"
      :load-data="loadTrackAlbums"
      :sort-keys="['provider', 'sort_name', 'duration']"
      :update-available="updateAvailable"
      @refresh-clicked="
        loadItemDetails();
        updateAvailable = false;
      "
    />
    <!-- buttons to show more items on streaming providers-->
    <div v-if="itemDetails && itemDetails.provider == 'library'" style="margin-left: 20px; margin-right: 20px">
      <div v-for="providerMapping in getStreamingProviderMappings(itemDetails)" :key="providerMapping.provider_instance">
        <ListItem
          v-if="![providerMapping.provider_domain, providerMapping.provider_instance].includes(provider)"
          @click="
            $router.push({
              name: 'track',
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
              name: 'track',
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
    </div>
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { ref } from 'vue';
import { EventType, type Track, type EventMessage, type MediaItemType, Album } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { onBeforeUnmount, onMounted, watch } from 'vue';
import ListItem from '../components/mods/ListItem.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import {getStreamingProviderMappings} from '../utils'

export interface Props {
  itemId: string;
  provider: string;
  album?: string;
}
const props = defineProps<Props>();
const activeTab = ref('');
const updateAvailable = ref(false);
const itemDetails = ref<Track>();

const loadItemDetails = async function () {
  console.log('props', props);
  itemDetails.value = await api.getTrack(props.itemId, props.provider, props.album);
  activeTab.value = 'versions';
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

const loadTrackVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const trackVersions = await api.getTrackVersions(props.itemId, props.provider);
  return filteredItems(trackVersions, offset, limit, sort, search, favoritesOnly);
};

const loadTrackAlbums = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  let trackAlbums = await api.getTrackAlbums(props.itemId, props.provider);

  if (trackAlbums.length == 0 && itemDetails.value?.album) trackAlbums = [itemDetails.value?.album as Album];

  return filteredItems(trackAlbums, offset, limit, sort, search, favoritesOnly);
};
</script>
