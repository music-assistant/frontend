<!-- eslint-disable vue/no-template-shadow -->
<template>
  <ListItem
    link
    :show-menu-btn="showMenu"
    :class="{ unavailable: !isAvailable }"
    @click.stop="onClick"
    @menu.stop="onMenu"
  >
    <template #prepend>
      <div v-if="showCheckboxes" class="media-thumb listitem-media-thumb">
        <Checkbox
          :model-value="isSelected"
          @click.stop
          @update:model-value="
            (x: boolean | 'indeterminate') => {
              if (typeof x === 'boolean') emit('select', item, x);
            }
          "
        />
      </div>
      <div v-else class="media-thumb listitem-media-thumb">
        <MediaItemThumb size="50" :item="isAvailable ? item : undefined" />
      </div>
    </template>

    <!-- title -->
    <template #title>
      <span v-if="item.media_type == MediaType.FOLDER">
        <span>{{ getBrowseFolderName(item as BrowseFolder, t) }}</span>
      </span>
      <span v-else :class="{ 'is-playing': isPlaying }">
        {{ displayName }}
        <span v-if="'version' in item && item.version"
          >({{ item.version }})</span
        >
        <span
          v-if="
            item.media_type == MediaType.TRACK && item.metadata?.release_date
          "
        >
          ({{ new Date(item.metadata.release_date).getFullYear() }})</span
        >
      </span>
      <!-- explicit icon -->
      <Tooltip v-if="item && item.metadata">
        <TooltipTrigger as-child>
          <span
            v-if="parseBool(item.metadata.explicit || false)"
            class="inline-flex items-center"
          >
            <SquareLetterE class="h-5 w-5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span>{{ $t("tooltip.explicit") }}</span>
        </TooltipContent>
      </Tooltip>
    </template>

    <!-- subtitle -->
    <template #subtitle>
      <!-- track: artists(s) + album (check for provider_mappings to filter out ItemMapping) -->
      <div
        v-if="item.media_type == MediaType.TRACK && 'provider_mappings' in item"
        class="ma-line-clamp-1"
      >
        <span>
          <span v-if="'artists' in item">
            {{ getArtistsString(item.artists, 2) }}
          </span>
          <span v-if="showAlbum && 'album' in item && item.album">
            &bull; {{ item.album.name
            }}<span v-if="'year' in item.album && item.album.year">
              &bull; {{ item.album.year }}</span
            >
          </span>
          <span
            v-if="showDiscNumber && 'disc_number' in item && item.disc_number"
          >
            <Disc class="inline-block ml-1 h-4 w-4" />
            {{ item.disc_number }}
          </span>
          <span
            v-if="
              showTrackNumber && 'track_number' in item && item.track_number
            "
          >
            <Music class="inline-block ml-1 h-4 w-4" />
            {{ item.track_number }}
          </span>
          <span v-else-if="showPosition && 'position' in item && item.position">
            <Music class="inline-block ml-1 h-4 w-4" />
            {{ item.position }}
          </span>
          <!-- track duration -->
          <span v-if="showDuration && 'duration' in item && item.duration">
            <span> &bull; [{{ formatDuration(item.duration) }}]</span>
          </span>
        </span>
      </div>

      <!-- album: albumtype + artists + year -->
      <div v-else-if="item.media_type == MediaType.ALBUM && 'year' in item">
        <span v-if="item.album_type != AlbumType.UNKNOWN"
          >{{ $t("album_type." + item.album_type) }} &bull;
        </span>
        <span>{{ getArtistsString(item.artists) }}</span>
        <span v-if="item.year"> &bull; {{ item.year }}</span>
      </div>
      <!-- track/album fallback: artist present -->
      <div v-else-if="'artists' in item && item.artists">
        {{ getArtistsString(item.artists) }}
      </div>
      <!-- playlist owner -->
      <div v-else-if="'owner' in item && item.owner">
        {{ item.owner }}
      </div>
      <!-- audiobook author(s) -->
      <div v-else-if="'authors' in item && item.authors">
        {{ item.authors.join(" / ") }}
      </div>
      <!-- audiobook publisher -->
      <div v-else-if="'publisher' in item && item.publisher">
        {{ item.publisher }}
      </div>
      <!-- description -->
      <div
        v-else-if="
          'metadata' in item &&
          item.metadata?.description &&
          [MediaType.RADIO, MediaType.PLAYLIST, MediaType.FOLDER].includes(
            item.media_type,
          )
        "
      >
        {{ truncateString(item.metadata.description, 150) }}
      </div>
      <!-- media type label -->
      <div v-else-if="'media_type' in item && !item.provider_mappings">
        {{ $t(item.media_type) }}
      </div>
    </template>

    <!-- actions -->
    <template #append>
      <!-- Now Playing Badge -->
      <NowPlayingBadge
        v-if="isPlaying"
        :show-badge="getBreakpointValue('bp7')"
      />
      <!-- hi res icon -->
      <Tooltip v-if="HiResDetails && getBreakpointValue('bp3')">
        <TooltipTrigger as-child>
          <img
            :src="iconHiRes"
            width="30"
            :class="isDark ? 'hiresicondark' : 'hiresicon'"
          />
        </TooltipTrigger>
        <TooltipContent>
          {{ HiResDetails }}
        </TooltipContent>
      </Tooltip>

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

      <!-- fully played or in progress icon -->
      <!-- only used for podcast-episodes and audiobook-chapters -->
      <Check
        v-if="'fully_played' in item && item.fully_played"
        class="h-5 w-5"
        :title="$t('item_fully_played')"
      />
      <Clock
        v-else-if="'resume_position_ms' in item && item.resume_position_ms"
        class="h-5 w-5"
        :title="$t('item_in_progress')"
      />

      <!-- favorite (heart) icon -->
      <div
        v-if="
          getBreakpointValue('bp3') &&
          'favorite' in item &&
          showFavorite &&
          !mobile
        "
      >
        <FavouriteButton :item="item" />
      </div>

      <!-- play button -->
      <Button
        v-if="item.is_playable && (showPlayButton ?? getBreakpointValue('bp0'))"
        variant="ghost"
        size="icon-sm"
        :disabled="disablePlayButton"
        @click.stop="onPlayClick"
      >
        <PlayCircle class="h-6 w-6" />
      </Button>
    </template>
  </ListItem>
</template>

<script setup lang="ts">
import FavouriteButton from "@/components/FavoriteButton.vue";
import ListItem from "@/components/ListItem.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreakpoint } from "@/composables/useBreakpoint";
import { useIsDark } from "@/composables/useIsDark";
import {
  formatDuration,
  getArtistsString,
  getBrowseFolderName,
  getGenreDisplayName,
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
  parseBool,
  truncateString,
} from "@/helpers/utils";
import {
  AlbumType,
  ContentType,
  MediaType,
  type BrowseFolder,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import {
  Check,
  Clock,
  Disc,
  Music,
  PlayCircle,
  SquareAsterisk as SquareLetterE,
} from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import MediaItemThumb from "./MediaItemThumb.vue";
import ProviderIcon from "./ProviderIcon.vue";
import { iconHiRes } from "./QualityDetailsBtn.vue";

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
  isAvailable?: boolean;
  isPlaying?: boolean;
  showCheckboxes?: boolean;
  showDetails?: boolean;
  showPlayButton?: boolean;
  disablePlayButton?: boolean;
  parentItem?: MediaItemType;
}

// global refs
const { t, te } = useI18n();
const isDark = useIsDark();
const { mobile } = useBreakpoint();

const displayName = computed(() => {
  if (compProps.item.media_type === MediaType.GENRE) {
    return getGenreDisplayName(
      compProps.item.name,
      compProps.item.translation_key,
      t,
      te,
    );
  }
  return compProps.item.name;
});

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
  showPlayButton: undefined,
  disablePlayButton: false,
  isDisabled: false,
  isAvailable: true,
  parentItem: undefined,
});

// computed properties
const HiResDetails = computed(() => {
  if (!("provider_mappings" in compProps.item)) return "";
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
  return "";
});

// emits
const emit = defineEmits<{
  (e: "select", item: MediaItemType, selected: boolean): void;
}>();

const onMenu = function (evt: Event) {
  const mouseEvt = evt as MouseEvent;
  handleMenuBtnClick(
    compProps.item,
    mouseEvt.clientX,
    mouseEvt.clientY,
    compProps.parentItem,
  );
};

const onClick = function (evt: Event) {
  if (compProps.showCheckboxes) return;
  const mouseEvt = evt as MouseEvent;
  handleMediaItemClick(
    compProps.item,
    mouseEvt.clientX,
    mouseEvt.clientY,
    compProps.parentItem,
  );
};

const onPlayClick = function (evt: PointerEvent) {
  if (compProps.showCheckboxes) return;
  handlePlayBtnClick(
    compProps.item,
    evt.clientX,
    evt.clientY,
    compProps.parentItem,
  );
};
</script>

<style scoped>
.unavailable {
  opacity: 0.3;
}

.dimmed {
  opacity: 0.3;
}

.hidden {
  opacity: 0;
}

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
