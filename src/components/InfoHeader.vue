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
        alt=""
        class="background-image"
        :src="fanartImage"
        :gradient="
          $vuetify.theme.current.dark
            ? 'to bottom, rgba(0,0,0,.90), rgba(0,0,0,.75)'
            : 'to bottom, rgba(255,255,255,.90), rgba(255,255,255,.75)'
        "
        :transition="false"
        eager
      />
      <!-- The details layout below is transformed, which gives it a stacking
           context, so the toolbar needs a rank to stay clickable above it. -->
      <Toolbar
        :icon="ArrowLeft"
        style="position: absolute; z-index: 1"
        :menu-items="menuItems"
        :enforce-overflow-menu="true"
        :icon-action="backButtonClick"
      >
        <template v-if="$slots['toolbar-append']" #append>
          <slot name="toolbar-append"></slot>
        </template>
      </Toolbar>
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
          <div
            v-else-if="
              item.media_type && item.media_type == MediaType.COLLECTION
            "
          >
            <MediaCollectionThumb
              :item="item as MediaCollection<MediaItemType>"
              size="calc(100%)"
              style="max-height: 256px"
            />
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
            :alt="$t('tooltip.artwork')"
            width="auto"
            height="80"
            style="padding-left: 10px"
          />
          <v-card-title
            v-else
            :class="{
              'title-with-steppers':
                $slots['title-prepend'] || $slots['title-append'],
            }"
          >
            <slot name="title-prepend"></slot>
            <!-- width auto overrides the marquee's full width, so the title
            takes only the space it needs and still shrinks (and scrolls) when
            the steppers leave it too little -->
            <MarqueeText
              :sync="marqueeSync"
              style="flex: 0 1 auto; width: auto; min-width: 0"
            >
              <div class="selectable">
                {{ headerTitle }}
              </div>
            </MarqueeText>
            <slot name="title-append"></slot>
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

            <!-- track release date -->
            <v-card-subtitle
              v-if="
                item.media_type == MediaType.TRACK &&
                item.metadata?.release_date
              "
              class="title d-flex"
            >
              <v-icon
                style="margin-left: -3px; margin-right: 3px"
                small
                color="primary"
                icon="mdi-calendar"
              />
              {{ new Date(item.metadata.release_date).getFullYear() }}
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

            <!-- album type and year -->
            <v-card-subtitle
              v-if="item.media_type == MediaType.ALBUM"
              class="caption"
            >
              <span
                v-if="'album_type' in item && item.album_type !== 'unknown'"
              >
                {{ $t("album_type." + item.album_type) }}
              </span>
              <span v-if="'year' in item && item.year">
                • {{ item.year }}
              </span>
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
                  v-for="(author, authorindex) in getAuthorsNarratorsArray(
                    item.authors,
                  )"
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
                  v-for="(narrator, narratorIndex) in getAuthorsNarratorsArray(
                    item.narrators,
                  )"
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
                <a style="color: secondary" @click="albumClick(item.album)">{{
                  item.album.name
                }}</a
                ><span v-if="'year' in item.album && item.album.year">
                  • {{ item.album.year }}</span
                ></MarqueeText
              >
            </v-card-subtitle>

            <!-- parent podcast of an episode -->
            <v-card-subtitle
              v-if="'podcast' in item && item.podcast"
              class="title d-flex"
            >
              <v-icon
                color="primary"
                style="margin-left: -3px; margin-right: 3px"
                small
                icon="mdi-podcast"
              />
              <MarqueeText :sync="marqueeSync">
                <a
                  style="color: secondary"
                  @click="podcastClick(item.podcast)"
                  >{{ item.podcast.name }}</a
                >
              </MarqueeText>
            </v-card-subtitle>

            <!-- publish date and length of an episode -->
            <v-card-subtitle v-if="episodeInfo" class="title d-flex">
              <template v-if="episodeInfo.date">
                <v-icon
                  color="primary"
                  style="margin-left: -3px; margin-right: 3px"
                  small
                  icon="mdi-calendar"
                />
                {{ episodeInfo.date }}
              </template>
              <template v-if="episodeInfo.duration">
                <v-icon
                  color="primary"
                  :style="`margin-left: ${
                    episodeInfo.date ? '14px' : '-3px'
                  }; margin-right: 3px`"
                  small
                  icon="mdi-clock-outline"
                />
                {{ episodeInfo.duration }}
              </template>
            </v-card-subtitle>

            <!-- Audiobook Collection -->
            <v-card-subtitle
              v-if="collectionMediaType === MediaType.AUDIOBOOK"
              class="title d-flex"
            >
              <v-icon
                style="margin-left: -3px; margin-right: 3px"
                small
                color="primary"
                icon="mdi-account-edit"
              />
              <MarqueeText :sync="marqueeSync">
                <span
                  v-for="(author, authorindex) in collectionArtists"
                  :key="author"
                >
                  <span style="color: accent">{{ author }}</span>
                  <span
                    v-if="authorindex + 1 < collectionArtists.length"
                    :key="authorindex"
                    style="color: accent"
                    >{{ " / " }}</span
                  >
                </span>
              </MarqueeText>
            </v-card-subtitle>
            <v-card-subtitle
              v-if="collectionMediaType === MediaType.AUDIOBOOK"
              class="title d-flex"
            >
              <v-icon
                style="margin-left: -3px; margin-right: 3px"
                small
                color="primary"
                icon="mdi-account-voice"
              />
              <MarqueeText :sync="marqueeSync">
                <span
                  v-for="(narrator, narratorIndex) in collectionNarrators"
                  :key="narrator"
                >
                  <span style="color: accent">{{ narrator }}</span>
                  <span
                    v-if="narratorIndex + 1 < collectionNarrators.length"
                    :key="narratorIndex"
                    style="color: accent"
                    >{{ " / " }}</span
                  >
                </span>
              </MarqueeText>
            </v-card-subtitle>
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
              :text="playButtonText"
              :disabled="!item"
              :loading="playActionInProgress"
              style="margin-right: 8px; margin-bottom: 4px"
              @click="playButtonClick"
              @menu="playButtonClick(true)"
            />

            <div
              v-if="item.media_type != MediaType.COLLECTION"
              class="flex items-center gap-2"
            >
              <!-- favorite (heart) icon; podcast episodes are never stored in
              the library, so they cannot be favorited -->
              <template v-if="item.media_type != MediaType.PODCAST_EPISODE">
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
              </template>
              <!-- details can be reached out of library context, so always show
              the membership badge (bookshelf when in library, else source) -->
              <provider-icon :domain="getProviderIconDomain(item)" :size="25" />
              <!-- audio analysis details (full track details only) -->
              <AudioAnalysisMetadata
                v-if="item.media_type == MediaType.TRACK"
                :audio-metadata="(item as Track).audio_metadata"
              />
              <!-- slot for extra action icons (e.g. smart playlist edit) -->
              <slot name="append-actions"></slot>
              <!-- merge genre button (admin only) -->
              <Merge
                v-if="
                  item.media_type === MediaType.GENRE &&
                  item.provider === 'library' &&
                  isAdmin
                "
                :size="22"
                class="cursor-pointer"
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
          <v-card-subtitle
            v-if="shortDescription || isPodcastEpisode"
            class="body-2 justify-left description-text"
            :class="{ 'description-fixed-lines': isPodcastEpisode }"
            style="padding-bottom: 10px; cursor: pointer"
            @click="onDescriptionClick"
          >
            <MarkdownText :text="shortDescription" />
          </v-card-subtitle>

          <!-- genres/tags -->
          <div
            v-if="mappedGenres.length"
            class="justify-center"
            style="margin-left: 15px; padding-bottom: 20px"
          >
            <v-chip
              v-for="genre of mappedGenres.slice(
                0,
                $vuetify.display.mobile ? 15 : 25,
              )"
              :key="genre.item_id"
              v-hold="(e: Event) => onHold(e, genre)"
              color="blue-grey lighten-1"
              style="margin-right: 5px; margin-bottom: 5px"
              small
              outlined
              class="cursor-pointer"
              @click="handleMediaItemClick(genre, 0, 0)"
              @click.capture="swallowClickAfterHold"
              @contextmenu.prevent="
                (e: MouseEvent) => showGenreChipContextMenu(e, genre)
              "
              @touchstart.passive="onTouchStart"
            >
              {{ genre.name }}
            </v-chip>
          </div>
        </div>
      </v-layout>
    </v-card>
    <Dialog v-if="!$slots['description-dialog']" v-model:open="showFullInfo">
      <DialogContent class="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{{ headerTitle }}</DialogTitle>
        </DialogHeader>
        <MarkdownText
          :text="rawDescription"
          class="max-w-none text-sm leading-relaxed"
          style="max-height: 60vh; overflow-y: auto"
        />
        <DialogFooter>
          <Button @click="showFullInfo = false">{{ $t("close") }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <slot
      name="description-dialog"
      :open="showFullInfo"
      :on-open-change="(v: boolean) => (showFullInfo = v)"
      :close="() => (showFullInfo = false)"
    ></slot>
  </div>
</template>

<script setup lang="ts">
import AudioAnalysisMetadata from "@/components/AudioAnalysisMetadata.vue";
import MarkdownText from "@/components/MarkdownText.vue";
import Toolbar from "@/components/Toolbar.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import { useUserPreferences } from "@/composables/userPreferences";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { MarqueeTextSync } from "@/helpers/marquee_text_sync";
import { backFromMediaDetails } from "@/helpers/navigation";
import {
  handleMediaItemClick,
  handlePlayBtnClick,
} from "@/helpers/media_item_actions";
import { parseBool } from "@/helpers/parse";
import {
  formatDuration,
  getAudiobookCollectionArtists,
  getAuthorsNarratorsArray,
  getImageThumbForItem,
  getPlayerName,
  stripBlankLines,
} from "@/helpers/utils";
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import {
  getCollectionMediaTypeFromItemId,
  getProviderIconDomain,
} from "@/plugins/api/helpers";
import type {
  Album,
  Artist,
  Audiobook,
  BrowseFolder,
  Genre,
  ItemMapping,
  MediaItemType,
  Podcast,
} from "@/plugins/api/interfaces";
import {
  ImageType,
  MediaCollection,
  MediaType,
  Track,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ArrowLeft, Merge, Trash2 } from "@lucide/vue";
import { IconHeart, IconHeartFilled } from "@tabler/icons-vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import MarqueeText from "./MarqueeText.vue";
import MediaCollectionThumb from "./MediaCollectionThumb.vue";
import MediaItemThumb from "./MediaItemThumb.vue";
import MenuButton from "./MenuButton.vue";
import ProviderIcon from "./ProviderIcon.vue";

// properties
export interface Props {
  // browse folders are listed, never opened in a details view
  item?: Exclude<MediaItemType, BrowseFolder>;
  sortBy?: string;
}
const compProps = defineProps<Props>();
const showFullInfo = ref(false);
const fanartImage = ref();
useDisplay();
const menuItems = ref<ContextMenuItem[]>([]);
const mappedGenres = ref<Genre[]>([]);

const imgGradient = new URL("../assets/info_gradient.jpg", import.meta.url)
  .href;

const marqueeSync = new MarqueeTextSync();
const router = useRouter();
const { getPreference } = useUserPreferences();

const headerTitle = computed(() => {
  if (!compProps.item) return "";
  return compProps.item.name;
});

const isPodcastEpisode = computed(
  () => !!compProps.item && "podcast" in compProps.item,
);

// publish date and length of a podcast episode, each shown behind its own icon
const episodeInfo = computed(() => {
  const item = compProps.item;
  if (!item || !("podcast" in item)) return undefined;
  const date = item.metadata?.release_date
    ? new Date(item.metadata.release_date).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "";
  const duration = item.duration ? formatDuration(item.duration) : "";
  if (!date && !duration) return undefined;
  return { date, duration };
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
      // Load mapped genres. Genres have none of their own, and podcast episodes
      // are never stored in the library so nothing can be mapped to them.
      if (
        ![MediaType.GENRE, MediaType.PODCAST_EPISODE].includes(val.media_type)
      ) {
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

// Watch shortcuts preference to update overflow menu when shortcuts change
const shortcutsPreference = getPreference<string[]>("sidebar.shortcuts", []);
watch(shortcutsPreference, async () => {
  if (compProps.item) {
    menuItems.value = await getContextMenuItems(
      [compProps.item],
      compProps.item,
    );
  }
});

const showGenreChipContextMenu = (evt: Event, genre: Genre) => {
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
  const pos = getEventPosition(evt);
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: pos.x,
    posY: pos.y,
  });
};

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(
  showGenreChipContextMenu,
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
const podcastClick = function (item: Podcast | ItemMapping) {
  // podcast entry clicked
  router.push({
    name: "podcast",
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};

const backButtonClick = function () {
  backFromMediaDetails(router);
};

// Resolve the queue playMedia targets directly, since activePlayerQueue is
// undefined while an external source is active.
const playActionInProgress = computed(() => {
  const player = store.activePlayer;
  if (!player) return false;
  const queueId =
    player.active_source && player.active_source in api.queues
      ? player.active_source
      : player.player_id;
  return (
    api.queues[queueId]?.extra_attributes?.play_action_in_progress === true
  );
});

const playButtonText = computed(() => {
  if (!store.activePlayer) return $t("play");
  return getPlayerName(store.activePlayer, 20);
});

const playButtonClick = function (forceMenu = false) {
  const playButton = document.getElementById("playbutton") as HTMLElement;
  const rect = playButton.getBoundingClientRect();

  handlePlayBtnClick(
    compProps.item!,
    rect.right,
    rect.bottom,
    undefined,
    forceMenu,
    compProps.sortBy,
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

const shortDescription = computed(() => {
  const maxChars = 800;
  // the banner is clamped to a few lines, so a blank line costs one of them
  const text = stripBlankLines(rawDescription.value);
  if (text.length > maxChars) {
    return text.substring(0, maxChars) + "…";
  }
  return text;
});

const onDescriptionClick = (event: MouseEvent) => {
  if (!rawDescription.value) return;
  // a link in the description opens on its own; don't also expand the text
  if ((event.target as HTMLElement).closest("a")) return;
  showFullInfo.value = !showFullInfo.value;
};

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
    genreContentTypes: [(compProps.item as Genre).content_type],
  });
};

const deleteGenre = () => {
  if (!compProps.item) return;
  eventbus.emit("deleteGenreDialog", {
    genreIds: [compProps.item.item_id],
    navigateBack: true,
  });
};

const collectionMediaType = computed(() => {
  if (compProps.item?.media_type != MediaType.COLLECTION)
    return MediaType.UNKNOWN;
  return getCollectionMediaTypeFromItemId(compProps.item.item_id);
});

const collectionArtists = computed(() => {
  if (collectionMediaType.value != MediaType.AUDIOBOOK) return [];

  return getAudiobookCollectionArtists(
    compProps.item as MediaCollection<Audiobook>,
    (book) => book.authors,
  );
});

const collectionNarrators = computed(() => {
  if (collectionMediaType.value != MediaType.AUDIOBOOK) return [];

  return getAudiobookCollectionArtists(
    compProps.item as MediaCollection<Audiobook>,
    (book) => book.narrators,
  );
});
</script>

<style scoped>
.selectable {
  -webkit-user-select: text;
  /* Safari */
  -khtml-user-select: text;
  /* Konqueror HTML */
  -moz-user-select: text;
  /* Old versions of Firefox */
  -ms-user-select: text;
  /* Internet Explorer/Edge */
  user-select: text;
  /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
}

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

/* the steppers sit either side of the title, which keeps the space between */
.title-with-steppers {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* episodes are stepped through in place, so their description holds the full
   clamp height and the lines above it stay put from one episode to the next */
.description-fixed-lines :deep(div) {
  line-height: 1.5;
  height: calc(5 * 1.5em);
}

@media (max-width: 1280px) {
  .description-fixed-lines :deep(div) {
    height: calc(3 * 1.5em);
  }
}

.description-text :deep(div) {
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
  .description-text :deep(div) {
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
}
</style>
