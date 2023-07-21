<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <Container>
      <ItemsListing
        itemtype="artisttracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :show-track-number="false"
        :load-data="loadArtistTracks"
        :sort-keys="['timestamp_added DESC', 'sort_name', 'sort_album']"
        :update-available="updateAvailable"
        :title="$t('tracks')"
        :checksum="provider + itemId"
        @refresh-clicked="
          loadItemDetails();
          updateAvailable = false;
        "
      />
      <br />
      <ItemsListing
        itemtype="artistalbums"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :load-data="loadArtistAlbums"
        :sort-keys="['timestamp_added DESC', 'sort_name', 'year']"
        :update-available="updateAvailable"
        :title="$t('albums')"
        :checksum="provider + itemId"
        @refresh-clicked="
          loadItemDetails();
          updateAvailable = false;
        "
      />

      <br />

      <!-- provider mapping details -->
      <v-card v-if="provider == 'library'" style="margin-bottom: 10px">
        <v-toolbar color="transparent" :title="$t('mapped_providers')" style="height: 55px" />
        <v-divider />
        <Container>
          <v-list>
            <ListItem
              v-for="providerMapping in itemDetails?.provider_mappings"
              :key="providerMapping.provider_instance"
              @click="
                $router.push({
                  name: 'artist',
                  params: {
                    itemId: providerMapping.item_id,
                    provider: providerMapping.provider_instance,
                  },
                })
              "
            >
              <template #prepend>
                <ProviderIcon :domain="providerMapping.provider_domain" :size="30" />
              </template>
              <template #title>
                {{ api.providerManifests[providerMapping.provider_domain].name }}
              </template>
              <template #subtitle>
                {{ providerMapping.item_id }}
              </template>
              <template #append>
                <v-btn
                  v-if="providerMapping.url"
                  variant="plain"
                  icon="mdi-open-in-new"
                  @click.prevent="openLinkInNewTab(providerMapping.url)"
                />
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
import { ref, watch, onBeforeUnmount, onMounted } from 'vue';
import { EventType, type Artist, type EventMessage, type MediaItemType } from '../plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { api } from '../plugins/api';
import ListItem from '../components/mods/ListItem.vue';
import Container from '../components/mods/Container.vue';

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
const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
</script>
