<template>
  <section style="margin-bottom: 10px">
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
            <span v-if="itemDetails.media_type == MediaType.TRACK"
              >{{ providerMapping.audio_format.content_type }} |
              {{ providerMapping.audio_format.sample_rate / 1000 }}kHz/{{ providerMapping.audio_format.bit_depth }}
              bits |
            </span>
            <a
              v-if="providerMapping.url && !providerMapping.url.startsWith('file')"
              style="opacity: 0.4"
              :title="$t('tooltip.open_provider_link')"
              @click.prevent="openLinkInNewTab(providerMapping.url)"
              >{{ providerMapping.url }}</a
            >
            <span v-else style="opacity: 0.4" :title="providerMapping.item_id">{{ providerMapping.item_id }}</span>
          </template>
          <template #append>
            <!-- hi res icon -->
            <v-img
              v-if="providerMapping.audio_format.bit_depth > 16"
              :src="iconHiRes"
              width="30"
              :class="$vuetify.theme.current.dark ? 'hiresicondark' : 'hiresicon'"
              style="margin-right: 15px"
            />
            <audio
              v-if="getBreakpointValue('bp1') && itemDetails.media_type == MediaType.TRACK"
              name="preview"
              title="preview"
              controls
              :src="getPreviewUrl(providerMapping.provider_domain, providerMapping.item_id)"
            ></audio>
          </template>
        </ListItem>
      </v-list>
    </Container>
  </section>
</template>

<script setup lang="ts">
import { iconHiRes } from '@/components/QualityDetailsBtn.vue';
import { MediaType, type MediaItemType } from '../plugins/api/interfaces';
import { api } from '../plugins/api';
import ListItem from '../components/mods/ListItem.vue';
import Container from '../components/mods/Container.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';

export interface Props {
  itemDetails: MediaItemType;
}
defineProps<Props>();

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};
const getPreviewUrl = function (provider: string, item_id: string) {
  return `${api.baseUrl}/preview?provider=${provider}&item_id=${encodeURIComponent(item_id)}`;
};
</script>
