<template>
  <!-- eslint-disable vue/no-v-html -->
  <!-- eslint-disable vue/no-v-text-v-html-on-component -->
  <div
    :style="`width:${size}px;margin-left:10px;margin-right:10px;content-align:center`"
  >
    <!-- icon for library-->
    <v-icon
      v-if="domain && domain == 'library'"
      :size="size"
      icon="mdi-bookshelf"
      :title="$t('item_in_library')"
    />
    <!-- monochrome icon-->
    <div
      v-else-if="
        props.monochrome &&
        providerDomain &&
        api.providerManifests[providerDomain].icon_svg_monochrome
      "
      class="d-flex align-center justify-center"
      :style="`width: ${size}px;height: ${size}px;align-content: center;${$vuetify.theme.current.dark ? '' : 'filter: invert(1);'}`"
      :title="api.providerManifests[providerDomain]!.name"
      v-html="api.providerManifests[providerDomain]!.icon_svg_monochrome"
    ></div>
    <!-- dark mode and dark svg icon-->
    <div
      v-else-if="
        $vuetify.theme.current.dark &&
        providerDomain &&
        api.providerManifests[providerDomain].icon_svg_dark
      "
      class="d-flex align-center justify-center"
      :style="`width: ${size}px;height: ${size}px;align-content: center;`"
      :title="api.providerManifests[providerDomain]!.name"
      v-html="api.providerManifests[providerDomain]!.icon_svg_dark"
    ></div>
    <!-- regular svg icon -->
    <div
      v-else-if="
        providerDomain && api.providerManifests[providerDomain].icon_svg
      "
      class="d-flex align-center justify-center"
      :style="`width: ${size}px;height: ${size}px;align-content: center;`"
      :title="api.providerManifests[providerDomain]!.name"
      v-html="api.providerManifests[providerDomain]!.icon_svg"
    ></div>
    <!-- material design icon -->
    <v-icon
      v-else-if="providerDomain && api.providerManifests[providerDomain].icon"
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
import { computed } from "vue";
import { api } from "@/plugins/api";

export interface Props {
  domain: string;
  size: number;
  dark?: boolean;
  monochrome?: boolean;
}
const props = defineProps<Props>();

const providerDomain = computed(() => {
  // handle case where provider domain is provided as instance id.
  if (props.domain in api.providers) return api.providers[props.domain].domain;
  if (props.domain in api.providerManifests) return props.domain;
  return undefined;
});
</script>
