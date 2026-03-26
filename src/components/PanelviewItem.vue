<template>
  <div
    v-hold="onMenu"
    class="panel-item group"
    :class="{ unavailable: !isAvailable }"
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
        v-else-if="showMediaType"
        class="text-muted-foreground text-xs ma-line-clamp-1"
      >
        {{ $t(item.media_type) }}
      </div>
      <div v-else class="text-muted-foreground text-xs ma-line-clamp-1" />
    </div>

    <!-- play button -->
    <NowPlayingBadge
      v-if="isPlaying && !showActions"
      icon-style="position: absolute; right: 5px; bottom: 5px"
      :show-badge="false"
    />
    <Button
      v-if="
        (isHovering || store.isTouchscreen) && isAvailable && item.is_playable
      "
      variant="default"
      size="icon"
      :disabled="disablePlayButton"
      class="absolute opacity-80"
      :style="`right: 15px; bottom: ${showActions ? 90 : 35}px;`"
      @click.stop="onPlayClick"
    >
      <Play class="h-5 w-5" />
    </Button>

    <div v-if="showActions" class="panel-item-actions">
      <div class="flex items-center gap-0 p-0">
        <span v-if="parseBool(item.metadata.explicit || false)">
          <SquareAsterisk class="h-[30px] w-[30px]" />
        </span>
        <!-- hi res icon -->
        <Tooltip v-if="HiResDetails">
          <TooltipTrigger as-child>
            <span>
              <img
                :src="iconHiRes"
                width="30"
                :class="isDark ? 'hiresicon' : 'hiresiconinverted'"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {{ HiResDetails }}
          </TooltipContent>
        </Tooltip>
        <!-- disc/track number-->
        <span
          v-if="
            showTrackNumber && 'track_number' in item && item.track_number
          "
          class="flex items-center text-xs"
        >
          <Music class="h-4 w-4" />
          <span v-if="item.disc_number">{{ item.disc_number }}/</span
          >{{ item.track_number }}
        </span>
        <!-- position-->
        <span
          v-else-if="'position' in item && item.position"
          class="flex items-center text-xs"
        >
          <Music class="h-4 w-4" />
          {{ item.position }}
        </span>
        <span v-if="getBreakpointValue('bp3')">
          <FavouriteButton :item="item" />
        </span>
      </div>

      <!-- Now Playing Badge -->
      <NowPlayingBadge v-if="isPlaying" :show-badge="false" />
      <div class="flex-1" />
      <Button
        v-if="isHovering || mobile"
        variant="ghost"
        size="icon-sm"
        class="pr-0 -mr-[5px]"
        @click.stop="onMenu"
      >
        <EllipsisVertical class="h-5 w-5" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import FavouriteButton from "@/components/FavoriteButton.vue";
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
import { EllipsisVertical, Music, Play, SquareAsterisk } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import MediaItemThumb from "./MediaItemThumb.vue";
import ProviderIcon from "./ProviderIcon.vue";
import { iconHiRes } from "./QualityDetailsBtn.vue";

const isHovering = ref(false);
const { isDark } = useIsDark();
const { mobile } = useBreakpoint();

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
  disablePlayButton?: boolean;
  parentItem?: MediaItemType;
}
const compProps = withDefaults(defineProps<Props>(), {
  size: 200,
  showCheckboxes: false,
  showActions: false,
  showTrackNumber: false,
  showMediaType: false,
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
.panel-item {
  position: relative;
  height: 100%;
  padding: 10px;
  border: none;
  border-radius: 3px;
  background-color: hsl(var(--card));
  transition: opacity 0.4s ease-in-out;
  cursor: pointer;
}

.panel-item.unavailable {
  opacity: 0.3;
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
  padding: 0;
  height: 40px;
}

.panel-item-actions {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  margin: 0;
  margin-top: 10px;
  height: 40px;
  min-height: unset;
}

@media (max-width: 575px) {
  .panel-item {
    padding: 6px;
  }

  .panel-item-details {
    margin-top: 6px;
  }
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
