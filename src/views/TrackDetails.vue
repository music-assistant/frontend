<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />
    <Container>
      <ItemsListing v-if="itemDetails" itemtype="trackalbums" :parent-item="itemDetails" :show-provider="true"
        :show-favorites-only-filter="false" :show-library="true" :show-track-number="false" :load-data="loadTrackAlbums"
        :sort-keys="['provider', 'sort_name', 'duration']" :update-available="updateAvailable" :title="$t('appears_on')"
        :checksum="provider + itemId" @refresh-clicked="
          loadItemDetails();
        updateAvailable = false;
        " :provider-filter="providerFilter" />
      <br />
      <ItemsListing v-if="itemDetails" itemtype="trackversions" :parent-item="itemDetails" :show-provider="true"
        :show-favorites-only-filter="false" :show-library="true" :show-track-number="false" :load-data="loadTrackVersions"
        :sort-keys="['provider', 'sort_name', 'duration']" :update-available="updateAvailable"
        :title="$t('other_versions')" :hide-on-empty="true" :checksum="provider + itemId" @refresh-clicked="
          loadItemDetails();
        updateAvailable = false;
        " />

      <br />

      <!-- provider mapping details -->
      <v-card v-if="provider == 'library'" style="margin-bottom: 10px">
        <v-toolbar color="transparent" :title="$t('mapped_providers')" style="height: 55px" />
        <v-divider />
        <Container>
          <v-list>
            <ListItem v-for="providerMapping in itemDetails?.provider_mappings" :key="providerMapping.provider_instance">
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
                <a v-if="providerMapping.url && !providerMapping.url.startsWith('file')" style="opacity: 0.4"
                  :title="$t('tooltip.open_provider_link')" @click.prevent="openLinkInNewTab(providerMapping.url)">{{
                    providerMapping.url }}</a>
                <span v-else style="opacity: 0.4" :title="providerMapping.item_id">{{ providerMapping.item_id }}</span>
              </template>
              <template #append>
                <audio v-if="getBreakpointValue('bp1')" name="preview" title="preview" controls
                  :src="getPreviewUrl(providerMapping.provider_domain, providerMapping.item_id)"></audio>
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
import { computed, ref } from 'vue';
import { EventType, type Track, type EventMessage, type MediaItemType, Album } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import { onBeforeUnmount, onMounted, watch } from 'vue';
import ListItem from '../components/mods/ListItem.vue';
import Container from '../components/mods/Container.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { getStreamingProviderMappings } from '../utils';
import { getBreakpointValue } from '@/plugins/breakpoint';

export interface Props {
  itemId: string;
  provider: string;
  album?: string;
}
const props = defineProps<Props>();
const activeTab = ref('');
const updateAvailable = ref(false);
const itemDetails = ref<Track>();

const providerFilter = computed(() => {
  if (itemDetails.value?.provider !== 'library') return [];
  const result: string[] = ['library'];
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    result.push(providerMapping.provider_instance);
  }
  return result;
});

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
  params: LoadDataParams
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

  return filteredItems(allVersions, params);
};

const loadTrackAlbums = async function (params: LoadDataParams) {
  let items: Album[] = [];
  if (!itemDetails.value) {
    items = [];
  } else if (params.providerFilter && params.providerFilter != 'library') {
    for (const providerMapping of getStreamingProviderMappings(itemDetails.value)) {
      if (providerMapping.provider_instance == params.providerFilter) {
        items = await api.getTrackAlbums(providerMapping.item_id, providerMapping.provider_instance);
        break;
      }
    }
  } else {
    items = await api.getTrackAlbums(itemDetails.value.item_id, itemDetails.value.provider);
  }
  return filteredItems(items, params);
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
const getPreviewUrl = function (provider: string, item_id: string) {
  return `${api.baseUrl}/preview?provider=${provider}&item_id=${encodeURIComponent(item_id)}`;
};
</script>
