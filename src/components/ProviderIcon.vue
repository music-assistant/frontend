<template>
  <!-- eslint-disable vue/no-v-html -->
  <!-- eslint-disable vue/no-v-text-v-html-on-component -->
  <div :style="`width:${size}px;margin-left:10px;margin-right:10px`">
    <!-- icon for library-->
    <v-icon
      v-if="providerDomain == 'library'"
      :size="size"
      icon="mdi-bookshelf"
      :title="$t('item_in_library')"
    />
    <!-- dark mode and dark svg icon-->
    <div
      v-else-if="
        $vuetify.theme.current.dark &&
        api.providerManifests[providerDomain].icon_svg_dark
      "
      :style="`width: ${size}px`"
      :title="api.providerManifests[providerDomain]!.name"
      v-html="api.providerManifests[providerDomain]!.icon_svg_dark"
    ></div>
    <!-- regular svg icon -->
    <div
      v-else-if="api.providerManifests[providerDomain].icon_svg"
      :style="`width: ${size}px;height: ${size}px`"
      :title="api.providerManifests[providerDomain]!.name"
      v-html="api.providerManifests[providerDomain]!.icon_svg"
    ></div>
    <!-- material design icon -->
    <v-icon
      v-else-if="api.providerManifests[providerDomain].icon"
      :size="size"
      :icon="'mdi-' + api.providerManifests[providerDomain]!.icon"
      :title="api.providerManifests[providerDomain]!.name"
      :dark="$vuetify.theme.current.dark"
    />
    <!-- fallback icon -->
    <v-icon
      v-else
      :size="size"
      :dark="$vuetify.theme.current.dark"
      icon="mdi-playlist-play"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/plugins/api';

export interface Props {
  domain: string;
  size: number;
  dark?: boolean;
}
const props = defineProps<Props>();

const providerDomain = computed(() => {
  // handle case where provider domain is provided as instance id.
  if (props.domain in api.providers) return api.providers[props.domain].domain;
  return props.domain;
});
</script>
