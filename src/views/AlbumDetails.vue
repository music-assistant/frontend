<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <Container>
      <ItemsListing
        v-if="itemDetails"
        itemtype="albumtracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :load-data="loadAlbumTracks"
        :sort-keys="['track_number', 'sort_name', 'duration']"
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
        itemtype="albumversions"
        :parent-item="itemDetails"
        :show-provider="true"
        :show-favorites-only-filter="false"
        :load-data="loadAlbumVersions"
        :sort-keys="['provider', 'sort_name', 'year']"
        :update-available="updateAvailable"
        :title="$t('other_versions')"
        :hide-on-empty="true"
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
                {{ providerMapping.audio_format.content_type }} |
                {{ providerMapping.audio_format.sample_rate / 1000 }}kHz/{{ providerMapping.audio_format.bit_depth }}
                bits |
                <a
                  v-if="providerMapping.url && !providerMapping.url.startsWith('file')"
                  style="opacity: 0.4"
                  :title="$t('tooltip.open_provider_link')"
                  @click.prevent="openLinkInNewTab(providerMapping.url)"
                  >{{ providerMapping.url }}</a
                >
                <span v-else style="opacity: 0.4">{{ providerMapping.item_id }}</span>
              </template>
            </ListItem>
          </v-list>
        </Container>
      </v-card>
    </Container>
  </section>
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import { filteredItems } from '../components/ItemsListing.vue';
import InfoHeader from '../components/InfoHeader.vue';
import { EventType, type Album, type EventMessage, type MediaItemType, Track } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
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

const providerFilter = computed(() => {
  if (itemDetails.value?.provider !== 'library') return [];
  const result: string[] = ['library'];
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    result.push(providerMapping.provider_instance);
  }
  return result;
});

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

const loadAlbumTracks = async function (params: LoadDataParams) {
  let items: Track[] = [];
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(itemDetails.value)) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getAlbumTracks(providerMapping.item_id, providerMapping.provider_instance);
        break;
      }
    }
  } else {
    items = await api.getAlbumTracks(itemDetails.value.item_id, itemDetails.value.provider);
  }
  return filteredItems(items, params);
};

const loadAlbumVersions = async function (params: LoadDataParams) {
  const allVersions: Album[] = [];

  if (props.provider == 'library') {
    const albumVersions = await api.getAlbumVersions(props.itemId, props.provider);
    allVersions.push(...albumVersions);
  }
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    const albumVersions = await api.getAlbumVersions(providerMapping.item_id, providerMapping.provider_instance);
    allVersions.push(...albumVersions);
  }
  return filteredItems(allVersions, params);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
</script>

<style lang="scss"></style>
