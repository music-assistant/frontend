<!-- eslint-disable vue/no-template-shadow -->
<template>
  <ListItem
    link
    :show-menu-btn="showMenu"
    :menu-button-label="menuButtonLabel"
    :class="{
      unavailable: !isAvailable && !notInLibrary,
      'not-in-library': notInLibrary,
      'listitem-selecting': showCheckboxes,
      'album-track-row': albumTrackView,
    }"
    @click.stop="onClick"
    @menu.stop="onMenu"
  >
    <template #prepend>
      <div v-if="showCheckboxes" class="flex items-center space-x-2 checkbox">
        <Checkbox
          :id="`listviewitem-checkbox-${item.item_id}`"
          :model-value="isSelected"
          @click.stop
          @update:model-value="
            (x: boolean | 'indeterminate') => {
              if (x != 'indeterminate') emit('select', item, x);
            }
          "
        />
        <label :for="`listviewitem-checkbox-${item.item_id}`">
          <ListviewItemTitle
            :display-name="displayName"
            :item="item"
            :parent-item="parentItem"
            :show-checkboxes="showCheckboxes"
            :is-playing="isPlaying"
          />
        </label>
      </div>
      <div v-else class="listitem-prepend">
        <!-- ===== TOUCH (phone/tablet): number / art stay on the left; play moves to the right (see #append) ===== -->
        <template v-if="isTouch">
          <div
            v-if="
              albumTrackView &&
              showTrackNumber &&
              'track_number' in item &&
              item.track_number
            "
            class="track-number"
          >
            {{ item.track_number }}
          </div>
          <div
            v-else-if="!albumTrackView"
            class="media-thumb listitem-media-thumb"
          >
            <div
              v-if="
                item.media_type == MediaType.COLLECTION && item != undefined
              "
            >
              <MediaCollectionThumb
                size="50"
                :item="item as MediaCollection<MediaItemType>"
                :thumb-offset="5"
              />
            </div>
            <div v-else>
              <MediaItemThumb
                size="50"
                :item="isAvailable || notInLibrary ? item : undefined"
                alt=""
              />
            </div>
          </div>
        </template>
        <!-- ===== DESKTOP (hover-capable): blue play reveals on hover ===== -->
        <!-- the click lives on the (always hit-testable) slot, not on the
             hover-revealed disc: gating clicks on :hover-driven pointer-events
             drops them whenever the browser invalidates the hover chain (e.g.
             a row re-render under a stationary mouse), sending the click to
             the row instead -->
        <template v-else>
          <!-- album view: track number that swaps to the blue play on hover -->
          <div
            v-if="albumTrackView"
            class="track-number-play"
            :class="{ 'is-playable': showPlay }"
            @click="onPlayAreaClick"
          >
            <div
              v-if="
                showTrackNumber && 'track_number' in item && item.track_number
              "
              class="track-number"
            >
              {{ item.track_number }}
            </div>
            <span v-if="showPlay" class="listitem-play-blue">
              <Play
                :size="16"
                fill="currentColor"
                :stroke-width="0"
                class="play-icon-centered"
              />
            </span>
          </div>
          <!-- other rows: blue play overlays the art on hover -->
          <div v-else class="listitem-thumb-area">
            <div
              class="media-thumb listitem-media-thumb"
              :class="{ 'is-playable': showPlay }"
              @click="onPlayAreaClick"
            >
              <div
                v-if="
                  item.media_type == MediaType.COLLECTION && item != undefined
                "
              >
                <MediaCollectionThumb
                  size="50"
                  :item="item as MediaCollection<MediaItemType>"
                  :thumb-offset="5"
                />
              </div>
              <div v-else>
                <MediaItemThumb
                  size="50"
                  :item="isAvailable || notInLibrary ? item : undefined"
                  alt=""
                />
              </div>
              <span v-if="showPlay" class="listitem-play-blue">
                <Play
                  :size="16"
                  fill="currentColor"
                  :stroke-width="0"
                  class="play-icon-centered"
                />
              </span>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- title -->
    <template v-if="!showCheckboxes" #title>
      <ListviewItemTitle
        :display-name="displayName"
        :item="item"
        :parent-item="parentItem"
        :show-checkboxes="showCheckboxes"
        :is-playing="isPlaying"
      />
    </template>

    <!-- subtitle -->
    <template #subtitle>
      <!-- album track view: only show collaborating artist(s), if any -->
      <template v-if="albumTrackView">
        <div v-if="collabArtists" class="ma-line-clamp-1">
          {{ $t("with_artists", { artists: collabArtists }) }}
        </div>
      </template>
      <!-- track: artists(s) + album (check for provider_mappings to filter out ItemMapping) -->
      <div
        v-else-if="
          item.media_type == MediaType.TRACK && 'provider_mappings' in item
        "
        class="ma-line-clamp-1"
      >
        <v-item-group>
          <v-item v-if="'artists' in item">
            {{ getArtistsString(item.artists, 2) }}
          </v-item>
          <v-item v-if="showAlbum && 'album' in item && item.album">
            • {{ item.album.name
            }}<span v-if="'year' in item.album && item.album.year">
              • {{ item.album.year }}</span
            >
          </v-item>
          <v-item
            v-if="showDiscNumber && 'disc_number' in item && item.disc_number"
          >
            <v-icon style="margin-left: 5px" icon="md:album" />
            {{ item.disc_number }}
          </v-item>
        </v-item-group>
      </div>

      <!-- album: albumtype + artists + year, or that it is not in the library -->
      <div v-else-if="item.media_type == MediaType.ALBUM">
        {{ albumSubtitle }}
      </div>
      <!-- track fallback: artist present -->
      <div v-else-if="'artists' in item && item.artists">
        {{ getArtistsString(item.artists) }}
      </div>
      <!-- playlist owner -->
      <div v-else-if="'owner' in item && item.owner">
        {{ item.owner }}
      </div>
      <!-- audiobook author(s) -->
      <div v-else-if="'authors' in item && item.authors">
        {{ getAuthorsNarratorsArray(item.authors).join(" / ") }}
      </div>
      <!-- audiobook publisher -->
      <div v-else-if="'publisher' in item && item.publisher">
        {{ item.publisher }}
      </div>
      <div v-else-if="item.media_type == MediaType.COLLECTION">
        {{ $t("collection") }}
      </div>
      <!-- description -->
      <div
        v-else-if="
          'metadata' in item &&
          item.metadata?.description &&
          [MediaType.RADIO, MediaType.PLAYLIST].includes(item.media_type)
        "
      >
        {{ truncateString(item.metadata.description, 150) }}
      </div>
      <!-- media type label -->
      <div v-else-if="!('provider_mappings' in item)">
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
      <v-img
        v-if="HiResDetails && getBreakpointValue('bp3')"
        :src="iconHiRes"
        width="30"
        alt=""
        :class="$vuetify.theme.current.dark ? 'hiresicondark' : 'hiresicon'"
      >
        <v-tooltip activator="parent" location="bottom">
          {{ HiResDetails }}
        </v-tooltip>
      </v-img>

      <!-- track duration -->
      <span
        v-if="
          showDuration &&
          'duration' in item &&
          item.duration &&
          !$vuetify.display.mobile
        "
        class="track-duration"
      >
        {{ formatDuration(item.duration) }}
      </span>

      <!-- provider icon -->
      <provider-icon
        v-if="getBreakpointValue('bp2') && showProvider"
        :domain="getListItemProviderIconDomain(item)"
        :size="24"
        class="mx-[10px]"
      />

      <!-- fully played or in progress icon -->
      <!-- only used for podcast-episodes and audiobook-chapters; the slot stays
      when unplayed so the durations line up across rows -->
      <span
        v-if="'fully_played' in item"
        class="listitem-played-state"
        :role="playedStateLabel ? 'img' : undefined"
        :title="playedStateLabel"
        :aria-label="playedStateLabel"
      >
        <Check v-if="item.fully_played" />
        <ClockFading v-else-if="isInProgress" />
      </span>

      <!-- favorite (heart) icon -->
      <div
        v-if="
          getBreakpointValue('bp3') &&
          canHoldFavorite(item) &&
          showFavorite &&
          canEditLibrary &&
          item.media_type != MediaType.COLLECTION &&
          !$vuetify.display.mobile
        "
        class="favorite-button-wrapper"
      >
        <FavouriteButton :item="item" />
      </div>

      <!-- touch devices: play button on the right, just left of the ⋮ menu, so
           tapping the album art never triggers (possibly remote) playback -->
      <v-btn
        v-if="isTouch && showPlay"
        icon
        variant="text"
        size="small"
        class="listitem-mobile-play"
        :aria-label="playButtonLabel"
        :disabled="disablePlayButton"
        @click.stop="onPlayClick"
      >
        <span class="listitem-play-blue-mobile">
          <Play
            :size="11"
            fill="currentColor"
            :stroke-width="0"
            class="play-icon-centered"
          />
        </span>
      </v-btn>
    </template>
  </ListItem>
</template>

<script setup lang="ts">
import FavouriteButton from "@/components/FavoriteButton.vue";
import ListItem from "@/components/ListItem.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { canHoldFavorite } from "@/helpers/favorites";
import {
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/media_item_actions";
import {
  formatDuration,
  getArtistsString,
  getAuthorsNarratorsArray,
  truncateString,
} from "@/helpers/utils";
import {
  getListItemProviderIconDomain,
  isMusicBrainzItem,
} from "@/plugins/api/helpers";
import {
  AlbumType,
  ContentType,
  MediaType,
  Scope,
  type MediaCollection,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { useMediaQuery } from "@vueuse/core";
import { Check, ClockFading, Play } from "@lucide/vue";
import { computed } from "vue";
import { VTooltip } from "vuetify/components";
import MediaItemThumb from "./MediaItemThumb.vue";
import ProviderIcon from "./ProviderIcon.vue";
import { iconHiRes } from "./QualityDetailsBtn.vue";

import { Checkbox } from "@/components/ui/checkbox";
import ListviewItemTitle from "./ListviewItemTitle.vue";
import MediaCollectionThumb from "./MediaCollectionThumb.vue";

// properties
export interface Props {
  item: MediaItemType;
  albumTrackView?: boolean;
  showTrackNumber?: boolean;
  showDiscNumber?: boolean;
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
  disablePlayButton?: boolean;
  parentItem?: MediaItemType;
  sortBy?: string;
}

// touch devices (phones + tablets like iPad) can't hover, so they get an
// explicit play button; only hover-capable desktops use the hover-reveal play.
const isTouch = useMediaQuery("(hover: none)");

const displayName = computed(() => compProps.item.name);
const playButtonLabel = computed(() => `${$t("play")} ${displayName.value}`);
const menuButtonLabel = computed(
  () => `${$t("more_options")}: ${displayName.value}`,
);

const compProps = withDefaults(defineProps<Props>(), {
  albumTrackView: false,
  showTrackNumber: true,
  showDiscNumber: true,
  showProvider: true,
  showAlbum: true,
  showMenu: true,
  showFavorite: false,
  showDuration: true,
  showCheckboxes: false,
  disablePlayButton: false,
  isDisabled: false,
  isAvailable: true,
  parentItem: undefined,
  sortBy: undefined,
});

// computed properties
// a release only MusicBrainz knows: muted rather than shown as unavailable,
// since it can be opened and added to the library
const notInLibrary = computed(() => isMusicBrainzItem(compProps.item));

// a row that is not available has nothing to play, whatever its flag says
const showPlay = computed(
  () => compProps.item.is_playable && compProps.isAvailable,
);

// favouring an item changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);
// an album can also be a slim mapping (e.g. a track's album) without type or artists
const albumSubtitle = computed(() => {
  const item = compProps.item;
  const parts: string[] = [];
  if (notInLibrary.value) {
    parts.push($t("not_in_library"));
  } else {
    const albumType = "album_type" in item ? item.album_type : undefined;
    if (albumType && albumType !== AlbumType.UNKNOWN) {
      parts.push($t(`album_type.${albumType}`));
    }
    if ("artists" in item && item.artists.length) {
      parts.push(getArtistsString(item.artists));
    }
  }
  if ("year" in item && item.year) parts.push(String(item.year));
  return parts.join(" • ");
});
const collabArtists = computed(() => {
  if (!("artists" in compProps.item) || !compProps.item.artists) return "";
  const albumArtists =
    compProps.parentItem && "artists" in compProps.parentItem
      ? compProps.parentItem.artists
      : [];
  const albumNames = new Set(albumArtists.map((a) => a.name.toLowerCase()));
  const collab = compProps.item.artists.filter(
    (a) => !albumNames.has(a.name.toLowerCase()),
  );
  return collab.map((a) => a.name).join(" | ");
});
const isInProgress = computed(
  () =>
    "resume_position_ms" in compProps.item &&
    !!compProps.item.resume_position_ms,
);
// undefined while unplayed, when the played state shows nothing
const playedStateLabel = computed(() => {
  if ("fully_played" in compProps.item && compProps.item.fully_played)
    return $t("item_fully_played");
  return isInProgress.value ? $t("item_in_progress") : undefined;
});

const HiResDetails = computed(() => {
  if (!("provider_mappings" in compProps.item)) return "";
  for (const prov of compProps.item.provider_mappings) {
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
    true,
    compProps.sortBy,
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

// non-playable rows fall through to the row click (navigation)
const onPlayAreaClick = function (evt: PointerEvent) {
  if (!showPlay.value) return;
  evt.stopPropagation();
  onPlayClick(evt);
};

const onPlayClick = function (evt: PointerEvent) {
  if (compProps.showCheckboxes) return;
  handlePlayBtnClick(
    compProps.item,
    evt.clientX,
    evt.clientY,
    compProps.parentItem,
    undefined,
    compProps.sortBy,
  );
};
</script>

<style scoped>
.list-item-main.listitem-selecting {
  padding: 7px 0 !important;
}

.checkbox {
  margin-left: 20px;
}

.unavailable {
  opacity: 0.3;
}

/* a release that is not in the library: muted artwork, readable text */
.not-in-library .listitem-media-thumb :deep(.v-img) {
  opacity: 0.55;
  filter: grayscale(1);
}

.listitem-prepend {
  display: flex;
  align-items: center;
}

.track-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  /* spacing after the number so the title isn't cramped on mobile;
     desktop resets this to 0 via .track-number-play > .track-number */
  margin-right: 16px;
  font-size: 0.875rem;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
  transition: opacity 0.18s ease;
}

/* album view: track number and play button share one slot */
.track-number-play {
  display: flex;
  align-items: center;
}

/* other rows: album art with the outline play to its right on touch */
.listitem-thumb-area {
  display: flex;
  align-items: center;
}

.listitem-media-thumb {
  position: relative;
}

.listitem-media-thumb :deep(.v-img) {
  transition: filter 0.15s ease;
}

/* discover-style blue play button: desktop hover only */
.listitem-play-blue {
  display: none;
}

/* mobile: tighten the gap between the play button and the ⋮ menu */
.listitem-mobile-play {
  margin-right: -10px;
}

/* mobile: small blue play disc on the right, sized to match the old icon */
.listitem-play-blue-mobile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
}

@media (hover: hover) {
  /* the disc is purely visual; its parent slot handles the click */
  .listitem-play-blue {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: rgb(var(--v-theme-primary));
    color: #fff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;
  }

  .track-number-play.is-playable,
  .listitem-media-thumb.is-playable {
    cursor: pointer;
  }

  /* album view: overlay the number and the blue play in one centered cell.
     The extra right margin (more breathing room for the title) is desktop-only
     and exclusive to this view, where the prepend is just the narrow slot. */
  .track-number-play {
    display: grid;
    place-items: center;
    margin-right: 12px;
  }

  .track-number-play > .track-number,
  .track-number-play > .listitem-play-blue {
    grid-area: 1 / 1;
  }

  .track-number-play > .track-number {
    margin-right: 0;
  }

  .list-item-main:hover .track-number-play.is-playable > .track-number {
    opacity: 0;
  }

  /* other rows: blue play overlays the dimmed album art on row hover */
  .listitem-media-thumb .listitem-play-blue {
    position: absolute;
    inset: 0;
    margin: auto;
    z-index: 1;
  }

  .list-item-main:hover .listitem-media-thumb.is-playable :deep(.v-img) {
    filter: blur(4px) brightness(0.35);
  }

  .list-item-main:hover .listitem-play-blue {
    opacity: 1;
  }
}

.album-track-row :deep(.v-list-item__content) {
  margin-bottom: 1px;
}

.favorite-button-wrapper {
  margin-inline: 10px;
}

.listitem-played-state {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}
.track-duration {
  font-size: 0.875rem;
  opacity: 0.7;
  /* 16px + the now-playing bars' 6px margin = 22px, matching the gap on the
     duration's right (12px here + the provider icon's 10px) so it sits evenly */
  margin-left: 16px;
  margin-right: 12px;
  white-space: nowrap;
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
