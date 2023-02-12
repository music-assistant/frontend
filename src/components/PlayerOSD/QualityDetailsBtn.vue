<template>
  <!-- streaming quality details -->

  <div v-if="streamDetails" :style="`width: ${props.smallBtnIcon.button}px`">
    <v-menu :close-on-content-click="false" location="top end">
      <template #activator="{ props }">
        <v-btn
          v-if="streamDetails.bit_depth <= 16"
          icon
          v-bind="props"
          variant="plain"
        >
          <IconBase :name="getContentTypeIcon(streamDetails.content_type)" />
        </v-btn>
        <v-btn v-else icon v-bind="props" variant="plain">
          <IconBase name="hiResAudio" />
        </v-btn>
      </template>

      <v-card class="mx-auto" width="300">
        <v-list>
          <v-list-item :min-height="5" class="list-item">
            <v-list-item-title class="text-h5 mb-1">
              {{ $t('stream_details') }}
            </v-list-item-title>
          </v-list-item>
        </v-list>

        <v-divider></v-divider>

        <v-list>
          <v-list-item :min-height="40" :max-height="40" class="list-item">
            <template #prepend>
              <IconBase
                :height="'25px'"
                :width="'45px'"
                :name="getProviderIcon(streamDetails.provider)"
              />
            </template>
            <v-list-item-title class="text-subtitle-1">
              {{ $t('providers.' + streamDetails.provider) }}
            </v-list-item-title>
          </v-list-item>
          <v-list-item :min-height="40" :max-height="40" class="list-item">
            <template #prepend>
              <IconBase
                :height="'25px'"
                :width="'45px'"
                :name="getContentTypeIcon(streamDetails.content_type)"
              />
            </template>
            <v-list-item-title class="text-subtitle-1">
              {{ streamDetails.sample_rate / 1000 }} kHz /
              {{ streamDetails.bit_depth }} bits
            </v-list-item-title>
          </v-list-item>
          <v-list-item
            v-if="
              activePlayerQueue &&
              activePlayerQueue.settings.crossfade_duration > 0
            "
            :min-height="40"
            :max-height="40"
            class="list-item"
          >
            <template #prepend>
              <IconBase :height="'25px'" :width="'45px'" :name="'crossfade'" />
            </template>
            <v-list-item-title class="text-subtitle-1">
              {{ $t('crossfade_enabled') }}
            </v-list-item-title>
          </v-list-item>
          <v-list-item
            v-if="streamDetails.gain_correct"
            :min-height="40"
            :max-height="40"
            class="list-item"
          >
            <template #prepend>
              <IconBase :height="'25px'" :width="'45px'" :name="'level'" />
            </template>
            <v-list-item-title class="text-subtitle-1">
              {{ streamDetails.gain_correct }} dB
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import type { PlayerQueue } from '@/plugins/api';
import { computed } from 'vue';

import { getContentTypeIcon, getProviderIcon } from '../ProviderIcons.vue';
import IconBase from '../Icons/IconBase.vue';

// properties
export interface Props {
  activePlayerQueue?: PlayerQueue;
  smallBtnIcon: {
    button: number;
    icon: number;
  };
}

const props = withDefaults(defineProps<Props>(), {
  smallBtnIcon: () => ({ button: 40, icon: 22 }),
});

const streamDetails = computed(() => {
  return props.activePlayerQueue?.current_item?.streamdetails;
});
</script>

<style>
.list-item {
  padding: 0px 8px 0px 8px !important;
}
.list-item > div.v-list-item__prepend {
  padding-right: 10px;
}
</style>
