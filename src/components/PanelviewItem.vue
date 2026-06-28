<template>
  <EditorialMediaCard
    fluid
    :item="item"
    :is-available="isAvailable"
    :is-selected="isSelected"
    :show-checkboxes="showCheckboxes"
    :is-playing="isPlaying"
    :disable-play-button="disablePlayButton"
    :parent-item="parentItem"
    :sort-by="sortBy"
    @select="(i, selected) => emit('select', i as MediaItemType, selected)"
  >
    <template v-if="showActions" #actions>
      <div class="panel-item-actions" @click.stop>
        <v-icon
          v-if="parseBool(item.metadata.explicit || false)"
          size="30"
          icon="mdi-alpha-e-box"
        />
        <!-- hi res icon -->
        <span
          v-if="HiResDetails"
          :class="
            $vuetify.theme.current.dark ? 'hiresicon' : 'hiresiconinverted'
          "
        >
          <img :src="iconHiRes" width="30" alt="" />
          <v-tooltip activator="parent" location="bottom">
            {{ HiResDetails }}
          </v-tooltip>
        </span>
        <!-- disc/track number-->
        <span
          v-if="showTrackNumber && 'track_number' in item && item.track_number"
          class="track-no"
        >
          <v-icon size="small" icon="mdi-music-circle-outline" />
          <span v-if="item.disc_number">{{ item.disc_number }}/</span
          >{{ item.track_number }}
        </span>
        <!-- position-->
        <span v-else-if="'position' in item && item.position" class="track-no">
          <v-icon size="small" icon="mdi-music-circle-outline" />
          {{ item.position }}
        </span>
        <FavouriteButton v-if="getBreakpointValue('bp3')" :item="item" />
        <v-spacer />
        <MAButton
          variant="list"
          icon="mdi-dots-vertical"
          @click.stop="onMenu"
        />
      </div>
    </template>
  </EditorialMediaCard>
</template>

<script setup lang="ts">
import MAButton from "@/components/Button.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import FavouriteButton from "@/components/FavoriteButton.vue";
import { handleMenuBtnClick, parseBool } from "@/helpers/utils";
import { ContentType, type MediaItemType } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { computed } from "vue";
import { iconHiRes } from "./QualityDetailsBtn.vue";

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
  sortBy?: string;
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
  sortBy: undefined,
});

const emit = defineEmits<{
  (e: "select", item: MediaItemType, selected: boolean): void;
}>();

// computed: hi-res audio details (kHz/bit-depth) for lossless formats
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

const onMenu = function (evt: MouseEvent) {
  handleMenuBtnClick(
    compProps.item,
    evt.clientX,
    evt.clientY,
    compProps.parentItem,
    true,
    compProps.sortBy,
  );
};
</script>

<style scoped>
.panel-item-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  height: 32px;
}
.track-no {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.hiresicon {
  margin-right: 10px;
}
.hiresiconinverted {
  margin-right: 10px;
  filter: invert(100%);
}
</style>
