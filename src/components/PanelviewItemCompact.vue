<template>
  <v-hover v-slot="{ isHovering, props }">
    <v-card
      v-hold="onMenu"
      v-bind="props"
      :class="{ 'on-hover': isHovering, unavailable: !isAvailable }"
      :elevation="isHovering ? 3 : 0"
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
      <MediaItemThumb :item="isAvailable ? item : undefined" />
      <div
        :class="
          $vuetify.theme.current.dark ? 'paneldetails-dark' : 'paneldetails'
        "
        :model-value="isHovering || $vuetify.display.mobile || permanentOverlay"
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
            v-if="'authors' in item && item.authors"
            class="line-clamp-1"
          >
            {{ item.authors.join(" / ") }}
          </v-list-item-subtitle>
          <v-list-item-subtitle
            v-else-if="'publisher' in item && item.publisher"
            class="line-clamp-1"
          >
            {{ item.publisher }}
          </v-list-item-subtitle>
          <v-list-item-subtitle
            v-else-if="'owner' in item && item.owner"
            class="line-clamp-1"
          >
            {{ item.owner }}
          </v-list-item-subtitle>
          <v-list-item-subtitle
            v-else-if="!('provider_mappings' in item)"
            class="line-clamp-1"
          >
            {{ $t(item.media_type) }}
          </v-list-item-subtitle>
        </v-list-item>
      </div>
      <!-- play button -->
      <v-btn
        v-if="
          (isHovering || store.isTouchscreen) && isAvailable && item.is_playable
        "
        icon="mdi-play"
        color="primary"
        fab
        size="small"
        style="position: absolute; right: 10px; bottom: 35px; opacity: 0.8"
        @click.stop="onPlayClick"
      />
    </v-card>
  </v-hover>
</template>

<script setup lang="ts">
import MediaItemThumb from "./MediaItemThumb.vue";
import {
  BrowseFolder,
  ItemMapping,
  type MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";
import {
  getArtistsString,
  getBrowseFolderName,
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/utils";
import { store } from "@/plugins/store";

// properties
export interface Props {
  item: MediaItemType | ItemMapping;
  size?: number;
  isSelected?: boolean;
  showCheckboxes?: boolean;
  permanentOverlay?: boolean;
  isAvailable?: boolean;
  parentItem?: MediaItemType;
  disabled?: boolean;
}
const compProps = withDefaults(defineProps<Props>(), {
  size: 200,
  isSelected: false,
  showCheckboxes: false,
  permanentOverlay: false,
  isAvailable: true,
  parentItem: undefined,
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
.v-card {
  transition: opacity 0.4s ease-in-out;
  padding: 0px;
  margin-bottom: 10px;
}

.v-card:not(.on-hover) {
  opacity: 0.75;
}

.v-card.unavailable {
  opacity: 0.3;
}

.panel-item-details {
  padding: 5px !important;
  height: 50px;
  bottom: 5px;
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

<style lang="scss" scoped>
.paneldetails {
  background-color: rgba(255, 255, 255, 0.75);
  position: absolute;
  width: 100%;
  height: 50px;
  bottom: 0px;
  border-radius: 0;
}

.paneldetails-dark {
  @extend .paneldetails;
  background-color: rgba(0, 0, 0, 0.75);
}
</style>
