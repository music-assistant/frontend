<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <Container>
    <ItemsListing
      itemtype="radioversions"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-library="false"
      :show-radio-number="false"
      :show-duration="false"
      :load-data="loadRadioVersions"
      :sort-keys="['provider', 'sort_name']"
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
              :key="providerMapping.provider_instance"
            >
              <template #prepend>
                <ProviderIcon :domain="providerMapping.provider_domain" :size="30" />
              </template>
              <template #title>
                {{ api.providerManifests[providerMapping.provider_domain].name }}
              </template>
              <template #subtitle>
                {{ providerMapping.item_id }} | 
                {{ providerMapping.audio_format.content_type }}
                bits
              </template>
              <template #append>
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
import type { Radio } from '../plugins/api/interfaces';
import ListItem from '../components/mods/ListItem.vue';
import Container from '../components/mods/Container.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { api } from '../plugins/api';
import { watch } from 'vue';
import { getStreamingProviderMappings } from '../utils';

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Radio>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getRadio(props.itemId, props.provider);
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

const loadRadioVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  favoritesOnly = true,
) {
  const allVersions: Radio[] = [];

  if (props.provider == 'library') {
    const radioVersions = await api.getRadioVersions(props.itemId, props.provider);
    allVersions.push(...radioVersions);
  }
  for (const providerMapping of getStreamingProviderMappings(itemDetails.value!)) {
    const radioVersions = await api.getRadioVersions(providerMapping.item_id, providerMapping.provider_instance);
    allVersions.push(...radioVersions);
  }

  return filteredItems(allVersions, offset, limit, sort, search, favoritesOnly);
};
const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
</script>
