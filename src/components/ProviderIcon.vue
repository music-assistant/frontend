<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    :style="`width:${size}px;margin-left:10px;margin-right:10px;content-align:center`"
  >
    <!-- icon for library-->
    <Library
      v-if="domain && domain == 'library'"
      :size="size"
      :title="$t('item_in_library')"
    />
    <!-- monochrome icon-->
    <div
      v-else-if="
        props.monochrome &&
        providerDomain &&
        api.providerManifests[providerDomain].icon_svg_monochrome
      "
      class="flex items-center justify-center"
      :style="`width: ${size}px;height: ${size}px;${isDark ? '' : 'filter: invert(1);'}`"
      :title="api.providerManifests[providerDomain]!.name"
    >
      <div
        class="svg-wrapper"
        v-html="api.providerManifests[providerDomain].icon_svg_monochrome"
      ></div>
    </div>
    <!-- dark mode and dark svg icon-->
    <div
      v-else-if="
        isDark &&
        providerDomain &&
        api.providerManifests[providerDomain].icon_svg_dark
      "
      class="flex items-center justify-center"
      :style="`width: ${size}px;height: ${size}px;`"
      :title="api.providerManifests[providerDomain]!.name"
    >
      <div
        class="svg-wrapper"
        v-html="api.providerManifests[providerDomain].icon_svg_dark"
      ></div>
    </div>
    <!-- regular svg icon -->
    <div
      v-else-if="
        providerDomain && api.providerManifests[providerDomain].icon_svg
      "
      class="flex items-center justify-center"
      :style="`width: ${size}px;height: ${size}px;`"
      :title="api.providerManifests[providerDomain]!.name"
    >
      <div
        class="svg-wrapper"
        v-html="api.providerManifests[providerDomain].icon_svg"
      ></div>
    </div>
    <!-- material design icon (fallback for providers that only specify an mdi name) -->
    <span
      v-else-if="providerDomain && api.providerManifests[providerDomain].icon"
      class="mdi"
      :class="api.providerManifests[providerDomain].icon"
      :style="`font-size: ${size}px; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;`"
      :title="api.providerManifests[providerDomain]!.name"
    />
    <!-- fallback icon -->
    <ListMusic v-else :size="size" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/plugins/api";
import { useIsDark } from "@/composables/useIsDark";
import { Library, ListMusic } from "lucide-vue-next";

export interface Props {
  domain: string;
  size: number;
  dark?: boolean;
  monochrome?: boolean;
}
const props = defineProps<Props>();

const { isDark } = useIsDark();

const providerDomain = computed(() => {
  // handle case where provider domain is provided as instance id.
  if (props.domain in api.providers) return api.providers[props.domain].domain;
  if (props.domain in api.providerManifests) return props.domain;
  return undefined;
});


</script>
<style>
.svg-wrapper svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
