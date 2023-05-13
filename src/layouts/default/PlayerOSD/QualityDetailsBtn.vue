<template>
  <!-- streaming quality details -->
  <v-menu v-if="streamDetails" location="bottom end" :close-on-content-click="false">
    <template #activator="{ props }">
      <v-chip
        v-if="streamDetails"
        :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
        class="mediadetails-content-type-btn"
        label
        :ripple="false"
        v-bind="props"
      >
        <div class="d-flex justify-center" style="width: 100%">
          {{ streamDetails.content_type.toUpperCase() }}
        </div>
      </v-chip>
    </template>
    <v-card class="mx-auto" width="300">
      <v-list style="overflow: hidden">
        <ListItem :min-height="5" class="list-item">
          <v-list-item-title class="text-h5 mb-1">
            {{ $t('stream_details') }}
          </v-list-item-title>
        </ListItem>
        <v-divider />
        <div style="height: 50px; display: flex; align-items: center">
          <ProviderIcon
            :domain="streamDetails.provider"
            :size="'35px'"
            style="object-fit: contain; margin-left: 10px; margin-right: 5px"
          />
          {{ api.providerManifests[streamDetails.provider]?.name || api.providers[streamDetails.provider]?.name }}
        </div>

        <div style="height: 50px; display: flex; align-items: center">
          <img
            height="30"
            width="50"
            :src="getContentTypeIcon(streamDetails.content_type)"
            :style="$vuetify.theme.current.dark ? 'object-fit: contain;' : 'object-fit: contain;filter: invert(100%);'"
          />
          {{ streamDetails.sample_rate / 1000 }} kHz / {{ streamDetails.bit_depth }} bits
        </div>

        <div
          v-if="activePlayerQueue && activePlayerQueue.crossfade_enabled"
          style="height: 50px; display: flex; align-items: center"
        >
          <img
            height="30"
            width="50"
            contain
            src="@/assets/crossfade.png"
            :style="$vuetify.theme.current.dark ? 'object-fit: contain;' : 'object-fit: contain;filter: invert(100%);'"
          />
          {{ $t('crossfade_enabled') }}
        </div>

        <div v-if="streamDetails.gain_correct" style="height: 50px; display: flex; align-items: center">
          <img
            height="30"
            width="50"
            contain
            src="@/assets/level.png"
            :style="$vuetify.theme.current.dark ? 'object-fit: contain;' : 'object-fit: contain;filter: invert(100%);'"
          />
          {{ streamDetails.gain_correct }} dB
        </div>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getContentTypeIcon, iconHiRes } from '@/components/ProviderIcons.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import ListItem from '@/components/ListItem.vue';

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
const streamDetails = computed(() => {
  return activePlayerQueue.value?.current_item?.streamdetails;
});
</script>

<style>
.list-item {
  padding: 0px 8px 0px 8px !important;
}

.list-item > div.ListItem__prepend {
  padding-right: 10px;
}
.mediadetails-streamdetails {
  width: 30px;
  height: 14px;
  border-radius: 2px;
  font-size: x-small;
  font-weight: 800;
  min-width: 55px;
  padding: 0;
  box-shadow: none;
}
.mediadetails-content-type-btn {
  height: 25px !important;
  width: 50px !important;
  padding: 5px !important;
  font-weight: 500;
  font-size: 10px !important;
  letter-spacing: 0.1em;
  border-radius: 2px;
  margin-left: 16px;
}
</style>
