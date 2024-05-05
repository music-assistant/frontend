<template>
  <v-card
    v-hold="onMenu"
    class="panel-item"
    :disabled="!itemIsAvailable(item)"
    @click="onClick"
    @click.right.prevent="onMenu"
    @mouseover="showSettingDots = true"
    @mouseleave="showSettingDots = true"
  >
    <v-overlay
      v-if="showCheckboxes"
      :model-value="showCheckboxes"
      contained
      :scrim="
        isSelected
          ? $vuetify.theme.current.dark
            ? 'rgba(0,0,0,.75)'
            : 'rgba(255,255,255,.75)'
          : '#ffffff00'
      "
      @click="
        (x: boolean) => {
          emit('select', item, isSelected ? false : true);
        }
      "
    >
      <v-checkbox
        class="panel-item-checkbox"
        :ripple="false"
        :model-value="isSelected"
      />
    </v-overlay>

    <MediaItemThumb :item="item" :width="'100%'" />

    <div class="panel-item-details" style="padding-top: 10px !important">
      <v-list-item-title class="line-clamp-1 panel-item-details">
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
        class="line-clamp-1 panel-item-details"
      >
        {{ getArtistsString(item.artists, 1) }}
      </v-list-item-subtitle>
      <v-list-item-subtitle
        v-else-if="'owner' in item && item.owner"
        class="line-clamp-1 panel-item-details"
      >
        {{ item.owner }}
      </v-list-item-subtitle>
      <v-list-item-subtitle
        v-else-if="showMediaType"
        class="line-clamp-1 panel-item-details"
      >
        {{ $t(item.media_type) }}
      </v-list-item-subtitle>
    </div>
    <v-card-actions>
      <v-item-group
        v-if="
          (item.media_type === 'track' && 'metadata' in item) || showFavorite
        "
        style="min-height: 33px; margin-top: 10px; margin-left: -15px"
      >
        <!-- explicit icon -->
        <v-item v-if="parseBool(item.metadata.explicit || false)">
          <v-icon size="30" icon="mdi-alpha-e-box" />
        </v-item>
        <!-- hi res icon -->
        <v-item v-if="HiResDetails">
          <v-icon
            :class="
              $vuetify.theme.current.dark ? 'hiresicon' : 'hiresiconinverted'
            "
          >
            <img :src="iconHiRes" width="30" />
            <v-tooltip activator="parent" location="bottom">
              {{ HiResDetails }}
            </v-tooltip>
          </v-icon>
        </v-item>
        <!-- disc number -->
        <v-item
          v-if="'disc_number' in item && item.disc_number && showTrackNumber"
        >
          <v-icon icon="md:album" style="margin-left: 5px" />
          {{ item.disc_number }}
        </v-item>
        <!-- track number-->
        <v-item
          v-if="'track_number' in item && item.track_number && showTrackNumber"
        >
          <v-icon icon="mdi-music-circle-outline" style="margin-left: 10px" />
          {{ item.track_number }}
        </v-item>
        <v-item v-if="getBreakpointValue('bp3') && showFavorite">
          <FavouriteButton :item="item" />
        </v-item>
      </v-item-group>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MediaItemThumb from './MediaItemThumb.vue';
import {
  BrowseFolder,
  ContentType,
  type MediaItem,
  type MediaItemType,
  MediaType,
} from '@/plugins/api/interfaces';
import {
  getArtistsString,
  getBrowseFolderName,
  parseBool,
} from '@/helpers/utils';
import { itemIsAvailable } from '@/plugins/api/helpers';
import { iconHiRes } from './QualityDetailsBtn.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import FavouriteButton from '@/components/FavoriteButton.vue';

// properties
export interface Props {
  item: MediaItemType;
  size?: number;
  isSelected: boolean;
  showCheckboxes?: boolean;
  showTrackNumber?: boolean;
  showMediaType?: boolean;
  showFavorite?: boolean;
  parentItem?: MediaItemType;
}
const props = withDefaults(defineProps<Props>(), {
  size: 200,
  showCheckboxes: false,
  showFavorite: false,
  showTrackNumber: true,
  showMediaType: false,
  parentItem: undefined,
});

// refs

const showSettingDots = ref(false);

// computed properties
const HiResDetails = computed(() => {
  for (const prov of props.item.provider_mappings) {
    if (!prov.audio_format) continue;
    if (prov.audio_format.content_type == undefined) continue;
    if (
      ![
        ContentType.DSF,
        ContentType.FLAC,
        ContentType.AIFF,
        ContentType.WAV,
      ].includes(prov.audio_format.content_type)
    )
      continue;
    if (
      prov.audio_format.sample_rate > 48000 ||
      prov.audio_format.bit_depth > 16
    ) {
      return `${prov.audio_format.sample_rate / 1000}kHz ${
        prov.audio_format.bit_depth
      } bits`;
    }
  }
  return '';
});

// emits

/* eslint-disable no-unused-vars */
const emit = defineEmits<{
  (e: 'menu', event: Event, item: MediaItemType): void;
  (e: 'click', event: Event, item: MediaItemType): void;
  (e: 'select', item: MediaItem, selected: boolean): void;
}>();

const onMenu = function (event: Event) {
  if (props.showCheckboxes) return;
  emit('menu', event, props.item);
};

const onClick = function (event: Event) {
  if (props.showCheckboxes) return;
  emit('click', event, props.item);
};
</script>

<style scoped>
.panel-item {
  height: 100%;
  padding: 10px;
  border: none;
  border-style: none !important;
}

.panel-item-checkbox {
  position: absolute;
  left: 0px;
  top: 0px;
}

.panel-item-details {
  padding-left: 0px !important;
  padding-right: 0px !important;
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
