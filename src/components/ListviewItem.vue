<!-- eslint-disable vue/no-template-shadow -->
<template>
  <div>
    <ListItem
      v-hold="() => emit('menu', item)"
      link
      :disabled="!itemIsAvailable(item) || isDisabled"
      @click.stop="emit('click', item)"
      @click.right.prevent="emit('menu', item)"
      :context-menu-items="showMenu ? getContextMenuItems([item]): []"
    >
      <template #prepend>
        <div v-if="showCheckboxes" class="media-thumb listitem-media-thumb">
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
        <div v-else-if="item.media_type == MediaType.FOLDER" class="media-thumb listitem-media-thumb">
          <v-btn variant="plain" icon>
            <v-icon icon="mdi-folder" size="60" style="align: center" />
          </v-btn>
        </div>
        <div v-else class="media-thumb listitem-media-thumb">
          <MediaItemThumb height="50" width="50" :item="item" />
        </div>
      </template>

      <!-- title -->
      <template #title>
        <span v-if="item.media_type == MediaType.FOLDER">
          <span>{{ getBrowseFolderName(item as BrowseFolder, t) }}</span>
        </span>
        <span v-else>
          {{ item.name }}
          <span v-if="'version' in item && item.version">({{ item.version }})</span>
        </span>
        <!-- explicit icon -->
        <v-tooltip v-if="item && item.metadata" location="bottom">
          <template #activator="{ props }">
            <v-icon
              v-if="parseBool(item.metadata.explicit || false)"
              v-bind="props"
              icon="mdi-alpha-e-box"
              width="35"
            />
          </template>
          <span>{{ $t('tooltip.explicit') }}</span>
        </v-tooltip>
      </template>

      <!-- subtitle -->
      <template #subtitle>
        <!-- track: artists(s) + album -->
        <div v-if="item.media_type == MediaType.TRACK" class="line-clamp-1">
          <v-item-group>
            <v-item v-if="'artists' in item">
              {{ getArtistsString(item.artists, 2) }}
            </v-item>
            <v-item v-if="showAlbum && 'album' in item && item.album"> • {{ item.album.name }} </v-item>
            <v-item v-if="'disc_number' in item && item.disc_number && showDiscNumber">
              <v-icon style="margin-left: 5px" icon="md:album" /> {{ item.disc_number }}
            </v-item>
            <v-item v-if="'track_number' in item && item.track_number && showTrackNumber">
              <v-icon style="margin-left: 5px" icon="mdi-music-circle-outline" /> {{ item.track_number }}
            </v-item>
            <v-item v-else-if="'position' in item && item.position && showPosition">
              <v-icon style="margin-left: 5px" icon="mdi-music-circle-outline" /> {{ item.position }}
            </v-item>
          </v-item-group>
        </div>

        <!-- album: albumtype + artists + year -->
        <div
          v-else-if="
            item.media_type == MediaType.ALBUM &&
            'artists' in item &&
            item.artists &&
            'year' in item &&
            item.year &&
            'album_type' in item
          "
        >
          {{ $t('album_type.' + item.album_type) }} • {{ getArtistsString(item.artists) }} • {{ item.year }}
        </div>
        <!-- album: albumtype + artists -->
        <div
          v-else-if="item.media_type == MediaType.ALBUM && 'artists' in item && item.artists && 'album_type' in item"
        >
          {{ $t('album_type.' + item.album_type) }} •
          {{ getArtistsString(item.artists) }}
        </div>
        <!-- track/album falback: artist present -->
        <div v-else-if="'artists' in item && item.artists">
          {{ getArtistsString(item.artists) }}
        </div>
        <!-- playlist owner -->
        <div v-else-if="'owner' in item && item.owner">
          {{ item.owner }}
        </div>
        <!-- radio description -->
        <div v-if="item.media_type == MediaType.RADIO && item.metadata.description">
          {{ item.metadata.description }}
        </div>
      </template>

      <!-- actions -->
      <template #append>
        <!-- hi res icon -->
        <v-img
          v-if="HiResDetails"
          :src="iconHiRes"
          width="30"
          :class="$vuetify.theme.current.dark ? 'hiresicondark' : 'hiresicon'"
        >
          <v-tooltip activator="parent" location="bottom">
            {{ HiResDetails }}
          </v-tooltip>
        </v-img>

        <!-- provider icon -->
        <provider-icon
          v-if="getBreakpointValue('bp2') && showProvider"
          :domain="item.media_type == MediaType.PLAYLIST ? item.provider_mappings[0].provider_domain : item.provider"
          :size="24"
        />

        <!-- favorite (heart) icon -->
        <div v-if="getBreakpointValue('bp3') && 'favorite' in item && showFavorite && !$vuetify.display.mobile">
          <v-btn
            variant="plain"
            ripple
            v-bind="props"
            :icon="item.favorite ? 'mdi-heart' : 'mdi-heart-outline'"
            @click="api.toggleFavorite(item)"
            @click.prevent
            @click.stop
            :title="$t('tooltip.favorite')"
          />
        </div>

        <!-- track duration -->
        <div
          v-if="
            showDuration &&
            item.media_type == MediaType.TRACK &&
            'duration' in item &&
            item.duration != undefined &&
            getBreakpointValue('bp0')
          "
        >
          <div>
            <span class="text-caption" style="padding-right: 10px; padding-left: 10px">{{
              formatDuration(item.duration)
            }}</span>
          </div>
        </div>
      </template>
    </ListItem>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { VTooltip } from 'vuetify/components';
import MediaItemThumb from './MediaItemThumb.vue';
import { iconHiRes } from './QualityDetailsBtn.vue';
import ProviderIcon from './ProviderIcon.vue';
import {
  ContentType,
  type BrowseFolder,
  type MediaItem,
  type MediaItemType,
  MediaType,
} from '../plugins/api/interfaces';
import { formatDuration, parseBool, getArtistsString, getBrowseFolderName } from '../utils';
import { useI18n } from 'vue-i18n';
import api from '@/plugins/api';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';
import {getContextMenuItems} from "@/components/MediaItemContextMenu.vue"

// properties
export interface Props {
  item: MediaItemType;
  showTrackNumber?: boolean;
  showDiscNumber?: boolean;
  showPosition?: boolean;
  showProvider?: boolean;
  showAlbum?: boolean;
  showMenu?: boolean;
  showFavorite?: boolean;
  showDuration?: boolean;
  isSelected: boolean;
  isDisabled?: boolean;
  showCheckboxes?: boolean;
  showDetails?: boolean;
  parentItem?: MediaItemType;
}

// global refs
const { t } = useI18n();

const props = withDefaults(defineProps<Props>(), {
  showTrackNumber: true,
  showDiscNumber: true,
  showProvider: true,
  showPosition: true,
  showAlbum: true,
  showMenu: true,
  showFavorite: false,
  showDuration: true,
  showCheckboxes: false,
  parentItem: undefined,
  isDisabled: false,
});

// computed properties
const HiResDetails = computed(() => {
  for (const prov of props.item.provider_mappings) {
    if (prov.audio_format.content_type == undefined) continue;
    if (![ContentType.DSF, ContentType.FLAC, ContentType.AIFF, ContentType.WAV].includes(prov.audio_format.content_type))
      continue;
    if (prov.audio_format.sample_rate > 48000 || prov.audio_format.bit_depth > 16) {
      return `${prov.audio_format.sample_rate/1000}kHz ${prov.audio_format.bit_depth} bits`;
    }
  }
  return '';
});

// emits
/* eslint-disable no-unused-vars */
const emit = defineEmits<{
  (e: 'menu', value: MediaItemType): void;
  (e: 'click', value: MediaItemType): void;
  (e: 'select', value: MediaItemType, selected: boolean): void;
}>();
/* eslint-enable no-unused-vars */

// methods

const itemIsAvailable = function (item: MediaItem) {
  if (item.media_type == MediaType.FOLDER) return true;
  if (!props.item.provider_mappings) return true;
  for (const x of item.provider_mappings) {
    if (x.available && api.providers[x.provider_instance]?.available) return true;
  }
  return false;
};
</script>

<style scoped>
.hiresicon {
  margin-top:5px;
  margin-right: 15px;
  margin-left: 15px;
  filter: invert(100%);
}
.hiresicondark {
  margin-top:5px;
  margin-right: 15px;
  margin-left: 15px;
  filter: invert(100%);
}
</style>