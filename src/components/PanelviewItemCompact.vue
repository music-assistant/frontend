<template>
  <v-hover v-slot="{ isHovering, props }">
    <v-card
      v-hold="onMenu"
      v-bind="props"
      :class="{ 'on-hover': isHovering, unavailable: !isAvailable }"
      elevation="0"
      :disabled="disabled"
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
        <MediaItemThumb :item="isAvailable ? item : undefined" />
        <div style="position: absolute; left: -10px; top: 0px; z-index: 2">
          <ProviderIcon
            v-if="
              (showProviderOnCover || item.media_type === MediaType.PLAYLIST) &&
              'provider_mappings' in item
            "
            :domain="
              item.media_type == MediaType.PLAYLIST
                ? item.provider_mappings[0].provider_domain
                : item.provider
            "
            :size="20"
          />
        </div>
        <!-- Now Playing Badge -->
        <NowPlayingBadge
          v-if="isPlaying"
          icon-style="position: absolute; right: 5px; bottom: 5px"
          :show-badge="false"
        />
        <!-- play button -->
        <div
          v-if="
            (isHovering || store.isTouchscreen) &&
            isAvailable &&
            item.is_playable
          "
          class="play-button-overlay"
        >
          <v-btn
            icon="mdi-play"
            color="white"
            fab
            :disabled="disablePlayButton"
            style="opacity: 0.6; font-size: 20px"
            @click.stop="onPlayClick"
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
        <v-list-item-subtitle
          v-else-if="!('provider_mappings' in item)"
          class="ma-line-clamp-1"
        >
          {{ $t(item.media_type) }}
        </v-list-item-subtitle>
      </v-list-item>
    </v-card>
  </v-hover>
</template>

<script setup lang="ts">
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import {
  getArtistsString,
  getBrowseFolderName,
  getGenreDisplayName,
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/utils";
import {
  BrowseFolder,
  ItemMapping,
  type MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import MediaItemThumb from "./MediaItemThumb.vue";
import ProviderIcon from "./ProviderIcon.vue";

// properties
export interface Props {
  item: MediaItemType | ItemMapping;
  size?: number;
  isSelected?: boolean;
  showCheckboxes?: boolean;
  permanentOverlay?: boolean;
  showProviderOnCover?: boolean;
  isAvailable?: boolean;
  isPlaying?: boolean;
  disablePlayButton?: boolean;
  parentItem?: MediaItemType;
  disabled?: boolean;
}
const compProps = withDefaults(defineProps<Props>(), {
  size: 200,
  isSelected: false,
  showCheckboxes: false,
  permanentOverlay: false,
  showProviderOnCover: false,
  isAvailable: true,
  disablePlayButton: false,
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

// emits
const emit = defineEmits<{
  (e: "select", item: MediaItemType | ItemMapping, selected: boolean): void;
}>();

const onMenu = function (evt: PointerEvent | TouchEvent) {
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
.thumb-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-button-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  .v-btn {
    pointer-events: all;
  }
}
.v-card {
  background-color: rgb(var(--v-theme-panel));
  transition: opacity 0.4s ease-in-out;
  border-radius: 3px;
  padding: 10px;
}

.v-card.unavailable {
  opacity: 0.3;
}

.panel-item-details {
  padding: 0px !important;
  margin-top: 10px;
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

.v-list-item-subtitle {
  color: rgb(var(--v-theme-on-panel), 0.6) !important;
  font-size: small !important;
}
</style>
