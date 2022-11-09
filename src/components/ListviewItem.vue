<template>
  <div>
    <v-list-item
      ripple
      :disabled="!itemIsAvailable(item)"
      style="padding-right: 0px"
      @click.stop="emit('click', item)"
      @click.right.prevent="emit('menu', item)"
    >
      <template #prepend>
        <div v-if="showCheckboxes" class="listitem-thumb">
          <v-checkbox
            :model-value="isSelected"
            @click.stop
            @update:model-value="
              (x) => {
                emit('select', item, x);
              }
            "
          />
        </div>
        <div
          v-else-if="item.media_type == MediaType.FOLDER"
          class="listitem-thumb"
        >
          <v-btn :ripple="false" variant="plain" icon>
            <IconBase
              v-if="
                getProviderIcon(item.provider) != 'filesystem' ? true : false
              "
              :width="'35'"
              :height="'35'"
              :name="item.provider"
              style="align: center"
            />
            <v-icon v-else :icon="mdiFolder" size="60" style="align: center" />
          </v-btn>
        </div>
        <div v-else class="listitem-thumb">
          <MediaItemThumb :item="item" :size="50" />
        </div>
      </template>

      <template #default>
        <div style="padding-left: 10px">
          <v-list-item-subtitle v-if="showDate">Date</v-list-item-subtitle>
          <v-list-item-title class="line-clamp-1">
            <span v-if="item.media_type == MediaType.FOLDER">
              <span>{{ getBrowseFolderName(item as BrowseFolder, t) }}</span>
            </span>
            <span v-else>
              {{ item.name }}
              <span v-if="'version' in item && item.version"
                >({{ item.version }})</span
              >
            </span>
            <!-- explicit icon -->
            <v-tooltip location="bottom">
              <template #activator="{ props }">
                <v-icon
                  v-if="parseBool(item.metadata.explicit || false)"
                  v-bind="props"
                  class="listitem-action"
                  :icon="mdiAlphaEBox"
                />
              </template>
              <span>{{ $t('tooltip.explicit') }}</span>
            </v-tooltip>
          </v-list-item-title>
          <v-list-item-subtitle class="line-clamp-1">
            <!-- track: artists(s) + album -->
            <div
              v-if="
                item.media_type == MediaType.TRACK &&
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
                item.media_type == MediaType.ALBUM && item.artists && item.year
              "
            >
              {{ $t('album_type.' + item.album_type) }} •
              {{ getArtistsString(item.artists) }} • {{ item.year }}
            </div>
            <!-- album: albumtype + artists -->
            <div v-else-if="item.media_type == MediaType.ALBUM && item.artists">
              {{ $t('album_type.' + item.album_type) }} •
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
              v-if="
                item.media_type == MediaType.RADIO && item.metadata.description
              "
            >
              {{ item.metadata.description }}
            </div>
            <!-- remaining time - for example for podcast or audio books -->
          </v-list-item-subtitle>
          <v-slider
            v-if="showTimeline"
            hide-details
            max="100"
            min="0"
            :hide-spin-buttons="true"
            style="min-height: 0px; height: 20px"
            :thumb-size="0"
            :track-size="2"
            readonly
          >
            <template #append>
              <a class="text-caption">Remaining Time</a>
            </template>
          </v-slider>
        </div>
      </template>

      <!-- actions -->
      <template #append>
        <div class="listitem-actions">
          <!-- hi res icon -->
          <v-img
            v-if="highResDetails"
            class="listitem-action"
            :src="iconHiRes"
            width="35"
            :style="
              $vuetify.theme.current.dark
                ? 'margin-top:5px;'
                : 'margin-top:5px;filter: invert(100%);'
            "
          >
            <v-tooltip activator="parent" location="bottom">
              {{ highResDetails }}
            </v-tooltip>
          </v-img>

          <!-- provider icons -->
          <ProviderIcons
            v-if="
              item.provider_ids &&
              showProviders &&
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_2
            "
            :provider-ids="item.provider_ids"
            class="listitem-actions"
          />

          <!-- in library (heart) icon -->
          <div
            v-if="
              'in_library' in item &&
              showLibrary &&
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1
            "
            class="listitem-action"
          >
            <v-tooltip location="bottom">
              <template #activator="{ props }">
                <v-btn
                  variant="plain"
                  ripple
                  v-bind="props"
                  :icon="item.in_library ? mdiHeart : mdiHeartOutline"
                  @click="api.toggleLibrary(item)"
                  @click.prevent
                  @click.stop
                />
              </template>
              <span>{{ $t('tooltip.library') }}</span>
            </v-tooltip>
          </div>

          <!-- islinked icon -->
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-icon
                v-if="
                  parentItem &&
                  parentItem.provider_ids.find(
                    (x) => x.item_id === item.item_id
                  )
                "
                v-bind="props"
                class="listitem-action"
                :icon="mdiLinkVariant"
                size="30"
              />
            </template>
            <span>{{ $t('tooltip.linked') }}</span>
          </v-tooltip>

          <!-- track duration -->
          <div
            v-if="
              showDuration &&
              !showTimeline &&
              item.media_type == MediaType.TRACK &&
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1
            "
            class="listitem-action"
          >
            <span class="text-caption">{{
              formatDuration(item.duration)
            }}</span>
          </div>
        </div>

        <v-menu v-if="showDetails" location="bottom end" @click:outside.stop>
          <template #activator="{ props }">
            <v-icon
              :icon="mdiInformationOutline"
              size="30"
              class="listitem-action"
              style="margin-left: 10px; margin-right: 5px"
              v-bind="props"
            />
          </template>
          <v-card class="mx-auto" min-width="300">
            <v-list style="overflow: hidden">
              <span class="text-h5" style="padding: 10px">{{
                $t('provider_details')
              }}</span>
              <v-divider />
              <!-- provider icon + name -->
              <div style="height: 50px; display: flex; align-items: center">
                <IconBase
                  :height="'30px'"
                  :width="'50px'"
                  :name="getProviderIcon(item.provider)"
                />
                {{
                  truncateString(
                    api.providers[item.provider_ids[0].prov_id].name,
                    25
                  )
                }}
              </div>

              <!-- item ID -->
              <div style="height: 50px; display: flex; align-items: center">
                <v-icon
                  size="40"
                  :icon="mdiIdentifier"
                  style="margin-left: 10px; padding-right: 10px"
                />
                {{ truncateString(item.item_id, 30) }}
              </div>

              <!-- link to web location of item (provider share link -->
              <div
                v-if="
                  item.provider_ids[0].url && !item.provider.includes('file')
                "
                style="height: 50px; display: flex; align-items: center"
              >
                <v-icon
                  size="40"
                  :icon="mdiShareOutline"
                  style="margin-left: 10px; padding-right: 5px"
                />
                <a :href="item.provider_ids[0].url" target="_blank">{{
                  truncateString(item.provider_ids[0].url, 25)
                }}</a>
              </div>

              <!-- quality details -->
              <div style="height: 50px; display: flex; align-items: center">
                <IconBase
                  :height="'30px'"
                  :width="'50px'"
                  :name="getQualityIcon(item.provider_ids[0].quality)"
                />
                {{ getQualityDesc(item.provider_ids[0]) }}
              </div>

              <!-- track preview -->
              <div v-if="item.media_type == MediaType.TRACK">
                <div style="height: 50px; display: flex; align-items: center">
                  <v-icon
                    :icon="mdiHeadphones"
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
          :icon="mdiDotsVertical"
          variant="plain"
          @click.stop="emit('menu', item)"
        />
      </template>
    </v-list-item>

    <v-divider />
  </div>
</template>

<script setup lang="ts">
import {
  mdiHeart,
  mdiHeartOutline,
  mdiDotsVertical,
  mdiShareOutline,
  mdiAlphaEBox,
  mdiFolder,
  mdiInformationOutline,
  mdiHeadphones,
  mdiIdentifier,
  mdiLinkVariant,
} from '@mdi/js';
import { computed, reactive } from 'vue';
import { VTooltip } from 'vuetify/components';

import MediaItemThumb from './MediaItemThumb.vue';
import ProviderIcons, {
  iconHiRes,
  getProviderIcon,
  getQualityIcon,
  getQualityDesc,
} from './ProviderIcons.vue';
import type {
  BrowseFolder,
  MediaItem,
  MediaItemType,
  ProviderType,
} from '../plugins/api';
import { api, MediaQuality, MediaType } from '../plugins/api';
import {
  formatDuration,
  parseBool,
  getArtistsString,
  getBrowseFolderName,
  truncateString,
  getResponsiveBreakpoints,
} from '../utils';
import { useI18n } from 'vue-i18n';
import IconBase from './Icons/IconBase.vue';

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
  showTimeline?: boolean;
  showDate?: boolean;
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
  showTimeline: false,
  showDate: false,
});

// computed properties
const highResDetails = computed(() => {
  if (!props.item.provider_ids) return '';
  for (const prov of props.item.provider_ids) {
    if (!prov.quality) continue;
    if (prov.quality >= MediaQuality.LOSSLESS_HI_RES_1) {
      if (prov.details) {
        return prov.details;
      } else if (prov.quality === MediaQuality.LOSSLESS_HI_RES_1) {
        return '44.1/48khz 24 bits';
      } else if (prov.quality === MediaQuality.LOSSLESS_HI_RES_2) {
        return '88.2/96khz 24 bits';
      } else if (prov.quality === MediaQuality.LOSSLESS_HI_RES_3) {
        return '176/192khz 24 bits';
      } else {
        return '+192kHz 24 bits';
      }
    }
  }
  return '';
});

// emits
const emit = defineEmits<{
  (e: 'menu', value: MediaItemType): void;
  (e: 'click', value: MediaItemType): void;
  (e: 'select', value: MediaItemType, selected: boolean): void;
}>();

// methods

const itemIsAvailable = function (item: MediaItem) {
  if (item.media_type == MediaType.FOLDER) return true;
  if (!props.item.provider_ids) return true;
  for (const x of item.provider_ids) {
    if (x.available && x.prov_id in api.providers) return true;
  }
  return false;
};

const fetchPreviewUrl = async function (
  provider: ProviderType,
  item_id: string
) {
  const key = `${provider}.${item_id}`;
  if (key in previewUrls) return;
  const url = await api.getTrackPreviewUrl(provider, item_id);
  previewUrls[key] = url;
};
</script>

<style>
.v-slider.v-input--horizontal .v-input__control {
  min-height: 5px;
}
</style>
