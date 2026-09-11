<template>
  <header
    class="artist-hero"
    :class="{ 'artist-hero--phone': isPhone }"
    :style="heroStyle"
  >
    <div class="artist-hero__scrim"></div>
    <Toolbar
      class="artist-hero__toolbar"
      :icon="ArrowLeft"
      :icon-action="backButtonClick"
      :enforce-overflow-menu="true"
      :menu-items="menuItems"
    >
      <template #append>
        <button
          v-if="item"
          type="button"
          class="artist-hero__fav"
          :class="{ 'artist-hero__fav--on': item.favorite }"
          :aria-label="favoriteButtonLabel"
          :aria-pressed="item.favorite ? 'true' : 'false'"
          :title="favoriteButtonLabel"
          @click="api.toggleFavorite(item)"
        >
          <IconHeartFilled v-if="item.favorite" :size="20" />
          <IconHeart v-else :stroke-width="2" :size="20" />
        </button>
      </template>
    </Toolbar>

    <div v-if="!item" class="artist-hero__body">
      <Skeleton class="h-12 w-80 max-w-[60%]" />
    </div>
    <div v-else class="artist-hero__body">
      <div class="artist-hero__identity">
        <div v-if="chipsShown" class="artist-hero__chips">
          <span v-if="releaseCounts?.total" class="artist-hero__chip">
            <LibraryBig :size="12" />
            {{
              $t("releases_in_library", releaseCounts.total, {
                named: {
                  count: releaseCounts.inLibrary,
                  total: releaseCounts.total,
                },
              })
            }}
          </span>
          <span v-if="providers.length" class="artist-hero__chip">
            <template v-for="(provider, index) in providers" :key="provider.id">
              <span v-if="index > 0" class="artist-hero__chip-sep">·</span>
              <ProviderIcon :domain="provider.domain" :size="14" />
              {{ provider.name }}
            </template>
          </span>
        </div>

        <img
          v-if="artistLogo"
          class="artist-hero__logo"
          :src="artistLogo"
          :alt="item.name"
        />
        <h1 v-else class="artist-hero__name">{{ item.name }}</h1>

        <div v-if="genres.length" class="artist-hero__genres">
          <template v-for="(genre, index) in genres" :key="genre.item_id">
            <span v-if="index > 0">,&nbsp;</span>
            <button
              type="button"
              class="artist-hero__genre"
              @click="(e: MouseEvent) => genreClick(e, genre)"
            >
              {{ genre.name }}
            </button>
          </template>
        </div>
      </div>

      <div ref="actionsEl" class="artist-hero__actions">
        <MenuButton
          :text="playButtonText"
          :menu-button-label="`${$t('more_options')}: ${$t('play')}`"
          :loading="playActionInProgress"
          @click="playButtonClick()"
          @menu="playButtonClick(true)"
        />
        <button
          v-if="api.supportsPlayMediaShuffle"
          type="button"
          class="artist-hero__button"
          :aria-label="$t('shuffle')"
          :title="$t('shuffle')"
          @click="api.playMedia(item, undefined, { shuffle: true })"
        >
          <Shuffle :size="isPhone ? 18 : 16" />
          <span v-if="!isPhone">{{ $t("shuffle") }}</span>
        </button>
        <button
          v-if="radioRelevant(item)"
          type="button"
          class="artist-hero__button"
          :disabled="!radioSupported(item)"
          :aria-label="$t('artist_radio')"
          :title="$t('artist_radio')"
          @click="gotoRadio(item)"
        >
          <Radio :size="isPhone ? 18 : 16" />
          <span v-if="!isPhone">{{ $t("artist_radio") }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import MenuButton from "@/components/MenuButton.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import Toolbar from "@/components/Toolbar.vue";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserPreferences } from "@/composables/userPreferences";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  handleMediaItemClick,
  handlePlayBtnClick,
} from "@/helpers/media_item_actions";
import { backFromMediaDetails } from "@/helpers/navigation";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { getImageThumbForItem, getPlayerName } from "@/helpers/utils";
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import {
  ImageType,
  MediaType,
  type Artist,
  type Genre,
} from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ArrowLeft, LibraryBig, Radio, Rows3, Shuffle } from "@lucide/vue";
import { IconHeart, IconHeartFilled } from "@tabler/icons-vue";
import { computed, ref, useTemplateRef, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  item?: Artist;
  // the "N of M releases in your library" chip; omitted when unknown
  releaseCounts?: { inLibrary: number; total: number };
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const router = useRouter();
const menuItems = ref<ContextMenuItem[]>([]);
const genres = ref<Genre[]>([]);
const actionsEl = useTemplateRef<HTMLElement>("actionsEl");

const isPhone = computed(() => isPhoneSizedScreen());

const fanartImage = computed(() => {
  if (!props.item) return undefined;
  return (
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE) ||
    getImageThumbForItem(props.item, ImageType.THUMB)
  );
});

const heroStyle = computed(() =>
  fanartImage.value
    ? { backgroundImage: `url("${fanartImage.value}")` }
    : undefined,
);

const artistLogo = computed(() =>
  props.item ? getImageThumbForItem(props.item, ImageType.LOGO) : undefined,
);

// one entry per provider instance the artist is mapped to
const providers = computed(() => {
  const seen = new Set<string>();
  const entries: Array<{ id: string; domain: string; name: string }> = [];
  for (const mapping of props.item?.provider_mappings || []) {
    if (seen.has(mapping.provider_instance)) continue;
    seen.add(mapping.provider_instance);
    entries.push({
      id: mapping.provider_instance,
      domain: mapping.provider_domain,
      name:
        api.getProvider(mapping.provider_instance)?.name ||
        api.getProviderManifest(mapping.provider_domain)?.name ||
        mapping.provider_instance,
    });
  }
  return entries;
});

const chipsShown = computed(
  () => !!props.releaseCounts?.total || providers.value.length > 0,
);

const favoriteButtonLabel = computed(() =>
  props.item?.favorite ? $t("favorites_remove") : $t("favorites_add"),
);

const playButtonText = computed(() =>
  store.activePlayer
    ? $t("play_on_player", { player: getPlayerName(store.activePlayer, 20) })
    : $t("play"),
);

// The queue playMedia targets are resolved directly, since activePlayerQueue is
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

watch(
  () => props.item,
  async (item) => {
    buildMenu(item);
    if (!item) {
      genres.value = [];
      return;
    }
    const loaded = await api
      .getGenresForMediaItem(MediaType.ARTIST, item.item_id)
      .catch(() => [] as Genre[]);
    // a slower response for a previous artist must not replace the current one
    if (isShown(item)) genres.value = loaded;
  },
  { immediate: true },
);

// pinning or unpinning the artist in the sidebar changes its menu entry
const { getPreference } = useUserPreferences();
const shortcutsPreference = getPreference<string[]>("sidebar.shortcuts", []);
watch(shortcutsPreference, () => buildMenu(props.item));

const backButtonClick = function () {
  backFromMediaDetails(router);
};

const playButtonClick = function (forceMenu = false) {
  if (!props.item) return;
  const rect = actionsEl.value?.getBoundingClientRect();
  handlePlayBtnClick(
    props.item,
    rect?.right ?? 0,
    rect?.bottom ?? 0,
    undefined,
    forceMenu,
  );
};

const genreClick = function (event: MouseEvent, genre: Genre) {
  handleMediaItemClick(genre, event.clientX, event.clientY);
};

/** The artist's overflow menu, with the page's own "Edit rows" entry last. */
async function buildMenu(item?: Artist) {
  if (!item) {
    menuItems.value = [];
    return;
  }
  const items = await getContextMenuItems([item], item);
  if (!isShown(item)) return;
  menuItems.value = [
    ...items,
    { label: "edit_rows", icon: Rows3, action: () => emit("edit-rows") },
  ];
}

/** Whether the artist a request was made for is still the one on screen. */
function isShown(item: Artist): boolean {
  return props.item?.uri === item.uri;
}
</script>

<style scoped>
.artist-hero {
  position: relative;
  height: 440px;
  background-color: rgb(var(--v-theme-background));
  background-position: center 30%;
  background-repeat: no-repeat;
  background-size: cover;
  /* the artwork is darkened, so the hero keeps its light-on-dark text in both
     themes */
  color: #fff;
}
.artist-hero--phone {
  height: 340px;
}
/* two layers: the artwork is darkened so the hero's light-on-dark text reads in
   both themes, and only its very bottom blends into the page */
.artist-hero__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 96%,
      rgb(var(--v-theme-background)) 100%
    ),
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0.1) 30%,
      rgba(0, 0, 0, 0.55) 72%,
      rgba(0, 0, 0, 0.9) 100%
    );
}
.artist-hero--phone .artist-hero__scrim {
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 96%,
      rgb(var(--v-theme-background)) 100%
    ),
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0.05) 28%,
      rgba(0, 0, 0, 0.6) 70%,
      rgba(0, 0, 0, 0.92) 100%
    );
}
.artist-hero__toolbar {
  position: relative;
}

/* the toolbar controls sit on the artwork, so they get their own backdrop
   instead of the toolbar's transparent one */
.artist-hero :deep(.v-toolbar__prepend .v-btn),
.artist-hero :deep(.v-toolbar__append > button) {
  background-color: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  opacity: 1;
}
.artist-hero__fav {
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  border: 0;
  border-radius: 8px;
  color: currentColor;
  cursor: pointer;
  display: inline-flex;
  height: 40px;
  justify-content: center;
  padding: 0;
  width: 40px;
}
.artist-hero__fav--on {
  color: rgb(var(--v-theme-primary));
}
.artist-hero__fav:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.artist-hero__body {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 24px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}
.artist-hero__identity {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.artist-hero__chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.artist-hero__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.artist-hero__chip-sep {
  opacity: 0.4;
}
.artist-hero__logo {
  height: 80px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  object-position: left;
}
.artist-hero__name {
  margin: 0;
  font-size: 48px;
  font-weight: 500;
  letter-spacing: -1.2px;
  line-height: 1.05;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.artist-hero__genres {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* the genres read as links in the line of text, so the button chrome goes */
.artist-hero__genre {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  vertical-align: baseline;
  cursor: pointer;
}
.artist-hero__genre:hover {
  text-decoration: underline;
}
.artist-hero__genre:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}

.artist-hero__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.artist-hero__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.artist-hero__button:disabled {
  cursor: default;
  opacity: 0.5;
}
.artist-hero__button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.artist-hero--phone .artist-hero__body {
  left: 16px;
  right: 16px;
  bottom: 16px;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.artist-hero--phone .artist-hero__identity {
  gap: 12px;
}
.artist-hero--phone .artist-hero__name {
  font-size: 34px;
  letter-spacing: -0.8px;
}
.artist-hero--phone .artist-hero__logo {
  height: 56px;
}
.artist-hero--phone .artist-hero__actions {
  gap: 10px;
}
.artist-hero--phone .artist-hero__button {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 10px;
}
</style>
