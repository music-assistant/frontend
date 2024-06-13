<template>
  <section style="margin-bottom: 10px">
    <Toolbar :title="$t('mapped_providers')" />
    <v-divider />
    <Container>
      <v-list>
        <ListItem
          v-for="providerMapping in itemDetails?.provider_mappings"
          :key="providerMapping.provider_instance"
        >
          <template #prepend>
            <ProviderIcon
              :domain="providerMapping.provider_domain"
              :size="30"
            />
          </template>
          <template #title>
            {{ api.providerManifests[providerMapping.provider_domain]?.name }}
          </template>
          <template #subtitle>
            <span
              v-if="
                itemDetails.media_type == MediaType.TRACK &&
                providerMapping.audio_format
              "
              >{{ providerMapping.audio_format.content_type }} |
              {{ providerMapping.audio_format.sample_rate / 1000 }}kHz/{{
                providerMapping.audio_format.bit_depth
              }}
              bits |
            </span>
            <a
              v-if="
                providerMapping.url &&
                !providerMapping.provider_domain.startsWith('file')
              "
              style="opacity: 0.4"
              :title="$t('tooltip.open_provider_link')"
              @click.prevent="openLinkInNewTab(providerMapping.url)"
              >{{ providerMapping.url }}</a
            >
            <span
              v-else
              style="opacity: 0.4"
              :title="providerMapping.item_id"
              >{{ providerMapping.item_id }}</span
            >
          </template>
          <template #append>
            <!-- hi res icon -->
            <v-img
              v-if="
                providerMapping.audio_format &&
                providerMapping.audio_format.bit_depth > 16
              "
              :src="iconHiRes"
              width="30"
              :class="
                $vuetify.theme.current.dark ? 'hiresicondark' : 'hiresicon'
              "
              style="margin-right: 15px"
            />
            <!-- play sample button -->
            <v-btn
              v-if="
                getBreakpointValue('bp1') &&
                itemDetails.media_type == MediaType.TRACK
              "
              :icon="
                demoPlayer[
                  `${providerMapping.provider_instance}.${providerMapping.item_id}`
                ]
                  ? 'mdi-pause'
                  : 'mdi-play-circle'
              "
              :title="$t('tooltip.play_sample')"
              @click="playBtnClick(providerMapping)"
            />
          </template>
        </ListItem>
      </v-list>
    </Container>
  </section>
</template>

<script setup lang="ts">
import { iconHiRes } from '@/components/QualityDetailsBtn.vue';
import {
  MediaType,
  ProviderMapping,
  type MediaItemType,
} from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import ListItem from '@/components/mods/ListItem.vue';
import Container from '@/components/mods/Container.vue';
import Toolbar from '@/components/Toolbar.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import { reactive } from 'vue';

export interface Props {
  itemDetails: MediaItemType;
}
defineProps<Props>();

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};

const demoPlayer = reactive<{ [item_id: string]: HTMLAudioElement }>({});

const playBtnClick = function (providerMapping: ProviderMapping) {
  const key = `${providerMapping.provider_instance}.${providerMapping.item_id}`;
  const existing = demoPlayer[key];
  if (existing) {
    existing.load();
    delete demoPlayer[key];
  } else {
    const audio = new Audio(
      getPreviewUrl(providerMapping.provider_instance, providerMapping.item_id),
    );
    demoPlayer[key] = audio;
    audio.play();
  }
};
const getPreviewUrl = function (provider: string, item_id: string) {
  return `${
    api.baseUrl
  }/preview?item_id=${encodeURIComponent(item_id)}&provider=${provider}`;
};
</script>
