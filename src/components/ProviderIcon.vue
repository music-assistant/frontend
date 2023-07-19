<template>
  <div class="provider-icon" :style="`width:${size};`">
    <v-icon v-if="providerDomain == 'library'" :size="size" icon="mdi-bookshelf" :title="$t('library')" />
    <v-icon v-else-if="!providerDomain || !api.providerManifests[providerDomain]?.icon" :size="size" icon="mdi-playlist-play" />
    <v-icon
      v-else-if="
        api.providerManifests[providerDomain].icon!.startsWith('md:')
      "
      class="material-icons-outlined"
      :size="size"
      :icon="api.providerManifests[providerDomain]!.icon"
      :title="api.providerManifests[providerDomain]!.name"
    />
    <v-icon
      v-else-if="
        api.providerManifests[providerDomain].icon!.startsWith('mdi')
      "
      :size="size"
      :icon="api.providerManifests[providerDomain]!.icon"
      :title="api.providerManifests[providerDomain]!.name"
    />
    <v-img
      v-else
      dark
      :width="size"
      :src="api.providerManifests[providerDomain]!.icon"
      :title="api.providerManifests[providerDomain]!.name"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { api } from '../plugins/api';

export interface Props {
  domain: string;
  size: number | string;
}
const props = defineProps<Props>();

const providerDomain = computed(() => {
  // handle case where provider domain is provided as instance id.
  if (props.domain in api.providers) return api.providers[props.domain].domain
  return props.domain
});

</script>

<style scoped>
.provider-icon {
  float: inherit;
  padding-left: 5px;
  display: flex;
  margin-right: 15px;
  justify-content: center;
  padding: 0px;
  display: flex;
  flex-direction: column;
}
</style>
