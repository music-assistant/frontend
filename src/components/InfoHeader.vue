<template>
  <div>
    <v-card
      variant="flat"
      :img="imgGradient"
      style="margin-top: -10px; z-index: 0"
      height="30vh"
      max-height="500px"
      min-height="340px"
    >
      <!-- loading animation -->
      <v-progress-linear v-if="!item" indeterminate />
      <v-img
        width="100%"
        height="100%"
        cover
        class="background-image"
        :src="fanartImage"
        :gradient="
          $vuetify.theme.current.dark
            ? 'to bottom, rgba(0,0,0,.90), rgba(0,0,0,.75)'
            : 'to bottom, rgba(255,255,255,.90), rgba(255,255,255,.75)'
        "
      />
      <v-layout
        v-if="item"
        style="
          margin: 0;
          position: absolute;
          top: 50%;
          -ms-transform: translateY(-50%);
          transform: translateY(-50%);
          padding-left: 15px;
          align-items: center;
          padding-right: 15px;
        "
      >
        <!-- left side: cover image -->
        <div
          v-if="!$vuetify.display.mobile"
          xs5
          pa-5
          style="width: 230px; height: 230px; margin-top: 15px; margin-bottom: 15px; margin-right: 24px"
        >
          <div v-if="item.media_type && (item.media_type == MediaType.ARTIST || 'owner' in item)">
            <v-avatar size="192">
              <MediaItemThumb :item="item" :height="230" :width="230" />
            </v-avatar>
          </div>
          <div v-else>
            <MediaItemThumb :width="230" :item="item" />
          </div>
        </div>

        <div>
          <!-- Main title -->
          <v-card-title>
            {{ item.name }}
          </v-card-title>

          <!-- other details -->
          <div style="padding-bottom: 10px">
            <!-- version -->
            <v-card-subtitle v-if="'version' in item && item.version" class="caption">
              {{ item.version }}
              <!-- explicit icon -->
              <v-tooltip location="bottom">
                <template #activator="{ props }">
                  <v-icon
                    v-if="parseBool(item.metadata.explicit || false)"
                    v-bind="props"
                    icon="mdi-alpha-e-box"
                    width="35"
                  />
                </template>
                <span>{{ $t('tooltip.explicit') }}</span>
              </v-tooltip>
            </v-card-subtitle>

            <!-- item artists -->
            <v-card-subtitle v-if="'artists' in item && item.artists" class="title accent--text">
              <v-icon style="margin-left: -3px; margin-right: 3px" small color="primary" icon="mdi-account-music" />
              <span v-for="(artist, artistindex) in item.artists" :key="artist.item_id">
                <a style="color: accent" @click="artistClick(artist)">{{ artist.name }}</a>
                <span v-if="artistindex + 1 < item.artists.length" :key="artistindex" style="color: accent">{{
                  ' / '
                }}</span>
              </span>
            </v-card-subtitle>

            <!-- album artist -->
            <v-card-subtitle v-if="'artist' in item && item.artist" class="title">
              <v-icon style="margin-left: -3px; margin-right: 3px" small color="primary" icon="mdi-account-music" />
              <a @click="artistClick((item as Album).artist)">{{ item.artist.name }}</a>
            </v-card-subtitle>

            <!-- playlist owner -->
            <v-card-subtitle v-if="'owner' in item && item.owner" class="title">
              <v-icon color="primary" style="margin-left: -3px; margin-right: 3px" small icon="mdi-account-music" />
              <a style="color: primary">{{ item.owner }}</a>
            </v-card-subtitle>

            <v-card-subtitle v-if="'album' in item && item.album">
              <v-icon color="primary" style="margin-left: -3px; margin-right: 3px" small icon="mdi-album" />
              <a style="color: secondary" @click="albumClick((item as Track)?.album)">{{ item.album.name }}</a>
            </v-card-subtitle>
          </div>

          <!-- play/info buttons -->
          <div style="display: flex; margin-left: 14px; padding-bottom: 10px">
            <!-- play button -->
            <v-btn
              color="primary"
              prepend-icon="mdi-play-circle"
              :disabled="!store.selectedPlayer?.available"
              @click="eventbus.emit('playdialog', { items: [item], parentItem: item, showContextMenuItems: false })"
            >
              {{ $t('play') }}
            </v-btn>
            <!-- contextmenu button -->
            <v-menu>
              <template #activator="{ props }">
                <Button icon style="margin-top: -8px" v-bind="props">
                  <v-icon icon="mdi-dots-vertical" />
                </Button>
              </template>
              <v-list>
                <ListItem
                  v-for="(menuItem, index) in getContextMenuItems([item], item).filter((x) => x.hide != true)"
                  :key="index"
                  :title="$t(menuItem.label, menuItem.labelArgs)"
                  :disabled="menuItem.disabled == true"
                  @click="menuItem.action ? menuItem.action() : ''"
                >
                  <template #prepend>
                    <v-avatar :icon="menuItem.icon" />
                  </template>
                </ListItem>
              </v-list>
            </v-menu>

            <!-- favorite (heart) icon -->
            <v-btn
              variant="plain"
              ripple
              :icon="item.favorite ? 'mdi-heart' : 'mdi-heart-outline'"
              size="x-large"
              style="margin-top: -14px"
              :title="$t('tooltip.favorite')"
              @click="api.toggleFavorite(item)"
              @click.prevent
              @click.stop
            />
            <!-- provider icon -->
            <provider-icon :domain="item.provider" :size="25" style="margin-top: 4px" />
          </div>

          <!-- Description/metadata -->
          <v-card-subtitle
            v-if="shortDescription"
            class="body-2 justify-left"
            style="padding-bottom: 10px; white-space: pre-line; cursor: pointer"
            @click="showFullInfo = !showFullInfo"
          >
            <!-- eslint-disable vue/no-v-html -->
            <div v-html="shortDescription"></div>
            <!-- eslint-enable vue/no-v-html -->
          </v-card-subtitle>

          <!-- genres/tags -->
          <div
            v-if="item && item.metadata.genres"
            class="justify-center"
            style="margin-left: 15px; padding-bottom: 20px"
          >
            <v-chip
              v-for="tag of item.metadata.genres.slice(0, $vuetify.display.mobile ? 15 : 25)"
              :key="tag"
              color="blue-grey lighten-1"
              style="margin-right: 5px; margin-bottom: 5px"
              small
              outlined
            >
              {{ tag }}
            </v-chip>
          </div>
        </div>
      </v-layout>
    </v-card>
    <v-dialog v-model="showFullInfo" max-width="975" width="auto">
      <v-card>
        <!-- eslint-disable vue/no-v-html -->
        <!-- eslint-disable vue/no-v-text-v-html-on-component -->
        <v-card-text v-html="fullDescription" />
        <!-- eslint-enable vue/no-v-html -->
        <!-- eslint-enable vue/no-v-text-v-html-on-component -->
        <v-card-actions>
          <v-btn color="primary" block @click="showFullInfo = false">
            {{ $t('close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from './ProviderIcon.vue';
import { store } from '@/plugins/store';
import { useDisplay } from 'vuetify';
import { api } from '@/plugins/api';
import { ImageType, Track, MediaType } from '@/plugins/api/interfaces';
import type { Album, Artist, ItemMapping, MediaItemType } from '@/plugins/api/interfaces';
import { computed, ref, watch } from 'vue';
import MediaItemThumb from './MediaItemThumb.vue';
import Button from './mods/Button.vue';
import { getImageThumbForItem } from './MediaItemThumb.vue';
import { useRouter } from 'vue-router';
import { parseBool } from '@/helpers/utils';
import { getContextMenuItems } from '@/helpers/contextmenu';
import ListItem from '@/components/mods/ListItem.vue';
import { useI18n } from 'vue-i18n';
import { eventbus } from '@/plugins/eventbus';

// properties
export interface Props {
  item?: MediaItemType;
}
const compProps = defineProps<Props>();
const showFullInfo = ref(false);
const fanartImage = ref();
const { mobile } = useDisplay();

const imgGradient = new URL('../assets/info_gradient.jpg', import.meta.url).href;

const router = useRouter();
const { t } = useI18n();

watch(
  () => compProps.item,
  async (val) => {
    if (val) {
      fanartImage.value =
        getImageThumbForItem(compProps.item, ImageType.FANART) || getImageThumbForItem(compProps.item, ImageType.THUMB);
    }
  },
  { immediate: true },
);

const albumClick = function (item: Album | ItemMapping) {
  // album entry clicked
  router.push({
    name: 'album',
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};
const artistClick = function (item: Artist | ItemMapping) {
  // album entry clicked
  router.push({
    name: 'artist',
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};
const fullDescription = computed(() => {
  let desc = '';
  if (!compProps.item) return '';
  if (compProps.item.metadata && compProps.item.metadata.description) {
    desc = compProps.item.metadata.description;
  } else if (compProps.item.metadata && compProps.item.metadata.copyright) {
    desc = compProps.item.metadata.copyright;
  } else if ('artists' in compProps.item) {
    compProps.item.artists.forEach(function (artist: Artist | ItemMapping) {
      if ('metadata' in artist && artist.metadata.description) {
        desc = artist.metadata.description;
      }
    });
  }
  desc = desc.replace('\r\n', '<br /><br /><br />');
  desc = desc.replace('\r', '<br /><br />');
  desc = desc.replace('\n', '<br /><br />');
  return desc;
});
const shortDescription = computed(() => {
  const maxChars = mobile.value ? 160 : 260;
  if (fullDescription.value.length > maxChars) {
    return fullDescription.value.substring(0, maxChars) + '...';
  }
  return fullDescription.value;
});
</script>

<style>
.background-image {
  position: absolute;
}

.background-image .v-img__img--cover {
  object-position: 50% 20%;
}
</style>
