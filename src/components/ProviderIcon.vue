<template>
  <div :style="`width:${size};justify-content: center;display:inherit;padding:0px;display:flex;flex-direction:column`">
    <v-icon v-if="manifest.icon == undefined" :size="size" icon="mdi-playlist-play" />
    <v-icon
      v-else-if="
        manifest.icon!.startsWith('md:')
      "
      class="material-icons-outlined"
      :size="size"
      :icon="manifest.icon"
    />
    <v-icon
      v-else-if="
        manifest.icon!.startsWith('mdi')
      "
      :size="size"
      :icon="manifest.icon"
    />
    <v-img v-else dark :width="size" :src="manifest.icon" />
  </div>
</template>

<script setup lang="ts">
import { ProviderManifest } from '@/plugins/api/interfaces';
import { api } from '../plugins/api';
import { computed } from 'vue';

export interface Props {
  domain?: string;
  manifest?: ProviderManifest;
  size: number | string;
}
const props = defineProps<Props>();

const manifest = computed(() => {
  if (props.manifest){
    return props.manifest;
  }
  return api.providerManifests[props.domain!];
});

</script>
