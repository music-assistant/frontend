<template>
  <CommandDialog
    v-model:open="isOpen"
    :title="$t('search')"
    :description="$t('type_to_search')"
    :show-close-button="false"
    :focus-input-on-open="true"
    :content-class="[
      'command-center-content',
      mobileLayout
        ? 'command-center-content--mobile top-0 left-0 flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 sm:max-w-none'
        : 'top-[10%] flex translate-y-0 flex-col gap-0 sm:max-w-2xl',
    ]"
  >
    <div
      data-slot="command-input-wrapper"
      class="flex h-14 shrink-0 items-center gap-3 border-b px-4"
    >
      <Search class="size-5 shrink-0 opacity-50" />
      <ListboxFilter
        ref="filterRef"
        v-model="query"
        data-slot="command-input"
        auto-focus
        :placeholder="$t('type_to_search')"
        class="placeholder:text-muted-foreground flex h-12 w-full rounded-md bg-transparent py-3 text-base outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Spinner v-if="loading && queryActive" class="size-4 shrink-0" />
      <button
        v-if="mobileLayout"
        type="button"
        class="command-center-close"
        :aria-label="$t('close')"
        @click="close"
      >
        <X class="size-5" />
      </button>
    </div>

    <div
      class="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b px-4 py-2.5"
    >
      <button
        type="button"
        tabindex="-1"
        class="command-center-chip"
        :data-active="!selectedMediaTypes.length"
        @mousedown.prevent
        @click="selectedMediaTypes = []"
      >
        {{ $t("searchtype_all") }}
      </button>
      <button
        v-for="mediaType in SEARCHABLE_MEDIA_TYPES"
        :key="mediaType"
        type="button"
        tabindex="-1"
        class="command-center-chip"
        :data-active="selectedMediaTypes[0] === mediaType"
        @mousedown.prevent
        @click="toggleMediaType(mediaType)"
      >
        {{ $t(mediaType + "s") }}
      </button>
    </div>

    <CommandList
      ref="listRef"
      :class="
        mobileLayout
          ? 'min-h-0 max-h-none flex-1'
          : 'h-[min(480px,60vh)] max-h-none'
      "
    >
      <CommandGroup
        v-if="recentResults.length"
        :heading="$t('recent_searches')"
      >
        <CommandItem
          v-for="term in recentResults"
          :key="`recent:${term}`"
          :value="`recent:${term}`"
          class="py-2"
          @select="query = term"
        >
          <History class="size-4" />
          <span class="truncate">{{ term }}</span>
        </CommandItem>
      </CommandGroup>

      <div
        v-if="isSearching && !hasMediaResults"
        class="flex items-center justify-center py-14"
      >
        <Spinner class="text-muted-foreground size-6" />
      </div>

      <CommandGroup
        v-for="section in mediaSections"
        :key="section.mediaType"
        :heading="section.title"
      >
        <CommandItem
          v-for="item in section.items"
          :key="item.uri"
          :value="item.uri"
          class="gap-3 py-2"
          @select="onMediaSelect(item)"
        >
          <div class="relative size-10 shrink-0 overflow-hidden rounded-md">
            <MediaItemThumb :item="item" :size="40" />
          </div>
          <div class="flex min-w-0 flex-col">
            <span class="truncate">{{ item.name }}</span>
            <span class="text-muted-foreground truncate text-xs">
              {{ itemSubtitle(item) }}
            </span>
          </div>
          <div class="ml-auto flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              tabindex="-1"
              class="command-center-play"
              :aria-label="$t('play')"
              @mousedown.prevent
              @click.stop="onPlayClick(item, $event)"
            >
              <Play :size="14" fill="currentColor" :stroke-width="0" />
            </button>
            <ProviderIcon
              :domain="getListItemProviderIconDomain(item)"
              :size="18"
            />
          </div>
        </CommandItem>

        <button
          v-if="section.hasMore && !singleType"
          type="button"
          tabindex="-1"
          class="command-center-more"
          @mousedown.prevent
          @click="revealMore(section.mediaType)"
        >
          {{ $t("show_more") }}
        </button>
      </CommandGroup>

      <div
        v-if="
          singleType && hasMediaResults && (sectionsHaveMore || isSearching)
        "
        ref="revealSentinel"
        class="flex items-center justify-center py-6"
      >
        <Spinner class="text-muted-foreground size-5" />
      </div>

      <CommandGroup v-if="pageResults.length" :heading="$t('pages')">
        <CommandItem
          v-for="page in pageResults"
          :key="`page:${page.id}`"
          :value="`page:${page.id}`"
          class="py-2"
          @select="goToPage(page)"
        >
          <component :is="page.icon" class="size-4" />
          <span class="truncate">{{ page.title }}</span>
        </CommandItem>
      </CommandGroup>

      <CommandGroup v-if="playerResults.length" :heading="$t('players')">
        <CommandItem
          v-for="player in playerResults"
          :key="`player:${player.player_id}`"
          :value="`player:${player.player_id}`"
          class="py-2"
          @select="selectPlayer(player)"
        >
          <PlayerIcon :icon="player.icon" :size="16" />
          <span class="truncate">{{ getPlayerName(player) }}</span>
          <Check
            v-if="player.player_id === store.activePlayerId"
            class="ml-auto size-4"
          />
        </CommandItem>
      </CommandGroup>

      <p
        v-if="statusNote"
        class="text-muted-foreground py-10 text-center text-sm"
      >
        {{ statusNote }}
      </p>
    </CommandList>

    <div
      v-if="!mobileLayout"
      class="text-muted-foreground flex shrink-0 items-center gap-4 border-t px-4 py-2.5 text-xs"
    >
      <span class="flex items-center gap-1.5">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {{ $t("command_center_navigate") }}
      </span>
      <span class="flex items-center gap-1.5">
        <Kbd>↵</Kbd>
        {{ $t("command_center_open") }}
      </span>
      <span class="flex items-center gap-1.5">
        <Kbd>esc</Kbd>
        {{ $t("close") }}
      </span>
      <span class="ml-auto hidden items-center gap-1.5 sm:flex">
        <Kbd>{{ commandCenterHotkeyLabel }}</Kbd>
      </span>
    </div>
  </CommandDialog>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import {
  commandCenterHotkeyLabel,
  useCommandCenter,
} from "@/composables/useCommandCenter";
import { useOrderedPlayers } from "@/composables/useOrderedPlayers";
import {
  SEARCHABLE_MEDIA_TYPES,
  useProgressiveSearch,
} from "@/composables/useProgressiveSearch";
import { useUserPreferences } from "@/composables/userPreferences";
import { handlePlayBtnClick } from "@/helpers/media_item_actions";
import { getArtistsString, getPlayerName } from "@/helpers/utils";
import { getListItemProviderIconDomain } from "@/plugins/api/helpers";
import {
  MediaType,
  type MediaItemTypeOrItemMapping,
  type Player,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Check, History, Play, Search, X } from "@lucide/vue";
import { useIntersectionObserver } from "@vueuse/core";
import { ListboxFilter } from "reka-ui";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { getMenuItems, type MenuItem } from "./navigation/utils/getMenuItems";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const RESULTS_PER_TYPE = 5;
const RESULTS_SINGLE_PAGE = 20;
const FETCH_PER_TYPE = 15;
const FETCH_SINGLE_TYPE = 50;
const MAX_RECENT_SEARCHES = 5;
const RECENT_SEARCHES_PREF_KEY = "search.recent";

const router = useRouter();
const { isOpen, initialQuery, initialMediaTypes, open, close } =
  useCommandCenter();
const { getPreference, setPreference } = useUserPreferences();

const mobileLayout = computed(() => store.mobileLayout);

const query = ref("");
const selectedMediaTypes = ref<MediaType[]>([]);
const filterRef = ref<InstanceType<typeof ListboxFilter>>();
const listRef = ref<InstanceType<typeof CommandList>>();
const revealSentinel = ref<HTMLElement>();
const debouncePending = ref(false);
const revealedPerType = ref<Partial<Record<MediaType, number>>>({});
const revealedSingle = ref(RESULTS_SINGLE_PAGE);

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const { loading, search, filteredItems } = useProgressiveSearch({
  mediaTypes: selectedMediaTypes,
  limits: { single: FETCH_SINGLE_TYPE, multi: FETCH_PER_TYPE },
});

const queryActive = computed(
  () => query.value.trim().length >= MIN_QUERY_LENGTH,
);

const isSearching = computed(
  () => queryActive.value && (debouncePending.value || loading.value),
);

const singleType = computed(() =>
  selectedMediaTypes.value.length === 1
    ? selectedMediaTypes.value[0]
    : undefined,
);

const toggleMediaType = function (mediaType: MediaType) {
  selectedMediaTypes.value =
    selectedMediaTypes.value[0] === mediaType ? [] : [mediaType];
};

const dedupeKey = (item: MediaItemTypeOrItemMapping): string | null => {
  if (!item.name || item.media_type === MediaType.PLAYLIST) return null;
  const artist =
    "artists" in item ? item.artists[0]?.name.toLowerCase() || "" : "";
  return `${item.media_type}:${item.name.toLowerCase()}:${artist}`;
};

const mediaSections = computed(() => {
  if (!queryActive.value) return [];

  const single = singleType.value;
  const mediaTypes = single ? [single] : SEARCHABLE_MEDIA_TYPES;
  const sections: {
    mediaType: MediaType;
    title: string;
    items: MediaItemTypeOrItemMapping[];
    hasMore: boolean;
  }[] = [];

  for (const mediaType of mediaTypes) {
    const seen = new Set<string>();
    const items: MediaItemTypeOrItemMapping[] = [];
    for (const item of filteredItems(mediaType)) {
      const key = dedupeKey(item);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      items.push(item);
    }
    if (!items.length) continue;
    const revealed = single
      ? revealedSingle.value
      : (revealedPerType.value[mediaType] ?? RESULTS_PER_TYPE);
    sections.push({
      mediaType,
      title: $t(mediaType + "s"),
      items: items.slice(0, revealed),
      hasMore: items.length > revealed,
    });
  }
  return sections;
});

const sectionsHaveMore = computed(() =>
  mediaSections.value.some((section) => section.hasMore),
);

const revealMore = function (mediaType: MediaType) {
  revealedPerType.value = {
    ...revealedPerType.value,
    [mediaType]:
      (revealedPerType.value[mediaType] ?? RESULTS_PER_TYPE) + RESULTS_PER_TYPE,
  };
};

useIntersectionObserver(
  revealSentinel,
  ([entry]) => {
    if (!entry?.isIntersecting) return;
    if (!sectionsHaveMore.value) return;
    revealedSingle.value += RESULTS_SINGLE_PAGE;
  },
  { root: computed(() => listRef.value?.$el as HTMLElement | undefined) },
);

const hasMediaResults = computed(() =>
  mediaSections.value.some((section) => section.items.length),
);

const itemSubtitle = function (item: MediaItemTypeOrItemMapping) {
  const label = $t(item.media_type);
  const artists =
    "artists" in item && item.artists.length
      ? getArtistsString(item.artists)
      : "";
  return artists ? `${label} • ${artists}` : label;
};

const onMediaSelect = function (item: MediaItemTypeOrItemMapping) {
  recordRecentSearch();
  close();
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
  });
};

const onPlayClick = function (
  item: MediaItemTypeOrItemMapping,
  event: MouseEvent,
) {
  recordRecentSearch();
  close();
  handlePlayBtnClick(item, event.clientX, event.clientY);
};

const recentSearches = getPreference<string[]>(RECENT_SEARCHES_PREF_KEY, []);

const recentResults = computed(() => {
  if (queryActive.value) return [];

  const term = query.value.trim().toLowerCase();
  const recents = recentSearches.value.slice(0, MAX_RECENT_SEARCHES);

  if (!term) return recents;

  return recents.filter((recent) => recent.toLowerCase().includes(term));
});

const recordRecentSearch = function () {
  const term = query.value.trim();

  if (term.length < MIN_QUERY_LENGTH) return;

  const next = [
    term,
    ...recentSearches.value.filter(
      (existing) => existing.toLowerCase() !== term.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT_SEARCHES);
  setPreference(RECENT_SEARCHES_PREF_KEY, next);
};

const pageResults = computed(() => {
  if (selectedMediaTypes.value.length) return [];

  const pages = getMenuItems()
    .filter((item) => !item.hidden && !item.disabled && !item.action)
    .map((item) => ({ ...item, title: $t(item.label) }));
  const term = query.value.trim().toLowerCase();

  if (!term) return pages;

  return pages.filter((page) => page.title.toLowerCase().includes(term));
});

const goToPage = function (page: MenuItem) {
  close();
  router.push(page.path);
};

const orderedPlayers = useOrderedPlayers();

const playerResults = computed(() => {
  if (selectedMediaTypes.value.length) return [];
  const term = query.value.trim().toLowerCase();
  if (!term) return [];
  return orderedPlayers.value
    .filter((player) => player.name.toLowerCase().includes(term))
    .slice(0, 6);
});

const selectPlayer = function (player: Player) {
  store.activePlayerId = player.player_id;
  close();
};

const statusNote = computed(() => {
  const term = query.value.trim();
  if (!term) return "";
  if (queryActive.value) {
    if (hasMediaResults.value || isSearching.value) return "";
    if (!pageResults.value.length && !playerResults.value.length)
      return $t("no_content");
    return "";
  }

  if (
    !recentResults.value.length &&
    !pageResults.value.length &&
    !playerResults.value.length
  )
    return $t("command_center_keep_typing");
  return "";
});

const onKeydown = function (event: KeyboardEvent) {
  if (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.repeat &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();
    if (isOpen.value) {
      close();
    } else if (!store.dialogActive) {
      open();
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  clearTimeout(debounceTimer);
  if (isOpen.value) {
    store.dialogActive = false;
    close();
  }
});

watch(isOpen, (opened) => {
  store.dialogActive = opened;
  if (opened) {
    selectedMediaTypes.value = [...initialMediaTypes.value];
    query.value = initialQuery.value;
    return;
  }
  clearTimeout(debounceTimer);
  query.value = "";
  selectedMediaTypes.value = [];
  search("");
});

watch(
  () => `${query.value}|${selectedMediaTypes.value.join(",")}`,
  () => {
    revealedPerType.value = {};
    revealedSingle.value = RESULTS_SINGLE_PAGE;
  },
);

watch(query, () => {
  clearTimeout(debounceTimer);
  const trimmed = query.value.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    debouncePending.value = false;
    search("");
    return;
  }
  debouncePending.value = true;
  debounceTimer = setTimeout(() => {
    debouncePending.value = false;
    search(trimmed);
  }, DEBOUNCE_MS);
});

watch(
  () =>
    mediaSections.value.map((section) => section.items[0]?.uri ?? "").join("|"),
  async () => {
    if (!isOpen.value || !queryActive.value) return;
    await nextTick();
    const listEl = listRef.value?.$el as HTMLElement | undefined;
    const inputEl = filterRef.value?.$el as HTMLElement | undefined;
    if (!listEl || !inputEl) return;
    if (listEl.querySelector("[data-highlighted]")) return;
    inputEl.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  },
);
</script>

<style scoped>
.command-center-close {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--muted-foreground);
  cursor: pointer;
}

.command-center-more {
  display: block;
  width: fit-content;
  margin: 4px auto 6px;
  padding: 0;
  border: none;
  background: none;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.command-center-more:hover {
  color: var(--foreground);
}

.command-center-chip {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.75rem;
  line-height: 1.25;
  white-space: nowrap;
  color: var(--muted-foreground);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.command-center-chip:hover {
  color: var(--foreground);
}

.command-center-chip[data-active="true"] {
  background: var(--primary);
  border-color: transparent;
  color: var(--primary-foreground);
}

.command-center-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

[data-highlighted] .command-center-play {
  opacity: 1;
}

@media (hover: none) {
  .command-center-play {
    opacity: 1;
  }
}
</style>

<style>
.command-center-content--mobile {
  padding-top: var(--device-inset-top);
  padding-right: var(--device-inset-right);
  padding-bottom: var(--device-inset-bottom);
  padding-left: var(--device-inset-left);
}
</style>
