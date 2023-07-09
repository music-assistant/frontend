<template>
  <div :style="`width:${size};justify-content: center;display:inherit;padding:0px;display:flex;flex-direction:column`">
    <v-icon v-if="!domain || !api.providerManifests[domain]?.icon" :size="size" icon="mdi-playlist-play" />
    <v-icon
      v-else-if="
        api.providerManifests[domain].icon!.startsWith('md:')
      "
      class="material-icons-outlined"
      :size="size"
      :icon="api.providerManifests[domain]!.icon"
    />
    <v-icon
      v-else-if="
        api.providerManifests[domain].icon!.startsWith('mdi')
      "
      :size="size"
      :icon="api.providerManifests[domain]!.icon"
    />
    <v-img v-else dark :width="size" :src="api.providerManifests[domain]!.icon" />
  </div>
</template>

<script setup lang="ts">
import { api } from '../plugins/api';

export interface Props {
  domain: string;
  size: number | string;
}
defineProps<Props>();
</script>
