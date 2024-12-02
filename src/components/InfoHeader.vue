<template>
  <div>
    <v-card
      variant="flat"
      :img="imgGradient"
      style="z-index: 0; border-radius: 0px"
      height="25vh"
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
      <Toolbar
        icon="mdi-arrow-left"
        style="position: absolute"
        :menu-items="item ? getContextMenuItems([item], item) : []"
        :enforce-overflow-menu="true"
        :show-loading="true"
        @icon-clicked="backButtonClick"
      />
      <v-layout
        v-if="item"
        style="
          margin: 0;
          top: 55%;
          -ms-transform: translateY(-50%);
          transform: translateY(-50%);
          padding-left: 15px;
          align-items: center;
          padding-right: 15px;
          display: flex;
          width: 100%;
        "
      >
        <!-- left side: cover image -->
        <div
          v-if="!$vuetify.display.mobile"
          xs5
          pa-5
          style="
            height: 80%;
            min-width: 230px;
            margin-top: 25px;
            margin-bottom: 15px;
            margin-right: 24px;
            align-content: center;
            flex-shrink: 0;
          "
        >
          <div v-if="item.media_type && item.media_type == MediaType.ARTIST">
            <v-avatar size="210" style="margin-bottom: 10%">
              <MediaItemThumb :item="item" size="calc(100%)" />
            </v-avatar>
          </div>
          <div v-else>
            <MediaItemThumb
              :item="item"
              size="calc(100%)"
              style="max-height: 256px"
            />
          </div>
        </div>

        <div style="min-width: 0">
          <!-- Main title -->
          <img
            v-if="artistLogo"
            :src="artistLogo"
            width="auto"
            height="80"
            style="padding-left: 10px"
          />
          <v-card-title v-else>
            {{ item.name }}
          </v-card-title>

          <!-- other details -->
          <div style="padding-bottom: 10px">
            <!-- version -->
            <v-card-subtitle
              v-if="'version' in item && item.version"
              class="caption"
            >
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
                <span>{{ $t("tooltip.explicit") }}</span>
              </v-tooltip>
            </v-card-subtitle>

            <!-- item artists -->
            <v-card-subtitle
              v-if="'artists' in item && item.artists"
              class="title accent--text d-flex"
            >
              <v-icon
                style="margin-left: -3px; margin-right: 3px"
                small
                color="primary"
                icon="mdi-account-music"
              />
              <span
                v-for="(artist, artistindex) in item.artists"
                :key="artist.item_id"
              >
                <a style="color: accent" @click="artistClick(artist)">{{
                  artist.name
                }}</a>
                <span
                  v-if="artistindex + 1 < item.artists.length"
                  :key="artistindex"
                  style="color: accent"
                  >{{ " / " }}</span
                >
              </span>
            </v-card-subtitle>

            <!-- playlist owner -->
            <v-card-subtitle
              v-if="'owner' in item && item.owner"
              class="title d-flex"
            >
              <v-icon
                color="primary"
                style="margin-left: -3px; margin-right: 3px"
                small
                icon="mdi-account-music"
              />
              <a style="color: primary">{{ item.owner }}</a>
            </v-card-subtitle>

            <v-card-subtitle
              v-if="'album' in item && item.album"
              class="d-flex"
            >
              <v-icon
                color="primary"
                style="margin-left: -3px; margin-right: 3px"
                small
                icon="mdi-album"
              />
              <a
                style="color: secondary"
                @click="albumClick((item as Track)?.album)"
                >{{ item.album.name }}</a
              >
            </v-card-subtitle>
          </div>

          <!-- play/info buttons -->
          <div
            style="
              display: flex;
              margin-left: 14px;
              padding-bottom: 10px;
              cursor: pointer !important;
            "
          >
            <!-- play button with contextmenu -->
            <MenuButton
              :width="220"
              icon="mdi-play-circle-outline"
              :text="truncateString($t('play'), 14)"
              :disabled="!item"
              :open-menu-on-click="!store.activePlayer"
              @click="api.playMedia(item!)"
            >
              <template #menu>
                <v-card width="320">
                  <v-list>
                    <v-list-item :title="item.name" link>
                      <template #prepend>
                        <v-avatar
                          ><MediaItemThumb :item="item" size="80"
                        /></v-avatar>
                      </template>
                      <template #title>
                        <v-list-item
                          variant="text"
                          :title="$t('play_on')"
                          :subtitle="
                            store.activePlayer?.display_name || $t('no_player')
                          "
                          @click.stop="store.showPlayersMenu = true"
                        />
                      </template>
                    </v-list-item>
                  </v-list>
                  <v-divider />
                  <v-list
                    density="compact"
                    slim
                    tile
                    :disabled="!store.activePlayer"
                  >
                    <div
                      v-for="menuItem of getPlayMenuItems([item], item)"
                      :key="menuItem.label"
                    >
                      <v-list-item
                        :title="$t(menuItem.label, menuItem.labelArgs || [])"
                        density="compact"
                        @click="menuItem.action"
                      >
                        <template #prepend>
                          <v-icon
                            style="padding-left: 15px"
                            :icon="menuItem.icon"
                          />
                        </template>
                      </v-list-item>
                    </div>
                  </v-list>
                </v-card>
              </template>
            </MenuButton>

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
            <provider-icon
              :domain="item.provider"
              :size="25"
              style="margin-top: 6px"
            />
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
              v-for="tag of item.metadata.genres.slice(
                0,
                $vuetify.display.mobile ? 15 : 25,
              )"
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
            {{ $t("close") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from "./ProviderIcon.vue";
import { store } from "@/plugins/store";
import { useDisplay } from "vuetify";
import { api } from "@/plugins/api";
import { ImageType, Track, MediaType } from "@/plugins/api/interfaces";
import type {
  Album,
  Artist,
  ItemMapping,
  MediaItemType,
} from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";
import MediaItemThumb from "./MediaItemThumb.vue";
import MenuButton from "./MenuButton.vue";
import { getImageThumbForItem } from "./MediaItemThumb.vue";
import { useRouter } from "vue-router";
import { truncateString, parseBool } from "@/helpers/utils";
import {
  getContextMenuItems,
  getPlayMenuItems,
} from "@/layouts/default/ItemContextMenu.vue";
import Toolbar from "@/components/Toolbar.vue";
import { useI18n } from "vue-i18n";

// properties
export interface Props {
  item?: MediaItemType;
}
const compProps = defineProps<Props>();
const showFullInfo = ref(false);
const fanartImage = ref();
const { mobile } = useDisplay();

const imgGradient = new URL("../assets/info_gradient.jpg", import.meta.url)
  .href;

const router = useRouter();
const { t } = useI18n();

watch(
  () => compProps.item,
  async (val) => {
    if (val) {
      fanartImage.value =
        getImageThumbForItem(compProps.item, ImageType.FANART) ||
        getImageThumbForItem(compProps.item, ImageType.LANDSCAPE) ||
        getImageThumbForItem(compProps.item, ImageType.THUMB) ||
        imgGradient;
    }
  },
  { immediate: true },
);

const albumClick = function (item: Album | ItemMapping) {
  // album entry clicked
  router.push({
    name: "album",
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};
const artistClick = function (item: Artist | ItemMapping) {
  // album entry clicked
  router.push({
    name: "artist",
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};

const backButtonClick = function () {
  // if we have stored routes, we can safely use history back
  if (store.prevRoute) {
    router.back();
    return;
  }
  // back to main listing for itemtype
  const curRoute = router.currentRoute.value.name?.toString() || "";
  for (const itemType of ["artist", "album", "track", "playlist", "radio"]) {
    if (curRoute.includes(itemType)) {
      router.push({
        name: `${itemType}s`,
      });
      return;
    }
  }
  router.push({
    name: "home",
  });
};

const rawDescription = computed(() => {
  if (!compProps.item) return "";
  if (compProps.item.metadata && compProps.item.metadata.description) {
    return compProps.item.metadata.description;
  } else if (compProps.item.metadata && compProps.item.metadata.copyright) {
    return compProps.item.metadata.copyright;
  } else if ("artists" in compProps.item) {
    compProps.item.artists.forEach(function (artist: Artist | ItemMapping) {
      if ("metadata" in artist && artist.metadata.description) {
        return artist.metadata.description;
      }
    });
  }
  return "";
});

const fullDescription = computed(() => {
  return rawDescription.value.replace(/(\r\n|\n|\r)/gm, "<br /><br />");
});
const shortDescription = computed(() => {
  const maxChars = mobile.value ? 160 : 300;
  if (rawDescription.value.length > maxChars) {
    return (
      rawDescription.value
        .replace(/(\r\n|\n|\r)/gm, " ")
        .substring(0, maxChars) + "..."
    );
  }
  return rawDescription.value.replace(/(\r\n|\n|\r)/gm, " ");
});

const artistLogo = computed(() => {
  if (!compProps.item) return undefined;
  if (compProps.item.media_type != MediaType.ARTIST) return undefined;
  return getImageThumbForItem(compProps.item, ImageType.LOGO);
});
</script>

<style scoped>
.background-image {
  position: absolute;
}

.background-image .v-img__img--cover {
  object-position: 50% 20%;
}
.v-card--variant-elevated {
  box-shadow: none;
  border-width: 1px;
  border-style: solid;
  font-size: smaller;
}
</style>
