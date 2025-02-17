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
        :menu-items="menuItems"
        :enforce-overflow-menu="true"
        :show-loading="true"
        :icon-action="backButtonClick"
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
            <MarqueeText :sync="marqueeSync">
              {{ item.name }}
            </MarqueeText>
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
              <MarqueeText :sync="marqueeSync">
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
              </MarqueeText>
            </v-card-subtitle>

            <!-- audiobook author(s) -->
            <v-card-subtitle
              v-if="'authors' in item && item.authors.length > 0"
              class="title accent--text d-flex"
            >
              <v-icon
                style="margin-left: -3px; margin-right: 3px"
                small
                color="primary"
                icon="mdi-account-edit"
              />
              <MarqueeText :sync="marqueeSync">
                <span
                  v-for="(author, authorindex) in item.authors"
                  :key="author"
                >
                  <span style="color: accent">{{ author }}</span>
                  <span
                    v-if="authorindex + 1 < item.authors.length"
                    :key="authorindex"
                    style="color: accent"
                    >{{ " / " }}</span
                  >
                </span>
              </MarqueeText>
            </v-card-subtitle>

            <!-- audiobook narrator(s) -->
            <v-card-subtitle
              v-if="'narrators' in item && item.narrators.length > 0"
              class="title accent--text d-flex"
            >
              <v-icon
                style="margin-left: -3px; margin-right: 3px"
                small
                color="primary"
                icon="mdi-account-voice"
              />
              <MarqueeText :sync="marqueeSync">
                <span
                  v-for="(narrator, narratorIndex) in item.narrators"
                  :key="narrator"
                >
                  <span style="color: accent">{{ narrator }}</span>
                  <span
                    v-if="narratorIndex + 1 < item.narrators.length"
                    :key="narratorIndex"
                    style="color: accent"
                    >{{ " / " }}</span
                  >
                </span>
              </MarqueeText>
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
              <MarqueeText :sync="marqueeSync">
                <a style="color: primary">{{ item.owner }}</a>
              </MarqueeText>
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
              <MarqueeText :sync="marqueeSync">
                <a
                  style="color: secondary"
                  @click="albumClick((item as Track)?.album)"
                  >{{ item.album.name }}</a
                ></MarqueeText
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
              id="playbutton"
              :width="220"
              icon="mdi-play-circle-outline"
              :text="truncateString($t('play'), 14)"
              :disabled="!item"
              :open-menu-on-click="!store.activePlayer"
              @click="playButtonClick"
              @menu="playButtonClick(true)"
            />

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
import { getImageThumbForItem } from "./MediaItemThumb.vue";
import { useRouter } from "vue-router";
import {
  parseBool,
  markdownToHtml,
  truncateString,
  handlePlayBtnClick,
} from "@/helpers/utils";
import {
  ContextMenuItem,
  getContextMenuItems,
} from "@/layouts/default/ItemContextMenu.vue";
import Toolbar from "@/components/Toolbar.vue";
import MarqueeText from "./MarqueeText.vue";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import MenuButton from "./MenuButton.vue";

// properties
export interface Props {
  item?: MediaItemType;
}
const compProps = defineProps<Props>();
const showFullInfo = ref(false);
const fanartImage = ref();
const { mobile } = useDisplay();
const menuItems = ref<ContextMenuItem[]>([]);

const imgGradient = new URL("../assets/info_gradient.jpg", import.meta.url)
  .href;

const marqueeSync = new MarqueeTextSync();
const router = useRouter();

watch(
  () => compProps.item,
  async (val) => {
    if (val) {
      fanartImage.value =
        getImageThumbForItem(val, ImageType.FANART) ||
        getImageThumbForItem(val, ImageType.LANDSCAPE) ||
        getImageThumbForItem(val, ImageType.THUMB) ||
        imgGradient;
      menuItems.value = await getContextMenuItems([val], val);
    } else {
      fanartImage.value = imgGradient;
      menuItems.value = [];
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

const playButtonClick = function (forceMenu = false) {
  const playButton = document.getElementById("playbutton") as HTMLElement;
  console.log("playButton", playButton);
  handlePlayBtnClick(
    compProps.item!,
    playButton.getBoundingClientRect().left,
    playButton.getBoundingClientRect().top + 36,
    undefined,
    forceMenu,
  );
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
  return markdownToHtml(rawDescription.value);
});

const shortDescription = computed(() => {
  const maxChars = mobile.value ? 160 : 300;
  if (rawDescription.value.length > maxChars) {
    return fullDescription.value.substring(0, maxChars) + "...";
  }
  return fullDescription.value;
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
