<template>
  <v-hover v-slot="{ isHovering, props }">
    <v-card
      v-hold="onMenu"
      v-bind="props"
      :class="{ 'on-hover': isHovering }"
      :elevation="isHovering ? 3 : 0"
      @click="onClick"
      @click.right.prevent="onMenu"
    >
      <MediaItemThumb :item="item" :width="'100%'" :size="size" />
      <v-overlay
        :model-value="isHovering || !getBreakpointValue('mobile')"
        style="height: 40%; top: 60%; border-radius: 0"
        contained
        flat
        :scrim="
          $vuetify.theme.current.dark
            ? 'rgba(0,0,0,.95)'
            : 'rgba(255,255,255,.95)'
        "
      >
        <v-list-item
          variant="text"
          slim
          tile
          density="compact"
          class="panel-item-details"
        >
          <v-list-item-title>
            <span v-if="item.media_type == MediaType.FOLDER">
              <span>{{ getBrowseFolderName(item as BrowseFolder, $t) }}</span>
            </span>
            <span v-else>{{ item.name }}</span>
            <span v-if="'version' in item && item.version">
              - {{ item.version }}</span
            >
          </v-list-item-title>
          <v-list-item-subtitle
            v-if="'artists' in item && item.artists"
            class="line-clamp-1"
          >
            {{ getArtistsString(item.artists, 1) }}
          </v-list-item-subtitle>
          <v-list-item-subtitle
            v-else-if="'owner' in item && item.owner"
            class="line-clamp-1"
          >
            {{ item.owner }}
          </v-list-item-subtitle>
          <v-list-item-subtitle v-else class="line-clamp-1">
            {{ $t(item.media_type) }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-overlay>
    </v-card>
  </v-hover>
</template>

<script setup lang="ts">
import MediaItemThumb from './MediaItemThumb.vue';
import {
  BrowseFolder,
  type MediaItemType,
  MediaType,
} from '@/plugins/api/interfaces';
import { getArtistsString, getBrowseFolderName } from '@/helpers/utils';
import { getBreakpointValue } from '@/plugins/breakpoint';

// properties
export interface Props {
  item: MediaItemType;
  size?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  size: 200,
});

/* eslint-disable no-unused-vars */
const emit = defineEmits<{
  (e: 'menu', event: Event, item: MediaItemType): void;
  (e: 'click', event: Event, item: MediaItemType): void;
}>();

const onMenu = function (event: Event) {
  emit('menu', event, compProps.item);
};

const onClick = function (event: Event) {
  emit('click', event, compProps.item);
};
</script>

<style scoped>
.v-card {
  transition: opacity 0.4s ease-in-out;
  padding: 0px;
  margin-bottom: 10px;
}

.v-card:not(.on-hover) {
  opacity: 0.75;
}

.panel-item-details {
  padding: 5px !important;
  height: 40px;
}

.hiresicon {
  margin-left: 10px;
  margin-right: 10px;
}

.hiresiconinverted {
  margin-left: 10px;
  margin-right: 10px;
  filter: invert(100%);
}
</style>
