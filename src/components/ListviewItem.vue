<!-- eslint-disable vue/no-template-shadow -->
<template>
  <div>
    <v-list-item
      ripple
      :class="itemIsAvailable(item) ? '' : 'unavailable'"
      style="height: 60px"
      lines="two"
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
        <div
          v-if="
            item.media_type == MediaType.TRACK &&
              'album' in item &&
              item.album &&
              !showTrackNumber
          "
        >
          {{ getArtistsString(item.artists) }} • {{ item.album.name }}
        </div>
        <!-- albumtrack: artists(s) + disc/track number -->
        <div
          v-else-if="
            item.media_type == MediaType.TRACK &&
              'track_number' in item &&
              item.track_number &&
              showTrackNumber
          "
        >
          {{ getArtistsString(item.artists) }} • disc
          {{ item.disc_number }} track
          {{ item.track_number }}
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
        <div
          v-if="item.media_type == MediaType.RADIO && item.metadata.description"
        >
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

          <!-- islinked icon -->
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-icon
                v-if="
                  parentItem &&
                    parentItem.provider_mappings.find(
                      (x) => x.item_id === item.item_id
                    )
                "
                v-bind="props"
                class="listitem-action"
                icon="mdi-link-variant"
                size="30"
              />
            </template>
            <span>{{ $t("tooltip.linked") }}</span>
          </v-tooltip>

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
            <span>{{ formatDuration(item.duration) }}</span>
          </div>
        </div>

        <v-menu
          v-if="showDetails"
          location="bottom end"
          @click:outside.stop
        >
          <template #activator="{ props }">
            <v-icon
              icon="mdi-information-outline"
              size="30"
              class="listitem-action"
              style="margin-left: 10px; margin-right: 5px"
              v-bind="props"
            />
          </template>
          <v-card
            class="mx-auto"
            min-width="300"
          >
            <v-list style="overflow: hidden">
              <span
                class="text-h5"
                style="padding: 10px"
              >{{
                $t("provider_details")
              }}</span>
              <v-divider />
              <!-- provider icon + name -->
              <div style="height: 50px; display: flex; align-items: center">
                <img
                  height="30"
                  width="50"
                  center
                  :src="getProviderIcon(item.provider)"
                  style="object-fit: contain"
                >
                {{
                  truncateString(
                    api.providers[item.provider_mappings[0].provider_domain]!
                      .name,
                    25
                  )
                }}
              </div>

              <!-- item ID -->
              <div style="height: 50px; display: flex; align-items: center">
                <v-icon
                  size="40"
                  icon="mdi-identifier"
                  style="margin-left: 10px; padding-right: 10px"
                />
                {{ truncateString(item.item_id, 30) }}
              </div>

              <!-- link to web location of item (provider share link -->
              <div
                v-if="
                  item.provider_mappings[0].url &&
                    !item.provider.includes('file')
                "
                style="height: 50px; display: flex; align-items: center"
              >
                <v-icon
                  size="40"
                  icon="mdi-share-outline"
                  style="margin-left: 10px; padding-right: 5px"
                />
                <a
                  :href="item.provider_mappings[0].url"
                  target="_blank"
                >{{
                  truncateString(item.provider_mappings[0].url, 25)
                }}</a>
              </div>

              <!-- quality details -->
              <div style="height: 50px; display: flex; align-items: center">
                <img
                  height="30"
                  width="50"
                  :src="
                    getContentTypeIcon(item.provider_mappings[0].content_type)
                  "
                  :style="
                    $vuetify.theme.current.dark
                      ? 'object-fit: contain;'
                      : 'object-fit: contain;filter: invert(100%);'
                  "
                >
                {{ getQualityDesc(item.provider_mappings[0]) }}
              </div>

              <!-- track preview -->
              <div v-if="item.media_type == MediaType.TRACK">
                <div style="height: 50px; display: flex; align-items: center">
                  <v-icon
                    icon="mdi-headphones"
                    size="40"
                    style="margin-left: 10px; padding-right: 15px"
                  />
                  Preview
                </div>
                <div
                  style="
                    height: 50px;
                    display: flex;
                    align-items: center;
                    margin-left: 10px;
                    margin-right: 10px;
                  "
                  @mouseover="fetchPreviewUrl(item.provider, item.item_id)"
                >
                  <audio
                    controls
                    :src="previewUrls[`${item.provider}.${item.item_id}`]"
                  />
                </div>
              </div>
            </v-list>
          </v-card>
        </v-menu>

        <!-- menu button/icon -->
        <v-btn
          v-if="showMenu"
          icon="mdi-dots-vertical"
          variant="plain"
          style="position: absolute; right: -3px; width: 10px"
          @click.stop="emit('menu', item)"
        />
      </template>
    </v-list-item>
    <v-divider />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { VTooltip } from "vuetify/components";
import ProviderIcons from "./ProviderIcons.vue";
import MediaItemThumb from "./MediaItemThumb.vue";
import {
  iconHiRes,
  getProviderIcon,
  getContentTypeIcon,
  getQualityDesc,
} from "./ProviderIcons.vue";
import {
  ContentType,
  type BrowseFolder,
  type MediaItem,
  type MediaItemType,
} from "../plugins/api/interfaces";
import { api } from "../plugins/api";
import { MediaType } from "../plugins/api/interfaces";
import {
  formatDuration,
  parseBool,
  getArtistsString,
  getBrowseFolderName,
  truncateString,
} from "../utils";
import { useI18n } from "vue-i18n";

// properties
export interface Props {
  item: MediaItemType;
  showTrackNumber?: boolean;
  showProviders?: boolean;
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

const previewUrls = reactive<Record<string, string>>({});

const props = withDefaults(defineProps<Props>(), {
  showTrackNumber: true,
  showProviders: true,
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

const fetchPreviewUrl = async function (provider: string, item_id: string) {
  const key = `${provider}.${item_id}`;
  if (key in previewUrls) return;
  const url = await api.getTrackPreviewUrl(provider, item_id);
  previewUrls[key] = url;
};
</script>

<style scoped>

.unavailable {
  opacity: 50%
}
</style>