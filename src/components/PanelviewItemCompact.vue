<template>
  <div
    v-hold="onMenu"
    class="panel-card group"
    :class="{ 'on-hover': isHovering, unavailable: !isAvailable }"
    :disabled="disabled"
    @click="onClick"
    @click.right.prevent="onMenu"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- checkbox overlay -->
    <div
      v-if="showCheckboxes"
      class="absolute inset-0 z-10 flex items-center justify-center"
      :class="
        isSelected
          ? isDark
            ? 'bg-black/75'
            : 'bg-white/75'
          : 'bg-transparent'
      "
    >
      <Checkbox
        class="panel-item-checkbox"
        :checked="isSelected"
      />
    </div>
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
        <Button
          variant="default"
          size="icon"
          :disabled="disablePlayButton"
          class="opacity-60 text-xl pointer-events-auto"
          @click.stop="onPlayClick"
        >
          <Play class="h-5 w-5" />
        </Button>
      </div>
    </div>
    <div class="panel-item-details">
      <div class="text-sm font-medium leading-snug line-clamp-1">
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
      </div>
      <div
        v-if="'artists' in item && item.artists"
        class="text-muted-foreground text-xs ma-line-clamp-1"
      >
        {{ getArtistsString(item.artists, 1) }}
      </div>
      <div
        v-if="'authors' in item && item.authors"
        class="text-muted-foreground text-xs ma-line-clamp-1"
      >
        {{ item.authors.join(" / ") }}
      </div>
      <div
        v-else-if="'publisher' in item && item.publisher"
        class="text-muted-foreground text-xs ma-line-clamp-1"
      >
        {{ item.publisher }}
      </div>
      <div
        v-else-if="'owner' in item && item.owner"
        class="text-muted-foreground text-xs ma-line-clamp-1"
      >
        {{ item.owner }}
      </div>
      <div
        v-else-if="!('provider_mappings' in item)"
        class="text-muted-foreground text-xs ma-line-clamp-1"
      >
        {{ $t(item.media_type) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsDark } from "@/composables/useIsDark";
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
import { Play } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import MediaItemThumb from "./MediaItemThumb.vue";
import ProviderIcon from "./ProviderIcon.vue";

const isHovering = ref(false);
const { isDark } = useIsDark();

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
}

.panel-card {
  position: relative;
  background-color: hsl(var(--card));
  transition: opacity 0.4s ease-in-out;
  border-radius: 3px;
  padding: 10px;
  cursor: pointer;
}

@media (max-width: 575px) {
  .panel-card {
    padding: 6px;
  }

  .panel-item-details {
    margin-top: 6px;
  }
}

.panel-card.unavailable {
  opacity: 0.3;
}

.panel-item-details {
  padding: 0;
  margin-top: 10px;
}
</style>
