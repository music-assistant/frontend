<template>
  <div
    :style="`width:${size}px;margin-left:10px;margin-right:10px;content-align:center`"
  >
    <!-- provider image (svg or png) served as data uri; blank when no variant exists -->
    <div
      v-if="iconDataUri"
      class="d-flex align-center justify-center align-content-center justify-content-center"
      :style="`width: ${size}px;height: ${size}px;${applyInvert ? 'filter: invert(1);' : ''}`"
      :title="providerName"
    >
      <img class="provider-img" :src="iconDataUri" :alt="providerName" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useTheme } from "vuetify";
import { api } from "@/plugins/api";
import { ProviderIconVariant } from "@/plugins/api/interfaces";

export interface Props {
  domain: string;
  size: number;
  dark?: boolean;
  monochrome?: boolean;
}
const props = defineProps<Props>();
const theme = useTheme();

const providerDomain = computed(() => {
  // handle case where provider domain is provided as instance id.
  if (props.domain in api.providers) return api.providers[props.domain].domain;
  if (props.domain in api.providerManifests) return props.domain;
  return undefined;
});

const manifest = computed(() =>
  providerDomain.value
    ? api.providerManifests[providerDomain.value]
    : undefined,
);
const providerName = computed(() => manifest.value?.name ?? "");

// pick the best available variant for the current theme + monochrome request
const variant = computed<ProviderIconVariant | undefined>(() => {
  const available = manifest.value?.icon_images ?? [];
  if (
    props.monochrome &&
    available.includes(ProviderIconVariant.MONOCHROME)
  )
    return ProviderIconVariant.MONOCHROME;
  if (
    theme.current.value.dark &&
    available.includes(ProviderIconVariant.DARK)
  )
    return ProviderIconVariant.DARK;
  if (available.includes(ProviderIconVariant.DEFAULT))
    return ProviderIconVariant.DEFAULT;
  return undefined;
});

// invert a monochrome icon in light mode (matches previous behaviour)
const applyInvert = computed(
  () =>
    variant.value === ProviderIconVariant.MONOCHROME &&
    !theme.current.value.dark,
);

const iconDataUri = ref<string | null>(null);
watchEffect(async () => {
  const dom = providerDomain.value;
  const v = variant.value;
  if (!dom || !v) {
    iconDataUri.value = null;
    return;
  }
  iconDataUri.value = await api.getProviderIcon(dom, v);
});
</script>

<style>
.provider-img {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
