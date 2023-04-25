<template>
  <v-card
    class="panel-item"
    @click="showCheckboxes ? null : emit('click', item)"
    @click.right.prevent="showCheckboxes ? null : emit('menu', item)"
  >
    <v-overlay
      v-if="showCheckboxes"
      :model-value="showCheckboxes"
      contained
      :scrim="isSelected ? ($vuetify.theme.current.dark ? 'rgba(0,0,0,.75)' : 'rgba(255,255,255,.75)') : '#ffffff00'"
      @click="
        (x: boolean) => {
          emit('select', item, isSelected ? false : true);
        }
      "
    >
      <v-checkbox class="panel-item-checkbox" :ripple="false" :model-value="isSelected" />
    </v-overlay>

    <MediaItemThumb :item="item" :width="'100%'" />

    <v-list-item style="padding-left: 0px; padding-right: 0px; padding-top: 10px; padding-bottom: 0px">
      <v-list-item-title class="line-clamp-1">
        {{ item.name }} {{ 'version' in item && item.version ? `- ${item.version}` : '' }}
      </v-list-item-title>
      <v-list-item-subtitle v-if="'artists' in item && item.artists" class="line-clamp-1">
        {{ getArtistsString(item.artists, 1) }}
      </v-list-item-subtitle>
      <v-list-item-subtitle v-else-if="'owner' in item && item.owner" class="line-clamp-1">
        {{ item.owner }}
      </v-list-item-subtitle>

      <v-item-group v-if="item && item.media_type === 'track'" style="min-height: 22px; padding-top: 5px">
        <v-item>
          <v-icon v-if="parseBool(item.metadata.explicit || false)" icon="mdi-alpha-e-box" />
        </v-item>
        <v-item>
          <v-tooltip v-if="HiResDetails" bottom>
            <!-- eslint-disable vue/no-template-shadow -->
            <template #activator="{ props }">
              <!-- eslint-enable vue/no-template-shadow -->
              <v-icon v-bind="props" icon="mdi-quality-high" />
            </template>
            <span>{{ HiResDetails }}</span>
          </v-tooltip>
        </v-item>

        <v-item v-if="'disc_number' in item && item.disc_number && showTrackNumber">
          <v-icon style="margin-left: 5px" icon="md:album" /> {{ item.disc_number }}
        </v-item>
        <v-item v-if="'track_number' in item && item.track_number && showTrackNumber">
          <v-icon style="margin-left: 5px" icon="mdi-music-circle-outline" /> {{ item.track_number }}
        </v-item>
      </v-item-group>
    </v-list-item>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MediaItemThumb from './MediaItemThumb.vue';

import { ContentType, type MediaItem, type MediaItemType } from '../plugins/api/interfaces';
import { getArtistsString, parseBool } from '../utils';

// properties
export interface Props {
  item: MediaItemType;
  size?: number;
  isSelected: boolean;
  showCheckboxes: boolean;
  showTrackNumber: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  size: 200,
  showCheckboxes: false,
  showTrackNumber: true,
});

// computed properties
const HiResDetails = computed(() => {
  for (const prov of props.item.provider_mappings) {
    if (prov.content_type == undefined) continue;
    if (!(prov.content_type in [ContentType.DSF, ContentType.FLAC, ContentType.AIFF, ContentType.WAV])) continue;
    if (prov.sample_rate > 48000 || prov.bit_depth > 16) {
      return `${prov.sample_rate}kHz ${prov.bit_depth} bits`;
    }
  }
  return '';
});

// emits

/* eslint-disable no-unused-vars */
const emit = defineEmits<{
  (e: 'menu', value: MediaItem): void;
  (e: 'click', value: MediaItem): void;
  (e: 'select', value: MediaItem, selected: boolean): void;
}>();
</script>

<style>
.panel-item {
  height: 100%;
  padding: 10px;
}

.panel-item-checkbox {
  position: absolute;
  left: 0px;
  top: 0px;
}
</style>
