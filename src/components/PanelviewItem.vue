<template>
  <v-hover v-slot="{ isHovering, props }">
    <v-card
      v-hold="onMenu"
      v-bind="props"
      tile
      hover
      class="panel-item"
      :class="{ unavailable: !isAvailable }"
      @click="onClick"
      @click.right.prevent="onMenu"
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
      >
        <v-checkbox
          class="panel-item-checkbox"
          :ripple="false"
          :model-value="isSelected"
        />
      </v-overlay>

      <div class="thumb-container">
        <MediaItemThumb
          :item="isAvailable ? item : undefined"
          style="height: auto"
        />
        <div
          v-if="
            item.media_type === MediaType.PLAYLIST &&
            'provider_mappings' in item
          "
          class="provider-icon-overlay"
        >
          <ProviderIcon
            :domain="item.provider_mappings[0].provider_domain"
            :size="20"
          />
        </div>
      </div>

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
          <span v-else :class="{ 'is-playing': isPlaying }">{{
            displayName
          }}</span>
          <span
            v-if="'version' in item && item.version"
            :class="{ 'is-playing': isPlaying }"
          >
            - {{ item.version }}</span
          >
        </v-list-item-title>
        <v-list-item-subtitle
          v-if="'artists' in item && item.artists"
          class="ma-line-clamp-1"
        >
          {{ getArtistsString(item.artists, 1) }}
        </v-list-item-subtitle>
        <v-list-item-subtitle
          v-if="'authors' in item && item.authors"
          class="ma-line-clamp-1"
        >
          {{ item.authors.join(" / ") }}
        </v-list-item-subtitle>
        <v-list-item-subtitle
          v-else-if="'publisher' in item && item.publisher"
          class="ma-line-clamp-1"
        >
          {{ item.publisher }}
        </v-list-item-subtitle>
        <v-list-item-subtitle
          v-else-if="'owner' in item && item.owner"
          class="ma-line-clamp-1"
        >
          {{ item.owner }}
        </v-list-item-subtitle>
        <v-list-item-subtitle v-else-if="showMediaType" class="ma-line-clamp-1">
          {{ $t(item.media_type) }}
        </v-list-item-subtitle>
        <v-list-item-subtitle v-else class="ma-line-clamp-1" />
      </v-list-item>

      <!-- play button -->
      <NowPlayingBadge
        v-if="isPlaying && !showActions"
        icon-style="position: absolute; right: 5px; bottom: 5px"
        :show-badge="false"
      />
      <v-btn
        v-if="
          (isHovering || store.isTouchscreen) && isAvailable && item.is_playable
        "
        icon="mdi-play"
        color="primary"
        fab
        :style="`position: absolute; right: 15px; bottom: ${showActions ? 90 : 35}px; opacity: 0.8`"
        @click.stop="onPlayClick"
      />

      <v-card-actions v-if="showActions" class="panel-item-actions">
        <v-item-group style="padding: 0">
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
          <!-- disc/track number-->
          <v-item
            v-if="
              showTrackNumber && 'track_number' in item && item.track_number
            "
          >
            <v-icon size="small" icon="mdi-music-circle-outline" />
            <span v-if="item.disc_number">{{ item.disc_number }}/</span
            >{{ item.track_number }}
          </v-item>
          <!-- position-->
          <v-item v-else-if="'position' in item && item.position">
            <v-icon size="small" icon="mdi-music-circle-outline" />
            {{ item.position }}
          </v-item>
          <v-item v-if="getBreakpointValue('bp3')">
            <FavouriteButton :item="item" />
          </v-item>
        </v-item-group>

        <!-- Now Playing Badge -->
        <NowPlayingBadge v-if="isPlaying" :show-badge="false" />
        <v-spacer />
        <MAButton
          v-if="isHovering || $vuetify.display.mobile"
          variant="list"
          icon="mdi-dots-vertical"
          style="padding-right: 0; margin-right: -5px"
          @click.stop="onMenu"
        />
      </v-card-actions>
    </v-card>
  </v-hover>
</template>

<script setup lang="ts">
import MAButton from "@/components/Button.vue";
import FavouriteButton from "@/components/FavoriteButton.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import {
  getArtistsString,
  getBrowseFolderName,
  getGenreDisplayName,
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
  parseBool,
} from "@/helpers/utils";
import {
  BrowseFolder,
  ContentType,
  type MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import MediaItemThumb from "./MediaItemThumb.vue";
import ProviderIcon from "./ProviderIcon.vue";
import { iconHiRes } from "./QualityDetailsBtn.vue";

// properties
export interface Props {
  item: MediaItemType;
  size?: number;
  isSelected: boolean;
  showCheckboxes?: boolean;
  showMediaType?: boolean;
  showActions?: boolean;
  showTrackNumber?: boolean;
  isAvailable?: boolean;
  isPlaying?: boolean;
  parentItem?: MediaItemType;
}
const compProps = withDefaults(defineProps<Props>(), {
  size: 200,
  showCheckboxes: false,
  showActions: false,
  showTrackNumber: false,
  showMediaType: false,
  isAvailable: true,
  parentItem: undefined,
});

const { t, te } = useI18n();
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

// computed properties
const HiResDetails = computed(() => {
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

const onMenu = function (evt: PointerEvent | TouchEvent | MouseEvent) {
  if (compProps.showCheckboxes) return;
  const posX = "clientX" in evt ? evt.clientX : evt.touches[0].clientX;
  const posY = "clientY" in evt ? evt.clientY : evt.touches[0].clientY;
  handleMenuBtnClick(compProps.item, posX, posY, compProps.parentItem);
};

const onClick = function (evt: PointerEvent) {
  if (compProps.showCheckboxes) {
    emit("select", compProps.item, compProps.isSelected ? false : true);
    return;
  }
  handleMediaItemClick(
    compProps.item,
    evt.clientX,
    evt.clientY,
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
.v-card.unavailable {
  opacity: 0.3;
}

.panel-item {
  height: 100%;
  padding: 10px;
  border: none;
  border-style: none !important;
}

.panel-item-checkbox {
  position: absolute;
  width: 100%;
  height: auto;
  left: 0;
  right: 0;
}

.panel-item-details {
  margin-top: 10px;
  padding-left: 0px !important;
  padding-right: 0px !important;
  height: 40px;
}

.panel-item-actions {
  gap: 0;
  padding: 0;
  margin: 0;
  margin-top: 10px;
  height: 40px;
  min-height: unset !important;
}

panel-item-details :deep(.v-list-item__content) {
  height: 30px;
}

.v-card--active {
  background-color: red;
}

.hiresicon {
  margin-right: 10px;
}

.hiresiconinverted {
  margin-right: 10px;
  filter: invert(100%);
}

.thumb-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.provider-icon-overlay {
  position: absolute;
  left: -10px;
  top: 0px;
  z-index: 2;
}
</style>
