<template>
  <div class="provider-icon-wrapper" :style="{ width: `${size}px` }">
    <!-- the library is not a real provider, so render its membership badge directly -->
    <div
      v-if="domain === 'library'"
      class="d-flex align-center justify-center"
      :style="`width: ${size}px;height: ${size}px;`"
      :title="$t('in_library')"
    >
      <LibraryBig :size="size" />
    </div>
    <!-- provider image (svg or png) served as data uri; blank when no variant exists -->
    <div
      v-else-if="iconDataUri"
      class="d-flex align-center justify-center align-content-center justify-content-center"
      :style="`width: ${size}px;height: ${size}px;${applyInvert ? 'filter: invert(1);' : ''}`"
      :title="providerName"
    >
      <img class="provider-img" :src="iconDataUri" :alt="providerName" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { LibraryBig } from "@lucide/vue";
import { useProviderIcon } from "@/composables/useProviderIcon";

export interface Props {
  domain: string;
  size: number;
  monochrome?: boolean;
}
const props = defineProps<Props>();

const { iconDataUri, applyInvert, providerName } = useProviderIcon(
  () => props.domain,
  { monochrome: () => props.monochrome },
);
</script>

<style>
.provider-img {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
