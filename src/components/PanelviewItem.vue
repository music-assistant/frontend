<template>
  <v-card
    outlined
    style="height: 100%"
    @click="emit('click', item)"
    @click.right.prevent="emit('menu', item)"
  >
    <MediaItemThumb
      :item="item"
      :width="'100%'"
    />
    <div
      v-if="showCheckboxes"
      style="
        position: absolute;
        top: 0;
        background-color: #82b1ff94;
        height: 50px;
      "
    >
      <v-checkbox
        :model-value="isSelected"
        @click.stop
        @update:model-value="
          (x: boolean) => {
            emit('select', item, x);
          }
        "
      />
    </div>
    <div
      v-if="HiResDetails"
      class="hiresicon"
      :style="
        $vuetify.theme.current.dark
          ? 'background-color: black'
          : 'background-color:white'
      "
    >
      <v-tooltip bottom>
        <!-- eslint-disable vue/no-template-shadow -->
        <template #activator="{ props }">
          <!-- eslint-enable vue/no-template-shadow -->
          <img
            :src="iconHiRes"
            height="35"
            v-bind="props"
            :style="
              $vuetify.theme.current.dark
                ? 'object-fit: contain;'
                : 'object-fit: contain;filter: invert(100%);'
            "
          >
        </template>
        <span>{{ HiResDetails }}</span>
      </v-tooltip>
    </div>
    <v-icon
      v-if="parseBool(item.metadata.explicit || false)"
      icon="mdi-alpha-e-box"
      size="30"
      style="position: absolute; right: 2px; top: 2px; height: 30px; width:30px;background-color: black;"
    />

    <v-list-item
      two-line
      style="padding-left: 8px; padding-right: 8px"
    >
      <div>
        <p
          class="font-weight-bold line-clamp-1"
          style="color: primary; margin-top: 8px; margin-bottom: 8px"
        >
          {{ item.name }}
        </p>
      </div>
      <v-list-item-subtitle
        v-if="'artists' in item && item.artists"
        class="line-clamp-2"
        style="margin-bottom: 8px"
      >
        {{ getArtistsString(item.artists) }}
      </v-list-item-subtitle>
      <v-list-item-subtitle
        v-else-if="'owner' in item && item.owner"
        class="line-clamp-2"
        style="margin-bottom: 8px"
      >
        {{ item.owner }}
      </v-list-item-subtitle>
      <span
        v-if="'version' in item && item.version"
        style="margin-bottom: 8px;font-size: x-small;"
      >
        {{ item.version }}
      </span>
    </v-list-item>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaItemThumb from "./MediaItemThumb.vue";

import { iconHiRes } from "./ProviderIcons.vue";

import {
  ContentType,
  type MediaItem,
  type MediaItemType,
} from "../plugins/api/interfaces";
import { getArtistsString, parseBool } from "../utils";

// properties
export interface Props {
  item: MediaItemType;
  size?: number;
  isSelected: boolean;
  showCheckboxes: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  size: 200,
  showCheckboxes: false,
});

// computed properties
const HiResDetails = computed(() => {
  for (const prov of props.item.provider_mappings) {
    if (prov.content_type == undefined) continue;
    if (
      !(
        prov.content_type in
        [ContentType.DSF, ContentType.FLAC, ContentType.AIFF, ContentType.WAV]
      )
    )
      continue;
    if (prov.sample_rate > 48000 || prov.bit_depth > 16) {
      return `${prov.sample_rate}kHz ${prov.bit_depth} bits`;
    }
  }
  return "";
});

// emits

/* eslint-disable no-unused-vars */
const emit = defineEmits<{
  (e: "menu", value: MediaItem): void;
  (e: "click", value: MediaItem): void;
  (e: "select", value: MediaItem, selected: boolean): void;
}>();
</script>
