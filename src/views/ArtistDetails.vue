<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <Container>
      <ItemsListing
        v-if="itemDetails"
        itemtype="artisttracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :show-track-number="false"
        :load-data="loadArtistTracks"
        :sort-keys="['timestamp_added DESC', 'sort_name', 'sort_album']"
        :update-available="updateAvailable"
        :title="$t('tracks')"
        :provider-filter="providerFilter"
        @refresh-clicked="
          loadItemDetails();
          updateAvailable = false;
        "
      />
      <br />
      <ItemsListing
        v-if="itemDetails"
        itemtype="artistalbums"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :load-data="loadArtistAlbums"
        :sort-keys="['timestamp_added DESC', 'sort_name', 'year']"
        :update-available="updateAvailable"
        :title="$t('albums')"
        :provider-filter="providerFilter"
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
                  v-if="providerMapping.url && !providerMapping.url.startsWith('filesystem')"
                  variant="plain"
                  icon="mdi-open-in-new"
                  :title="$t('tooltip.open_provider_link')"
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
import ItemsListing, { LoadDataParams, filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { ref, watch, onBeforeUnmount, onMounted, computed } from 'vue';
import { EventType, type Artist, type EventMessage, type MediaItemType, Album, Track } from '../plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { api } from '../plugins/api';
import ListItem from '../components/mods/ListItem.vue';
import Container from '../components/mods/Container.vue';
import { getStreamingProviderMappings } from '@/utils';

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

const loadArtistAlbums = async function (params: LoadDataParams) {
  let items: Album[] = [];
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getArtistAlbums(providerMapping.item_id, providerMapping.provider_instance);
        break;
      }
    }
  } else {
    items = await api.getArtistAlbums(itemDetails.value.item_id, itemDetails.value.provider);
  }
  return filteredItems(items, params);
};

const loadArtistTracks = async function (params: LoadDataParams) {
  let items: Track[] = [];
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(itemDetails.value)) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getArtistTracks(providerMapping.item_id, providerMapping.provider_instance);
        break;
      }
    }
  } else {
    items = await api.getArtistTracks(itemDetails.value.item_id, itemDetails.value.provider);
  }
  return filteredItems(items, params);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
const providerFilter = computed(() => {
  if (itemDetails.value?.provider !== 'library') return [];
  const result: string[] = ['library'];
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    result.push(providerMapping.provider_instance);
  }
  return result;
});
</script>
