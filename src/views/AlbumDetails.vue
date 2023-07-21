<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <Container>
      <ItemsListing
        itemtype="albumtracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :load-data="loadAlbumTracks"
        :sort-keys="['track_number', 'sort_name', 'duration']"
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
        itemtype="albumversions"
        :parent-item="itemDetails"
        :show-provider="true"
        :show-favorites-only-filter="false"
        :load-data="loadAlbumVersions"
        :sort-keys="['provider', 'sort_name', 'year']"
        :update-available="updateAvailable"
        :title="$t('other_versions')"
        :hide-on-empty="true"
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
                  name: 'album',
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
                {{ providerMapping.item_id }} | {{ providerMapping.audio_format.content_type }} |
                {{ providerMapping.audio_format.sample_rate / 1000 }}kHz/{{ providerMapping.audio_format.bit_depth }}
                bits
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
import ItemsListing from '../components/ItemsListing.vue';
import { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { EventType, type Album, type EventMessage, type MediaItemType } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import ListItem from '../components/mods/ListItem.vue';
import Container from '../components/mods/Container.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { getStreamingProviderMappings } from '../utils';

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
  const allVersions: Album[] = [];

  if (props.provider == 'library') {
    const albumVersions = await api.getAlbumVersions(props.itemId, props.provider);
    allVersions.push(...albumVersions);
  }
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    const albumVersions = await api.getAlbumVersions(providerMapping.item_id, providerMapping.provider_instance);
    allVersions.push(...albumVersions);
  }
  return filteredItems(allVersions, offset, limit, sort, search, favoritesOnly);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
</script>

<style lang="scss"></style>
