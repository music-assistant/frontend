<template>
  <div>
    <div
      class="relative overflow-hidden"
      :style="{
        backgroundImage: `url(${imgGradient})`,
        backgroundSize: 'cover',
        zIndex: 0,
        borderRadius: '0px',
        height: '25vh',
        maxHeight: '500px',
        minHeight: '340px',
      }"
    >
      <!-- loading animation -->
      <div v-if="!item" class="h-1 w-full overflow-hidden rounded-full bg-primary/20">
        <div class="h-full w-1/3 rounded-full bg-primary animate-[indeterminate_1.5s_ease-in-out_infinite]" />
      </div>
      <div
        class="background-image absolute inset-0 w-full h-full"
        :style="{
          backgroundImage: fanartImage ? `url(${fanartImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: '50% 20%',
        }"
      >
        <div
          class="absolute inset-0"
          :style="{
            background: isDark
              ? 'linear-gradient(to bottom, rgba(0,0,0,.90), rgba(0,0,0,.75))'
              : 'linear-gradient(to bottom, rgba(255,255,255,.90), rgba(255,255,255,.75))',
          }"
        />
      </div>
      <Toolbar
        :icon="ArrowLeft"
        style="position: absolute; z-index: 999999"
        :menu-items="menuItems"
        :enforce-overflow-menu="true"
        :icon-action="backButtonClick"
      >
        <template v-if="$slots['toolbar-append']" #append>
          <slot name="toolbar-append"></slot>
        </template>
      </Toolbar>
      <div
        v-if="item"
        class="absolute flex items-center w-full px-4"
        style="top: 55%; transform: translateY(-50%)"
      >
        <!-- left side: cover image -->
        <div
          v-if="!isMobile"
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
            <div class="w-[210px] h-[210px] rounded-full overflow-hidden mb-[10%]">
              <MediaItemThumb :item="item" size="calc(100%)" />
            </div>
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
          <div v-else class="text-xl font-semibold px-4 py-1">
            <MarqueeText :sync="marqueeSync">
              <div class="selectable">
                {{ headerTitle }}
              </div>
            </MarqueeText>
          </div>

          <!-- other details -->
          <div style="padding-bottom: 10px">
            <!-- version -->
            <div
              v-if="'version' in item && item.version"
              class="text-sm text-muted-foreground px-4"
            >
              {{ item.version }}
              <!-- explicit icon -->
              <Tooltip v-if="parseBool(item.metadata.explicit || false)">
                <TooltipTrigger>
                  <ShieldAlert class="inline h-5 w-5" />
                </TooltipTrigger>
                <TooltipContent>
                  <span>{{ $t("tooltip.explicit") }}</span>
                </TooltipContent>
              </Tooltip>
            </div>

            <!-- track release date -->
            <div
              v-if="
                item.media_type == MediaType.TRACK &&
                item.metadata?.release_date
              "
              class="flex items-center text-sm text-muted-foreground px-4"
            >
              <Calendar
                class="h-4 w-4 -ml-0.5 mr-1 text-primary"
              />
              {{ new Date(item.metadata.release_date).getFullYear() }}
            </div>

            <!-- item artists -->
            <div
              v-if="'artists' in item && item.artists"
              class="flex items-center text-sm text-muted-foreground px-4"
            >
              <Mic2
                class="h-4 w-4 -ml-0.5 mr-1 text-primary shrink-0"
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
            </div>

            <!-- album type and year -->
            <div
              v-if="item.media_type == MediaType.ALBUM"
              class="text-sm text-muted-foreground px-4"
            >
              <span
                v-if="'album_type' in item && item.album_type !== 'unknown'"
              >
                {{ $t("album_type." + item.album_type) }}
              </span>
              <span v-if="'year' in item && item.year">
                • {{ item.year }}
              </span>
            </div>

            <!-- audiobook author(s) -->
            <div
              v-if="'authors' in item && item.authors.length > 0"
              class="flex items-center text-sm text-muted-foreground px-4"
            >
              <Pencil
                class="h-4 w-4 -ml-0.5 mr-1 text-primary shrink-0"
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
            </div>

            <!-- audiobook narrator(s) -->
            <div
              v-if="'narrators' in item && item.narrators.length > 0"
              class="flex items-center text-sm text-muted-foreground px-4"
            >
              <Mic2
                class="h-4 w-4 -ml-0.5 mr-1 text-primary shrink-0"
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
            </div>

            <!-- playlist owner -->
            <div
              v-if="'owner' in item && item.owner"
              class="flex items-center text-sm text-muted-foreground px-4"
            >
              <Mic2
                class="h-4 w-4 -ml-0.5 mr-1 text-primary shrink-0"
              />
              <MarqueeText :sync="marqueeSync">
                <a style="color: primary">{{ item.owner }}</a>
              </MarqueeText>
            </div>

            <div
              v-if="'album' in item && item.album"
              class="flex items-center text-sm text-muted-foreground px-4"
            >
              <Disc3
                class="h-4 w-4 -ml-0.5 mr-1 text-primary shrink-0"
              />
              <MarqueeText :sync="marqueeSync">
                <a
                  style="color: secondary"
                  @click="albumClick((item as Track)?.album)"
                  >{{ item.album.name }}</a
                ><span v-if="'year' in item.album && item.album.year">
                  • {{ item.album.year }}</span
                ></MarqueeText
              >
            </div>
          </div>

          <!-- play/info buttons -->
          <div
            style="
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-left: 14px;
              padding-bottom: 10px;
              align-items: center;
            "
          >
            <!-- play button with contextmenu -->
            <MenuButton
              id="playbutton"
              :width="220"
              icon="mdi-play-circle-outline"
              :text="truncateString($t('play'), 14)"
              :disabled="!item"
              :loading="
                store.activePlayerQueue &&
                store.activePlayerQueue.extra_attributes
                  ?.play_action_in_progress === true
              "
              :open-menu-on-click="!store.activePlayer"
              style="margin-right: 8px; margin-bottom: 4px"
              @click="playButtonClick"
              @menu="playButtonClick(true)"
            />

            <div class="flex items-center gap-2">
              <!-- favorite (heart) icon -->
              <IconHeartFilled
                v-if="item.favorite"
                :size="24"
                class="cursor-pointer"
                :title="$t('tooltip.favorite')"
                @click="api.toggleFavorite(item)"
              />
              <IconHeart
                v-else
                :stroke-width="2"
                :size="24"
                class="cursor-pointer"
                :title="$t('tooltip.favorite')"
                @click="api.toggleFavorite(item)"
              />
              <!-- provider icon -->
              <provider-icon :domain="item.provider" :size="25" />
              <!-- merge genre button (admin only) -->
              <Merge
                v-if="
                  item.media_type === MediaType.GENRE &&
                  item.provider === 'library' &&
                  isAdmin
                "
                :size="22"
                class="cursor-pointer -ml-1"
                :title="$t('merge_into')"
                @click="mergeGenre"
              />
              <!-- delete genre button (admin only) -->
              <Trash2
                v-if="
                  item.media_type === MediaType.GENRE &&
                  item.provider === 'library' &&
                  isAdmin
                "
                :size="22"
                class="cursor-pointer ml-2"
                :title="$t('delete_genre')"
                @click="deleteGenre"
              />
            </div>
          </div>
          <div
            v-if="$slots['after-play']"
            class="info-header-after-play"
            style="margin-left: 14px; padding-bottom: 10px"
          >
            <slot name="after-play"></slot>
          </div>
          <!-- Description/metadata -->
          <div
            v-if="shortDescription"
            class="text-sm text-muted-foreground px-4 description-text cursor-pointer"
            style="padding-bottom: 10px"
            @click="showFullInfo = !showFullInfo"
          >
            <!-- eslint-disable vue/no-v-html -->
            <div v-html="shortDescription"></div>
            <!-- eslint-enable vue/no-v-html -->
          </div>

          <!-- genres/tags -->
          <div
            v-if="mappedGenres.length"
            class="justify-center"
            style="margin-left: 15px; padding-bottom: 20px"
          >
            <Badge
              v-for="genre of mappedGenres.slice(
                0,
                isMobile ? 15 : 25,
              )"
              :key="genre.item_id"
              variant="outline"
              class="cursor-pointer mr-1.5 mb-1.5"
              @click="handleMediaItemClick(genre, 0, 0)"
              @contextmenu.prevent="
                (e: MouseEvent) => showGenreChipContextMenu(e, genre)
              "
            >
              {{
                getGenreDisplayName(genre.name, genre.translation_key, t, te)
              }}
            </Badge>
          </div>
        </div>
      </div>
    </div>
    <Dialog v-model:open="showFullInfo">
      <DialogContent class="max-w-[975px]">
        <!-- eslint-disable vue/no-v-html -->
        <div class="p-4" v-html="fullDescription" />
        <!-- eslint-enable vue/no-v-html -->
        <DialogFooter>
          <Button class="w-full" @click="showFullInfo = false">
            {{ $t("close") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Toolbar from "@/components/Toolbar.vue";
import { useIsDark } from "@/composables/useIsDark";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import {
  getGenreDescription,
  getGenreDisplayName,
  getImageThumbForItem,
  handleMediaItemClick,
  handlePlayBtnClick,
  markdownToHtml,
  parseBool,
  truncateString,
} from "@/helpers/utils";
import {
  ContextMenuItem,
  getContextMenuItems,
} from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import type {
  Album,
  Artist,
  Genre,
  ItemMapping,
  MediaItemType,
} from "@/plugins/api/interfaces";
import { ImageType, MediaType, Track } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { IconHeart, IconHeartFilled } from "@tabler/icons-vue";
import { ArrowLeft, Calendar, Disc3, Merge, Mic2, Pencil, ShieldAlert, Trash2 } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "@vueuse/core";
import { useRouter } from "vue-router";
import MarqueeText from "./MarqueeText.vue";
import MediaItemThumb from "./MediaItemThumb.vue";
import MenuButton from "./MenuButton.vue";
import ProviderIcon from "./ProviderIcon.vue";

// properties
export interface Props {
  item?: MediaItemType;
}
const compProps = defineProps<Props>();
const showFullInfo = ref(false);
const fanartImage = ref();
const { isDark } = useIsDark();
const isMobile = useMediaQuery("(max-width: 600px)");
const menuItems = ref<ContextMenuItem[]>([]);
const mappedGenres = ref<Genre[]>([]);

const imgGradient = new URL("../assets/info_gradient.jpg", import.meta.url)
  .href;

const marqueeSync = new MarqueeTextSync();
const router = useRouter();
const { t, te } = useI18n();

const headerTitle = computed(() => {
  if (!compProps.item) return "";
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
      // Load mapped genres for non-genre media items
      if (val.media_type !== MediaType.GENRE) {
        api
          .getGenresForMediaItem(val.media_type, val.item_id)
          .then((genres) => {
            mappedGenres.value = genres;
          })
          .catch(() => {
            mappedGenres.value = [];
          });
      } else {
        mappedGenres.value = [];
      }
    } else {
      fanartImage.value = imgGradient;
      menuItems.value = [];
      mappedGenres.value = [];
    }
  },
  { immediate: true },
);

const showGenreChipContextMenu = (evt: MouseEvent, genre: Genre) => {
  if (
    !compProps.item ||
    !isAdmin.value ||
    compProps.item.provider !== "library"
  )
    return;
  const mediaItem = compProps.item;
  const menuItems: ContextMenuItem[] = [
    {
      label: "exclude_genre",
      icon: "mdi-cancel",
      action: async () => {
        await api.excludeGenreFromItem(
          genre.item_id,
          mediaItem.media_type,
          mediaItem.item_id,
        );
        mappedGenres.value = mappedGenres.value.filter(
          (g) => g.item_id !== genre.item_id,
        );
        eventbus.emit("genreExcluded");
      },
    },
  ];
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: evt.clientX,
    posY: evt.clientY,
  });
};

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
    name: "discover",
  });
};

const playButtonClick = function (forceMenu = false) {
  const playButton = document.getElementById("playbutton") as HTMLElement;
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
  } else if (compProps.item.media_type === MediaType.GENRE) {
    return getGenreDescription(
      compProps.item.name,
      compProps.item.translation_key,
      t,
      te,
    );
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
  const maxChars = 800;
  if (rawDescription.value.length > maxChars) {
    return fullDescription.value.substring(0, maxChars) + "…";
  }
  return fullDescription.value;
});

const artistLogo = computed(() => {
  if (!compProps.item) return undefined;
  if (compProps.item.media_type != MediaType.ARTIST) return undefined;
  return getImageThumbForItem(compProps.item, ImageType.LOGO);
});

const isAdmin = computed(() => authManager.isAdmin());

const mergeGenre = () => {
  if (!compProps.item) return;
  eventbus.emit("mergeGenreDialog", {
    genreIds: [compProps.item.item_id],
    genreNames: [compProps.item.name],
  });
};

const deleteGenre = () => {
  if (!compProps.item) return;
  eventbus.emit("deleteGenreDialog", {
    genreIds: [compProps.item.item_id],
    navigateBack: true,
  });
};
</script>

<style scoped>
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.selectable {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

.description-text div {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
}

@media (max-width: 1280px) {
  .description-text div {
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
}
</style>
