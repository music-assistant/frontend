<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <Container>
      <ItemsListing
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
        :title="$t('appears_on')"
        :checksum="provider + itemId"
      />
      <br />
      <ItemsListing
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
        :title="$t('other_versions')"
        :hide-on-empty="true"
        :checksum="provider + itemId"
      />

      <br />
      
      <!-- provider mapping details -->
      <v-card style="margin-bottom: 10px" v-if="provider == 'library'">
        <v-toolbar color="transparent" :title="$t('mapped_providers')" style="height: 55px"> </v-toolbar>
        <v-divider />
        <Container>
          <v-list>
            <ListItem
              v-for="providerMapping in itemDetails?.provider_mappings"
            >
              <template #prepend>
                <ProviderIcon :domain="providerMapping.provider_domain" :size="30" />
              </template>
              <template #title>
                {{ api.providerManifests[providerMapping.provider_domain].name }}
              </template>
              <template #subtitle>
                {{ providerMapping.item_id }} | 
                {{ providerMapping.audio_format.content_type }} |
                {{ providerMapping.audio_format.sample_rate / 1000 }}kHz/{{
                  providerMapping.audio_format.bit_depth
                }}
                bits
              </template>
              <template #append>
                <audio
                  name="preview"
                  title="preview"
                  controls
                  :src="getPreviewUrl(providerMapping.provider_domain, providerMapping.item_id)"
                />
                <v-btn
                  variant="plain"
                  icon="mdi-open-in-new"
                  v-if="providerMapping.url"
                  @click.prevent="
                    openLinkInNewTab(providerMapping.url)"
                ></v-btn>
              </template>
            </ListItem>
          </v-list>
        </Container>
      </v-card>
    </Container>
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
import Container from '../components/mods/Container.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { getStreamingProviderMappings } from '../utils';

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
  const allVersions: Track[] = [];

  if (props.provider == 'library') {
    const trackVersions = await api.getTrackVersions(props.itemId, props.provider);
    allVersions.push(...trackVersions);
  }
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    const trackVersions = await api.getTrackVersions(providerMapping.item_id, providerMapping.provider_instance);
    allVersions.push(...trackVersions);
  }

  return filteredItems(allVersions, offset, limit, sort, search, favoritesOnly);
};

const loadTrackAlbums = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const allAlbums: Album[] = [];
  if (props.provider == 'library') {
    const trackAlbums = await api.getTrackAlbums(props.itemId, props.provider);
    allAlbums.push(...trackAlbums);
  }
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    const trackAlbums = await api.getTrackAlbums(providerMapping.item_id, providerMapping.provider_instance);
    allAlbums.push(...trackAlbums);
  }
  return filteredItems(allAlbums, offset, limit, sort, search, favoritesOnly);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
const getPreviewUrl = function (provider: string, item_id: string) {
  return `${api.baseUrl}/preview?provider=${provider}&item_id=${encodeURIComponent(item_id)}`;
};
</script>
