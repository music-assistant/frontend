<template>
  <CommandCenterShell
    v-model:open="isOpen"
    :title="$t('search')"
    :description="$t('type_to_search')"
  >
    <div
      data-slot="command-input-wrapper"
      class="flex h-14 shrink-0 items-center gap-3 border-b px-4"
      @keydown.enter.capture="onEnterKey"
    >
      <Search class="size-5 shrink-0 opacity-50" />
      <ListboxFilter
        ref="filterRef"
        v-model="query"
        data-slot="command-input"
        auto-focus
        enterkeyhint="search"
        :placeholder="$t('type_to_search')"
        class="placeholder:text-muted-foreground flex h-12 w-full rounded-md bg-transparent py-3 text-base outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Spinner v-if="isSearching" class="size-4 shrink-0" />
      <button
        v-if="query"
        type="button"
        tabindex="-1"
        class="command-center-clear"
        @mousedown.prevent
        @click="clearQuery"
      >
        {{ $t("clear") }}
      </button>
      <Button
        v-if="!pagesOnly"
        variant="default"
        size="sm"
        :disabled="!queryActive"
        :aria-label="$t('search')"
        @mousedown.prevent
        @click="runSearch"
      >
        {{ $t("search") }}
      </Button>
    </div>

    <div
      class="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b px-4 py-2.5"
    >
      <button
        type="button"
        tabindex="-1"
        class="command-center-chip"
        :data-active="!selectedMediaTypes.length && !pagesOnly"
        @mousedown.prevent
        @click="selectAllScope"
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
      <button
        type="button"
        tabindex="-1"
        class="command-center-chip"
        :data-active="pagesOnly"
        @mousedown.prevent
        @click="togglePagesOnly"
      >
        {{ $t("pages") }}
      </button>
      <DropdownMenu v-if="sourcesPickable">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="ml-auto shrink-0"
            :aria-label="sourcesLabel"
            :title="sourcesLabel"
          >
            <SlidersHorizontal
              :class="{ 'text-primary': selectedProviders.length }"
            />
            {{ $t("search_sources") }}
          </Button>
        </DropdownMenuTrigger>
        <!-- above the desktop dialog (9999) and the mobile sheet (998) it opens from -->
        <DropdownMenuContent
          align="end"
          class="z-[10000] min-w-56"
          @close-auto-focus="focusInputOnClose"
        >
          <DropdownMenuLabel>{{ $t("search_sources") }}</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            :model-value="!selectedProviders.length"
            @select="(event) => event.preventDefault()"
            @update:model-value="setSources([])"
          >
            {{ $t("all_sources") }}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            v-for="target in sourceTargets"
            :key="target.id"
            :model-value="selectedProviders.includes(target.id)"
            @select="(event) => event.preventDefault()"
            @update:model-value="toggleSource(target.id)"
          >
            <ProviderIcon :domain="target.iconDomain" :size="16" />
            {{ target.name }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <CommandList
      ref="listRef"
      :class="
        mobileLayout
          ? 'min-h-0 max-h-none flex-1'
          : 'h-[min(660px,calc(84vh-150px))] max-h-none'
      "
      @scroll.passive="onListScroll"
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
          @select="applyRecent(term)"
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
          v-hold="(evt: Event) => onHold(evt, item)"
          :value="item.uri"
          class="gap-3 py-2"
          @select="onMediaSelect(item)"
          @contextmenu.prevent="onMediaMenu($event, item)"
          @click.capture="swallowClickAfterHold"
          @touchstart.passive="onTouchStart"
        >
          <div
            class="command-center-thumb relative size-10 shrink-0 overflow-hidden rounded-md"
            @click="onThumbClick(item, $event)"
          >
            <MediaItemThumb :item="item" :size="40" />
            <span
              v-if="!isTouch"
              class="command-center-play"
              aria-hidden="true"
            >
              <Play class="size-3.5" fill="currentColor" :stroke-width="0" />
            </span>
          </div>
          <div class="flex min-w-0 flex-col">
            <span class="truncate">{{ item.name }}</span>
            <span class="text-muted-foreground truncate text-xs">
              {{ itemSubtitle(item) }}
            </span>
          </div>
          <div class="ml-auto flex shrink-0 items-center gap-2.5">
            <ProviderIcon
              :domain="getListItemProviderIconDomain(item)"
              :size="18"
            />
            <button
              v-if="isTouch"
              type="button"
              tabindex="-1"
              class="command-center-play-mobile"
              :aria-label="$t('play')"
              @click.stop="onPlayClick(item, $event)"
            >
              <Play class="size-2.5" fill="currentColor" :stroke-width="0" />
            </button>
            <button
              type="button"
              tabindex="-1"
              class="command-center-menu"
              :aria-label="`${$t('more_options')}: ${item.name}`"
              @mousedown.prevent
              @click.stop="onMediaMenu($event, item)"
            >
              <EllipsisVertical :size="16" />
            </button>
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
        {{ enterHintLabel }}
      </span>
      <span class="flex items-center gap-1.5">
        <Kbd>esc</Kbd>
        {{ $t("close") }}
      </span>
      <span class="ml-auto hidden items-center gap-1.5 sm:flex">
        <Kbd>{{ commandCenterHotkeyLabel }}</Kbd>
      </span>
    </div>
  </CommandCenterShell>
</template>

<script setup lang="ts">
import CommandCenterShell from "@/components/CommandCenterShell.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import {
  commandCenterHotkeyLabel,
  useCommandCenter,
} from "@/composables/useCommandCenter";
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import { useOrderedPlayers } from "@/composables/useOrderedPlayers";
import {
  LIBRARY_SEARCH_TARGET,
  SEARCHABLE_MEDIA_TYPES,
  useProgressiveSearch,
} from "@/composables/useProgressiveSearch";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/media_item_actions";
import { getArtistsString, getPlayerName } from "@/helpers/utils";
import { getListItemProviderIconDomain } from "@/plugins/api/helpers";
import {
  MediaType,
  type MediaItemTypeOrItemMapping,
  type Player,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  Check,
  EllipsisVertical,
  History,
  Play,
  Search,
  SlidersHorizontal,
} from "@lucide/vue";
import { useIntersectionObserver, useMediaQuery } from "@vueuse/core";
import { ListboxFilter } from "reka-ui";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getMenuItems, type MenuItem } from "./navigation/utils/getMenuItems";

const MIN_QUERY_LENGTH = 2;
const RESULTS_PER_TYPE = 5;
const RESULTS_SINGLE_PAGE = 20;
const FETCH_PER_TYPE = 15;
const FETCH_SINGLE_TYPE = 50;
const MAX_RECENT_SEARCHES = 5;
const RECENT_SEARCHES_PREF_KEY = "search.recent";
const SOURCES_PREF_KEY = "search.sources";

const router = useRouter();
const route = useRoute();
const { isOpen, initialQuery, initialMediaTypes, initialSeeded, open, close } =
  useCommandCenter();
const { getPreference, setPreference } = useUserPreferences();

const mobileLayout = computed(() => store.mobileLayout);
// touch devices can't hover, so they get an explicit play button on the right
// rather than the play-over-artwork reveal that hover-capable devices use
const isTouch = useMediaQuery("(hover: none)");

const query = ref("");
const selectedMediaTypes = ref<MediaType[]>([]);
const pagesOnly = ref(false);
const filterRef = ref<InstanceType<typeof ListboxFilter>>();
const listRef = ref<InstanceType<typeof CommandList>>();
const revealSentinel = ref<HTMLElement>();
const revealedPerType = ref<Partial<Record<MediaType, number>>>({});
const revealedSingle = ref(RESULTS_SINGLE_PAGE);
// the results scroll offset, kept so reopening returns to where you were
const savedScrollTop = ref(0);

// the sources to search, remembered per user; empty = the library and every
// provider (the composable drops ids of providers that no longer exist)
const savedSources = getPreference<string[]>(SOURCES_PREF_KEY, []);

const {
  loading,
  search,
  filteredItems,
  activeSearchTerm,
  providerTargets,
  selectedProviders,
} = useProgressiveSearch({
  mediaTypes: selectedMediaTypes,
  providers: computed(() =>
    Array.isArray(savedSources.value) ? savedSources.value : [],
  ),
  limits: { single: FETCH_SINGLE_TYPE, multi: FETCH_PER_TYPE },
});

const queryActive = computed(
  () => query.value.trim().length >= MIN_QUERY_LENGTH,
);

// the fetched results belong to the last submitted term; while the box holds a
// different term (typed but not searched yet) those results stay hidden
const resultsMatchQuery = computed(
  () =>
    activeSearchTerm.value.length >= MIN_QUERY_LENGTH &&
    query.value.trim().toLowerCase() === activeSearchTerm.value.toLowerCase(),
);

// only the submitted term drives the loading UI; a term typed over a still
// pending search shows the submit prompt, not the old search's spinner
const isSearching = computed(() => resultsMatchQuery.value && loading.value);

// the footer's return-key hint reflects what enter does now: submit a typed
// term (never in the Pages scope, where enter opens the highlighted page), or
// open the highlighted result once one is up
const enterHintLabel = computed(() =>
  !pagesOnly.value && queryActive.value && !resultsMatchQuery.value
    ? $t("command_center_search")
    : $t("command_center_open"),
);

const singleType = computed(() =>
  selectedMediaTypes.value.length === 1
    ? selectedMediaTypes.value[0]
    : undefined,
);

const toggleMediaType = function (mediaType: MediaType) {
  pagesOnly.value = false;
  selectedMediaTypes.value =
    selectedMediaTypes.value[0] === mediaType ? [] : [mediaType];
};

const selectAllScope = function () {
  pagesOnly.value = false;
  selectedMediaTypes.value = [];
};

const togglePagesOnly = function () {
  pagesOnly.value = !pagesOnly.value;
  if (pagesOnly.value) selectedMediaTypes.value = [];
};

// search runs on demand (the button or the return key), not while typing
const runSearch = function () {
  const trimmed = query.value.trim();
  if (pagesOnly.value || trimmed.length < MIN_QUERY_LENGTH) {
    search("");
    return;
  }
  search(trimmed);
};

const onListScroll = function (event: Event) {
  if (isOpen.value)
    savedScrollTop.value = (event.target as HTMLElement).scrollTop;
};

const scrollResultsToTop = function () {
  savedScrollTop.value = 0;
  const el = listRef.value?.$el as HTMLElement | undefined;
  if (el) el.scrollTop = 0;
};

// the sources on offer, the library first
const sourceTargets = computed(() => [
  { id: LIBRARY_SEARCH_TARGET, name: $t("library"), iconDomain: "library" },
  ...providerTargets.value,
]);

// pages come from the menu and genres from the library alone, so neither
// search has sources to pick from
const sourcesPickable = computed(
  () =>
    providerTargets.value.length > 0 &&
    !pagesOnly.value &&
    singleType.value !== MediaType.GENRE,
);

const sourcesLabel = computed(() => {
  const names = sourceTargets.value
    .filter((target) => selectedProviders.value.includes(target.id))
    .map((target) => target.name);
  return names.length
    ? `${$t("search_sources")}: ${names.join(", ")}`
    : $t("search_sources");
});

const setSources = function (ids: string[]) {
  if (ids.join(",") === selectedProviders.value.join(",")) return;
  setPreference(SOURCES_PREF_KEY, ids);
};

const toggleSource = function (id: string) {
  const current = selectedProviders.value;
  setSources(
    current.includes(id)
      ? current.filter((existing) => existing !== id)
      : [...current, id],
  );
};

const clearQuery = function () {
  query.value = "";
  focusInput();
};

const focusInput = function () {
  const inputEl = filterRef.value?.$el as HTMLElement | undefined;
  inputEl?.focus();
};

// the menu would otherwise hand focus back to its trigger button
const focusInputOnClose = function (event: Event) {
  event.preventDefault();
  focusInput();
};

// The return key submits the search. Once the results are up for the box, it
// falls through to reka so it opens the highlighted result. A typed but
// unsubmitted query searches instead — even if it happens to match a page or
// player name: reka auto-highlights the first row on every keystroke, so a
// highlighted row is not a deliberate pick. The exception is the Pages scope,
// where the rows are the only action and there is no search to run, so enter
// opens the highlighted page. On the mobile sheet it also puts the on-screen
// keyboard away and never lets reka click a row nobody meant to select. The
// enter is settled here on the wrapper before it can reach the input.
const onEnterKey = function (event: KeyboardEvent) {
  // the enter that commits an IME conversion belongs to the composition, not
  // to us; keyCode 229 covers webkit reporting that keydown as not composing
  if (event.isComposing || event.keyCode === 229) return;
  // the wrapper also hears enter from the toolbar buttons (search sources, the
  // search button); only the input's own enter drives a search
  const inputEl = filterRef.value?.$el as HTMLElement | undefined;
  if (!inputEl || !inputEl.contains(event.target as Node)) return;

  const touchSheet = store.isTouchscreen && store.mobileLayout;
  const listEl = listRef.value?.$el as HTMLElement | undefined;
  const openHighlighted =
    pagesOnly.value && !!listEl?.querySelector("[data-highlighted]");

  // nothing to search (too short a term), a search is already up, or a page is
  // highlighted: leave enter to reka so it opens the highlighted row (recent
  // search, page or result); the touch sheet only settles the keyboard
  if (!queryActive.value || resultsMatchQuery.value || openHighlighted) {
    if (!touchSheet) return;
    event.stopPropagation();
    event.preventDefault();
    inputEl.blur();
    return;
  }

  event.stopPropagation();
  event.preventDefault();
  if (touchSheet) inputEl.blur();
  runSearch();
};

const dedupeKey = (item: MediaItemTypeOrItemMapping): string | null => {
  if (!item.name || item.media_type === MediaType.PLAYLIST) return null;
  const artist =
    "artists" in item ? item.artists[0]?.name.toLowerCase() || "" : "";
  return `${item.media_type}:${item.name.toLowerCase()}:${artist}`;
};

const mediaSections = computed(() => {
  if (pagesOnly.value || !resultsMatchQuery.value) return [];

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

// the artwork plays on a hover-capable device; on touch, tapping it selects the
// row like the regular list rows, and the play button on the right handles play
const onThumbClick = function (
  item: MediaItemTypeOrItemMapping,
  event: MouseEvent,
) {
  if (isTouch.value) return;
  event.stopPropagation();
  onPlayClick(item, event);
};

const onMediaMenu = function (event: Event, item: MediaItemTypeOrItemMapping) {
  recordRecentSearch();
  const { x, y } = getEventPosition(event);
  handleMenuBtnClick(item, x, y);
};

const { onHold, onTouchStart, swallowClickAfterHold } =
  useHoldToOpenMenu(onMediaMenu);

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

const applyRecent = function (term: string) {
  query.value = term;
  runSearch();
};

const pageResults = computed(() => {
  if (!pagesOnly.value && selectedMediaTypes.value.length) return [];

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
  if (pagesOnly.value || selectedMediaTypes.value.length) return [];
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

  if (pagesOnly.value) {
    return pageResults.value.length ? "" : $t("no_content");
  }
  if (!term) return "";
  if (queryActive.value) {
    if (isSearching.value) return "";
    // typed but not submitted: prompt to run the search, unless the live page
    // and player matches already give something to show
    if (!resultsMatchQuery.value) {
      if (!pageResults.value.length && !playerResults.value.length)
        return $t("command_center_press_enter");
      return "";
    }
    if (hasMediaResults.value) return "";
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
  if (isOpen.value) {
    store.dialogActive = false;
    close();
  }
});

// menu actions such as "go to artist" navigate away, so the popup must not
// linger on top of the page we land on
watch(
  () => route.fullPath,
  () => {
    if (isOpen.value) close();
  },
);

watch(isOpen, (opened) => {
  store.dialogActive = opened;
  // the query, tab and results are kept on close so a later open restores them
  if (!opened) return;
  // a seeded open (a caller passed a query/type) starts that search; a bare
  // open keeps the previous search so reopening returns to those results
  if (initialSeeded.value) {
    pagesOnly.value = false;
    // reset the active term first so the composable's media-type watcher runs a
    // no-op search; the real fan-out then goes out once, after the flush
    search("");
    query.value = initialQuery.value;
    selectedMediaTypes.value = [...initialMediaTypes.value];
    nextTick(runSearch);
    return;
  }
  // a bare reopen keeps the previous search; put its scroll offset back too
  nextTick(() => {
    const el = listRef.value?.$el as HTMLElement | undefined;
    if (el && savedScrollTop.value) el.scrollTop = savedScrollTop.value;
  });
});

// a new search lands at the top; a reopened search keeps its saved offset
watch(activeSearchTerm, scrollResultsToTop);

watch(
  () =>
    [
      query.value,
      selectedMediaTypes.value.join(","),
      pagesOnly.value,
      selectedProviders.value.join(","),
    ].join("|"),
  () => {
    revealedPerType.value = {};
    revealedSingle.value = RESULTS_SINGLE_PAGE;
  },
);

// highlight the first row as results land so a desktop enter opens the top
// hit; on the mobile sheet on a touch screen the on-screen keyboard drives the
// interaction — there is no enter contract there and the phantom highlight
// would read as a selection nobody made
watch(
  () =>
    mediaSections.value.map((section) => section.items[0]?.uri ?? "").join("|"),
  async () => {
    if (store.isTouchscreen && store.mobileLayout) return;
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
.command-center-clear {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.command-center-clear:hover {
  color: var(--foreground);
}

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

/* hover-capable devices: play over the dimmed artwork on the active row,
   matching the blue play-over-artwork of the regular list rows */
@media (hover: hover) {
  .command-center-thumb {
    cursor: pointer;
  }

  .command-center-thumb::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .command-center-play {
    position: absolute;
    inset: 0;
    margin: auto;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: rgb(var(--v-theme-primary));
    color: #fff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  [data-highlighted] .command-center-thumb::after,
  [data-highlighted] .command-center-play {
    opacity: 1;
  }
}

/* touch devices: a small blue play disc on the right, next to the ⋮ menu */
.command-center-play-mobile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
}

.command-center-menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.15s ease;
}

.command-center-menu:hover {
  color: var(--foreground);
}
</style>
