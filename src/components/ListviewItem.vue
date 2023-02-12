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
        <div v-if="showCheckboxes" class="listitem-thumb">
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
          <div v-if="highResDetails" class="listitem-action">
            <div>
              <v-tooltip location="bottom">
                <template>
                  <IconBase
                    :height="'25px'"
                    :width="'45px'"
                    name="hiResAudio"
                  />
                </template>
                <span>{{ highResDetails }}</span>
              </v-tooltip>
            </div>
          </div>

          <!-- provider icons -->
          <div
            v-if="
              item.provider_ids &&
              showProviders &&
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_2
            "
            class="listitem-action"
          >
            <div>
              <ProviderIcons :provider-ids="item.provider_ids" />
            </div>
          </div>

          <!-- in library (heart) icon -->
          <div
            v-if="
              'in_library' in item &&
              showLibrary &&
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_1 &&
              showMenu
            "
            class="listitem-action"
          >
            <div>
              <v-tooltip location="bottom">
                <template #activator="{ props }">
                  <v-btn
                    :icon="item.in_library ? mdiHeart : mdiHeartOutline"
                    v-bind="props"
                    variant="plain"
                    @click="api.toggleLibrary(item)"
                    @click.prevent
                    @click.stop
                  ></v-btn>
                </template>
                <span>{{ $t('tooltip.library') }}</span>
              </v-tooltip>
            </div>
          </div>

          <!-- islinked icon -->
          <div
            v-if="
              parentItem &&
              parentItem.provider_ids.find((x) => x.item_id === item.item_id)
            "
            class="listitem-action"
          >
            <div>
              <v-tooltip location="bottom">
                <template #activator="{ props }">
                  <v-btn
                    :icon="mdiLinkVariant"
                    v-bind="props"
                    variant="plain"
                  ></v-btn>
                </template>
                <span>{{ $t('tooltip.linked') }}</span>
              </v-tooltip>
            </div>
          </div>

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
            <div>
              <span
                class="text-caption"
                style="padding-right: 10px; padding-left: 10px"
                >{{ formatDuration(item.duration) }}</span
              >
            </div>
          </div>
        </div>

        <v-menu
          v-if="showDetails"
          :close-on-content-click="false"
          location="top end"
          @click:outside.stop
        >
          <template #activator="{ props }">
            <div class="listitem-action">
              <v-btn
                :icon="mdiInformationOutline"
                v-bind="props"
                variant="plain"
              ></v-btn>
            </div>
          </template>

          <v-card class="mx-auto" width="300">
            <v-list>
              <v-list-item :min-height="5" class="list-item">
                <v-list-item-title class="text-h5 mb-1">
                  {{ $t('stream_details') }}
                </v-list-item-title>
              </v-list-item>
            </v-list>

            <v-divider></v-divider>

            <v-list>
              <!-- provider icon + name -->
              <v-list-item :min-height="40" :max-height="40" class="list-item">
                <template #prepend>
                  <IconBase
                    :height="'25px'"
                    :width="'45px'"
                    :name="getProviderIcon(item.provider)"
                  />
                </template>
                <v-list-item-title class="text-subtitle-1">
                  {{ $t('providers.' + item.provider) }}
                </v-list-item-title>
              </v-list-item>
              <!-- item ID -->
              <v-list-item :min-height="40" :max-height="40" class="list-item">
                <template #prepend>
                  <v-icon style="margin: 0px" size="40" :icon="mdiIdentifier" />
                </template>
                <v-list-item-title class="text-subtitle-1">
                  {{ item.item_id }}
                </v-list-item-title>
              </v-list-item>
              <!-- link to web location of item (provider share link -->
              <v-list-item
                v-if="
                  item.provider_ids[0].url && !item.provider.includes('file')
                "
                :min-height="40"
                :max-height="40"
                class="list-item"
              >
                <template #prepend>
                  <v-icon
                    style="margin: 0px"
                    size="35"
                    :icon="mdiShareOutline"
                  />
                </template>
                <v-list-item-title class="text-subtitle-1">
                  <a :href="item.provider_ids[0].url" target="_blank">{{
                    item.provider_ids[0].url
                  }}</a>
                </v-list-item-title>
              </v-list-item>
              <!-- quality details -->
              <v-list-item :min-height="40" :max-height="40" class="list-item">
                <template #prepend>
                  <IconBase
                    :height="'25px'"
                    :width="'45px'"
                    :name="getQualityIcon(item.provider_ids[0].quality)"
                  />
                </template>
                <v-list-item-title class="text-subtitle-1">
                  {{ getQualityDesc(item.provider_ids[0]) }}
                </v-list-item-title>
              </v-list-item>

              <!-- track preview -->
              <v-list-item
                v-if="item.media_type == MediaType.TRACK"
                :min-height="40"
                class="list-item"
              >
                <template #prepend>
                  <v-icon style="margin: 0px" size="30" :icon="mdiHeadphones" />
                </template>
                <v-list-item-title class="text-subtitle-1">
                  <div
                    style="height: 50px; align-items: center; margin-left: 10px"
                    @mouseover="fetchPreviewUrl(item.provider, item.item_id)"
                  >
                    <audio
                      controls
                      :src="previewUrls[`${item.provider}.${item.item_id}`]"
                    />
                  </div>
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>
        <!-- menu button/icon -->
        <div v-if="showMenu" class="listitem-action">
          <div>
            <v-tooltip location="bottom">
              <template #activator="{ props }">
                <v-btn
                  :icon="mdiDotsVertical"
                  v-bind="props"
                  variant="plain"
                  @click.stop="emit('menu', item)"
                ></v-btn>
              </template>
              <span>{{ $t('tooltip.library') }}</span>
            </v-tooltip>
          </div>
        </div>
      </template>
    </v-list-item>
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
