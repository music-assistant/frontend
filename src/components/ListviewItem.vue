<!-- eslint-disable vue/no-template-shadow -->
<template>
  <ListItem
    link
    :disabled="!itemIsAvailable(item) || isDisabled"
    :show-menu-btn="showMenu"
    @click.stop="onClick"
    @menu.stop="onMenu"
  >
    <template #prepend>
      <div v-if="showCheckboxes" class="media-thumb listitem-media-thumb">
        <v-checkbox
          :model-value="isSelected"
          @click.stop
          @update:model-value="
            (x: boolean | null) => {
              if (x != null) emit('select', item, x);
            }
          "
        />
      </div>
      <div v-else class="media-thumb listitem-media-thumb">
        <MediaItemThumb size="50" :item="item" />
      </div>
    </template>

    <!-- title -->
    <template #title>
      <span v-if="item.media_type == MediaType.FOLDER">
        <span>{{ getBrowseFolderName(item as BrowseFolder, t) }}</span>
      </span>
      <span v-else>
        {{ item.name }}
        <span v-if="'version' in item && item.version"
          >({{ item.version }})</span
        >
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
      <!-- track: artists(s) + album (check for provider_mappings to filter out ItemMapping) -->
      <div
        v-if="item.media_type == MediaType.TRACK && 'provider_mappings' in item"
        class="line-clamp-1"
      >
        <v-item-group>
          <v-item v-if="'artists' in item">
            {{ getArtistsString(item.artists, 2) }}
          </v-item>
          <v-item v-if="showAlbum && 'album' in item && item.album">
            • {{ item.album.name }}
          </v-item>
          <v-item
            v-if="showDiscNumber && 'disc_number' in item && item.disc_number"
          >
            <v-icon style="margin-left: 5px" icon="md:album" />
            {{ item.disc_number }}
          </v-item>
          <v-item
            v-if="
              showTrackNumber && 'track_number' in item && item.track_number
            "
          >
            <v-icon style="margin-left: 5px" icon="mdi-music-circle-outline" />
            {{ item.track_number }}
          </v-item>
          <v-item
            v-else-if="showPosition && 'position' in item && item.position"
          >
            <v-icon style="margin-left: 5px" icon="mdi-music-circle-outline" />
            {{ item.position }}
          </v-item>
        </v-item-group>
      </div>

      <!-- album: albumtype + artists + year -->
      <div v-else-if="item.media_type == MediaType.ALBUM && 'year' in item">
        <span v-if="item.album_type != AlbumType.UNKNOWN"
          >{{ $t('album_type.' + item.album_type) }} •
        </span>
        <span>{{ getArtistsString(item.artists) }}</span>
        <span v-if="item.year"> • {{ item.year }}</span>
      </div>
      <!-- track/album fallback: artist present -->
      <div v-else-if="'artists' in item && item.artists">
        {{ getArtistsString(item.artists) }}
      </div>
      <!-- playlist owner -->
      <div v-else-if="'owner' in item && item.owner">
        {{ item.owner }}
      </div>
      <!-- radio description -->
      <div
        v-else-if="
          item.media_type == MediaType.RADIO && item.metadata.description
        "
      >
        {{ item.metadata.description }}
      </div>
      <!-- media type label -->
      <div v-else-if="'media_type' in item && !item.provider_mappings">
        {{ $t(item.media_type) }}
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
        :domain="
          item.media_type == MediaType.PLAYLIST
            ? item.provider_mappings[0].provider_domain
            : item.provider
        "
        :size="24"
      />

      <!-- favorite (heart) icon -->
      <div
        v-if="
          getBreakpointValue('bp3') &&
          'favorite' in item &&
          showFavorite &&
          !$vuetify.display.mobile
        "
      >
        <FavouriteButton :item="item" />
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
          <span
            class="text-caption"
            style="padding-right: 10px; padding-left: 10px"
            >{{ formatDuration(item.duration) }}</span
          >
        </div>
      </div>
    </template>
  </ListItem>
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
  type MediaItemType,
  MediaType,
  AlbumType,
} from '@/plugins/api/interfaces';
import {
  formatDuration,
  parseBool,
  getArtistsString,
  getBrowseFolderName,
} from '@/helpers/utils';
import { useI18n } from 'vue-i18n';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';
import FavouriteButton from '@/components/FavoriteButton.vue';
import { itemIsAvailable } from '@/plugins/api/helpers';

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
}

// global refs
const { t } = useI18n();

const compProps = withDefaults(defineProps<Props>(), {
  showTrackNumber: true,
  showDiscNumber: true,
  showProvider: true,
  showPosition: true,
  showAlbum: true,
  showMenu: true,
  showFavorite: false,
  showDuration: true,
  showCheckboxes: false,
  isDisabled: false,
});

// computed properties
const HiResDetails = computed(() => {
  if (!('provider_mappings' in compProps.item)) return '';
  for (const prov of compProps.item.provider_mappings) {
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
const emit = defineEmits<{
  (e: 'menu', item: MediaItemType, posX: number, posY: number): void;
  (e: 'click', item: MediaItemType, posX: number, posY: number): void;
  (e: 'select', item: MediaItemType, selected: boolean): void;
}>();

const onMenu = function (evt: PointerEvent | TouchEvent) {
  const posX = 'clientX' in evt ? evt.clientX : evt.touches[0].clientX;
  const posY = 'clientY' in evt ? evt.clientY : evt.touches[0].clientY;
  emit('menu', compProps.item, posX, posY);
};

const onClick = function (evt: PointerEvent) {
  if (compProps.showCheckboxes) return;
  emit('click', compProps.item, evt.clientX, evt.clientY);
};
</script>

<style scoped>
.hiresicon {
  margin-top: 5px;
  margin-right: 15px;
  margin-left: 15px;
  filter: invert(100%);
}

.hiresicondark {
  margin-top: 5px;
  margin-right: 15px;
  margin-left: 15px;
}
</style>
