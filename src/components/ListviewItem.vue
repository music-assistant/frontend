<!-- eslint-disable vue/no-template-shadow -->
<template>
  <div>
    <v-list-item
      link
      :disabled="!itemIsAvailable(item)"
      class="listitem"
      density="compact"
      @click.stop="emit('click', item)"
      @click.right.prevent="emit('menu', item)"
    >
      <template #prepend>
        <div
          v-if="showCheckboxes"
          class="listitem-thumb"
        >
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
        <div
          v-else-if="item.media_type == MediaType.FOLDER"
          class="listitem-thumb"
        >
          <v-btn
            variant="plain"
            icon
          >
            <v-icon
              icon="mdi-folder"
              size="60"
              style="align: center"
            />
          </v-btn>
        </div>
        <div
          v-else
          class="listitem-thumb"
        >
          <MediaItemThumb
            :item="item"
            :size="50"
          />
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
        <v-tooltip location="bottom">
          <template #activator="{ props }">
            <v-icon
              v-if="parseBool(item.metadata.explicit || false)"
              v-bind="props"
              class="listitem-action"
              icon="mdi-alpha-e-box"
              width="35"
            />
          </template>
          <span>{{ $t("tooltip.explicit") }}</span>
        </v-tooltip>
      </template>

      <!-- subtitle -->
      <template #subtitle>
        <!-- track: artists(s) + album -->
        <div v-if="item.media_type == MediaType.TRACK">
          <v-item-group>
            <v-item v-if="'artists' in item">
              {{
                getArtistsString(item.artists)
              }}
            </v-item>
            <v-item v-if="showAlbum && 'album' in item && item.album">
              • {{ item.album.name }}
            </v-item>
            <v-item v-if="'disc_number' in item && item.disc_number && showTrackNumber">
              <v-icon
                style="margin-left: 5px;"
                icon="md:album"
              /> {{
                item.disc_number
              }}
            </v-item>
            <v-item
              v-if="
                'track_number' in item && item.track_number && showTrackNumber
              "
            >
              <v-icon
                style="margin-left: 5px;"
                icon="mdi-music-circle-outline"
              /> {{
                item.track_number
              }}
            </v-item>
            <v-item v-else-if="'position' in item && item.position">
              <v-icon
                style="margin-left: 5px;"
                icon="mdi-music-circle-outline"
              /> {{ item.position }}
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
          {{ $t("album_type." + item.album_type) }} •
          {{ getArtistsString(item.artists) }} • {{ item.year }}
        </div>
        <!-- album: albumtype + artists -->
        <div
          v-else-if="
            item.media_type == MediaType.ALBUM &&
              'artists' in item &&
              item.artists &&
              'album_type' in item
          "
        >
          {{ $t("album_type." + item.album_type) }} •
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
        <div class="listitem-actions">
          <!-- hi res icon -->
          <v-img
            v-if="HiResDetails"
            class="listitem-action"
            :src="iconHiRes"
            width="35"
            :style="
              $vuetify.theme.current.dark
                ? 'margin-top:5px;'
                : 'margin-top:5px;filter: invert(100%);'
            "
          >
            <v-tooltip
              activator="parent"
              location="bottom"
            >
              {{ HiResDetails }}
            </v-tooltip>
          </v-img>

          <!-- provider icons -->
          <provider-icons
            v-if="
              item.provider_mappings &&
                showProviders &&
                !$vuetify.display.mobile
            "
            :provider-mappings="item.provider_mappings"
            :height="20"
            class="listitem-actions"
          />

          <!-- in library (heart) icon -->
          <div
            v-if="
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1 &&
                'in_library' in item && showLibrary && !$vuetify.display.mobile
            "
            class="listitem-action"
          >
            <v-tooltip location="bottom">
              <template #activator="{ props }">
                <v-btn
                  variant="plain"
                  ripple
                  v-bind="props"
                  :icon="item.in_library ? 'mdi-heart' : 'mdi-heart-outline'"
                  @click="api.toggleLibrary(item)"
                  @click.prevent
                  @click.stop
                />
              </template>
              <span>{{ $t("tooltip.library") }}</span>
            </v-tooltip>
          </div>

          <!-- track duration -->
          <div
            v-if="
              showDuration &&
                item.media_type == MediaType.TRACK &&
                'duration' in item &&
                item.duration != undefined &&
                !$vuetify.display.mobile
            "
            class="listitem-action"
          >
            <div>
              <span
                class="text-caption"
                style="padding-right: 10px; padding-left: 10px"
              >{{ formatDuration(item.duration)
              }}</span>
            </div>
          </div>

          <!-- menu button/icon -->
          <div
            v-if="
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1 &&
                showMenu
            "
            class="listitem-action"
            style="margin-right:-13px"
          >
            <v-btn
              variant="plain"
              ripple
              v-bind="props"
              icon="mdi-dots-vertical"
              @click.stop="emit('menu', item)"
            />
          </div>
        </div>
      </template>
    </v-list-item>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { VTooltip } from "vuetify/components";
import MediaItemThumb from "./MediaItemThumb.vue";
import ProviderIcons, {
  iconHiRes,
} from "./ProviderIcons.vue";
import {
  ContentType,
  type BrowseFolder,
  type MediaItem,
  type MediaItemType,
  MediaType,
} from "../plugins/api/interfaces";
import {
  formatDuration,
  parseBool,
  getArtistsString,
  getBrowseFolderName,
  getResponsiveBreakpoints,
} from "../utils";
import { useI18n } from "vue-i18n";
import api from "@/plugins/api";

// properties
export interface Props {
  item: MediaItemType;
  showTrackNumber?: boolean;
  showProviders?: boolean;
  showAlbum?: boolean;
  showMenu?: boolean;
  showLibrary?: boolean;
  showDuration?: boolean;
  isSelected: boolean;
  showCheckboxes?: boolean;
  showDetails?: boolean;
  parentItem?: MediaItemType;
}

// global refs
const { t } = useI18n();

const props = withDefaults(defineProps<Props>(), {
  showTrackNumber: true,
  showProviders: true,
  showAlbum: true,
  showMenu: true,
  showLibrary: true,
  showDuration: true,
  showCheckboxes: false,
  parentItem: undefined,
});

// computed properties
const HiResDetails = computed(() => {
  for (const prov of props.item.provider_mappings) {
    if (prov.content_type == undefined) continue;
    if (
      !(
        prov.content_type in
        [ContentType.DSF, ContentType.FLAC, ContentType.AIFF, ContentType.WAV]
      )
    )
      continue;
    if (prov.sample_rate > 48000 || prov.bit_depth > 16) {
      return `${prov.sample_rate}kHz ${prov.bit_depth} bits`;
    }
  }
  return "";
});

// emits
/* eslint-disable no-unused-vars */
const emit = defineEmits<{
  (e: "menu", value: MediaItemType): void;
  (e: "click", value: MediaItemType): void;
  (e: "select", value: MediaItemType, selected: boolean): void;
}>();
/* eslint-enable no-unused-vars */

// methods

const itemIsAvailable = function (item: MediaItem) {
  if (item.media_type == MediaType.FOLDER) return true;
  if (!props.item.provider_mappings) return true;
  for (const x of item.provider_mappings) {
    if (x.available && api.providers[x.provider_instance]?.available)
      return true;
  }
  return false;
};
</script>

<style>
.v-slider.v-input--horizontal .v-input__control {
  min-height: 5px;
}

.listitem {
  padding-right: 0px;
  border-radius: 4px;
}

.listitem-thumb {
  padding-left: 0px;
  margin-right: 10px;
  margin-left: -10px;
  margin-top: 2px;
  width: 50px;
  height: 50px;
}
</style>