<template>
  <div>
    <div v-if="loading" class="ed-loading">
      <v-progress-circular indeterminate />
    </div>

    <template v-else>
      <EditorialShelf
        v-if="showPlayers"
        ref="playersShelf"
        class="ed-players"
        :gap="12"
        :nav-center="42"
        :dimmed="editMode && !playersEnabled"
      >
        <template #header>
          <div class="ed-players__head">
            <h2 class="ed-players__label text-foreground">
              {{ $t("players") }}
            </h2>
            <span v-if="activeCount" class="ed-players__count">
              {{ activeCount }} {{ $t("state.playing") }}
            </span>
          </div>
        </template>
        <template v-if="editMode" #actions>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('tooltip.toggle_players')"
            @click="togglePlayers"
          >
            <Eye v-if="playersEnabled" />
            <EyeOff v-else />
          </Button>
        </template>
        <div
          v-for="player in players"
          :key="player.player_id"
          class="ed-player-slot"
          :data-player-id="player.player_id"
        >
          <PlayerCard
            :player="player"
            :show-volume-control="false"
            :show-menu-button="false"
            :show-sub-players="false"
            :show-sync-controls="false"
            @click="playerClicked(player)"
          />
        </div>
      </EditorialShelf>

      <section
        v-if="showTopPicks"
        class="ed-section ed-hero-row"
        :class="{ 'ed-dimmed': editMode && !topPicksEnabled }"
      >
        <div class="ed-hero-row__head">
          <div class="ed-hero-row__title-group">
            <h2 class="ed-hero-row__title">{{ $t("top_picks_for_you") }}</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              :title="$t('refresh')"
              :disabled="heroRefreshing"
              @click="refreshTopPicks"
            >
              <RefreshCw
                :class="{ 'ed-hero-refresh--spinning': heroRefreshing }"
              />
            </Button>
          </div>
          <Button
            v-if="editMode"
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('tooltip.toggle_top_picks')"
            @click="toggleTopPicks"
          >
            <Eye v-if="topPicksEnabled" />
            <EyeOff v-else />
          </Button>
        </div>
        <div
          class="ed-hero-row__viewport"
          @mouseenter="heroHovering = canHover"
          @mouseleave="heroHovering = false"
        >
          <!-- prev -->
          <button
            v-show="heroHovering && heroCanLeft"
            class="ed-hero-nav ed-hero-nav--left"
            aria-label="Scroll left"
            @click="scrollHero(-1)"
          >
            <ChevronLeft :size="20" />
          </button>

          <div ref="heroGrid" class="ed-hero-grid" @scroll="updateHeroNav">
            <EditorialHeroCard
              class="ed-hero-grid__lead"
              :item="heroEntries[0].item"
              :tag="heroEntries[0].tag"
              large
            />
            <div
              v-for="(col, i) in heroColumns"
              :key="i"
              class="ed-hero-grid__col"
            >
              <EditorialHeroCard
                v-for="entry in col"
                :key="entry.item.uri"
                :item="entry.item"
                :tag="entry.tag"
              />
            </div>
          </div>

          <!-- next -->
          <button
            v-show="heroHovering && heroCanRight"
            class="ed-hero-nav ed-hero-nav--right"
            aria-label="Scroll right"
            @click="scrollHero(1)"
          >
            <ChevronRight :size="20" />
          </button>
        </div>
      </section>

      <EditorialShelf
        v-for="(row, idx) in displayedRows"
        :key="row.folder.uri"
        :title="row.folder.name"
        :subtitle="row.folder.subtitle"
        :provider="folderProvider(row.folder)"
        :dimmed="editMode && !row.setting.enabled"
        :tiles-per-view="tilesPerView"
      >
        <template v-if="editMode" #actions>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('tooltip.toggle_row')"
            @click="toggleRow(row.folder.uri)"
          >
            <Eye v-if="row.setting.enabled" />
            <EyeOff v-else />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="idx === 0"
            :aria-label="$t('tooltip.move_row_up')"
            @click="moveRow(row.folder.uri, -1)"
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="idx === displayedRows.length - 1"
            :aria-label="$t('tooltip.move_row_down')"
            @click="moveRow(row.folder.uri, 1)"
          >
            <ChevronDown />
          </Button>
        </template>
        <EditorialMediaCard
          v-for="item in row.folder.items"
          :key="item.uri"
          :item="item"
        />
      </EditorialShelf>

      <section
        v-if="showGenres"
        class="ed-section ed-genres"
        :class="{ 'ed-dimmed': editMode && !genresEnabled }"
      >
        <div class="ed-genres__head">
          <h2 class="ed-genres__title">{{ $t("browse_by_genre") }}</h2>
          <Button
            v-if="editMode"
            variant="ghost"
            size="icon-sm"
            :title="genresEnabled ? $t('disable') : $t('enable')"
            :aria-label="genresEnabled ? $t('disable') : $t('enable')"
            @click="toggleGenres"
          >
            <Eye v-if="genresEnabled" />
            <EyeOff v-else />
          </Button>
        </div>
        <div class="ed-genres__grid">
          <EditorialGenreTile
            v-for="genre in genres"
            :key="genre.uri"
            :item="genre"
          />
        </div>
      </section>

      <div class="ed-footer-space"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import EditorialGenreTile from "@/components/discover/EditorialGenreTile.vue";
import EditorialHeroCard from "@/components/discover/EditorialHeroCard.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf, {
  type EditorialShelfExpose,
} from "@/components/discover/EditorialShelf.vue";
import PlayerCard from "@/components/PlayerCard.vue";
import { Button } from "@/components/ui/button";
import { useUserPreferences } from "@/composables/userPreferences";
import { panelViewItemResponsive, playerVisible } from "@/helpers/utils";
import api from "@/plugins/api";
import {
  EventType,
  MediaType,
  PlaybackState,
  type EventMessage,
  type Genre,
  type ItemMapping,
  type MediaItemTypeOrItemMapping,
  type Player,
  type RecommendationFolder,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCw,
} from "@lucide/vue";
import { useDebounceFn } from "@vueuse/core";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

const props = withDefaults(defineProps<{ editMode?: boolean }>(), {
  editMode: false,
});

const { getPreference, setPreference } = useUserPreferences();

const loading = ref(true);
const playersShelf = ref<EditorialShelfExpose | null>(null);
const recommendations = ref<RecommendationFolder[]>([]);
const recentlyPlayed = ref<ItemMapping[]>([]);
const genres = ref<Genre[]>([]);

const tilesPerView = computed(() => {
  const isPhone = getBreakpointValue({ breakpoint: "bp1", condition: "lt" });
  return isPhone ? 2.2 : panelViewItemResponsive(0) + 0.5;
});

const players = computed(() =>
  Object.values(api.players)
    .filter((x) => playerVisible(x))
    .sort((a, b) => (a.name.toUpperCase() > b.name?.toUpperCase() ? 1 : -1))
    .sort((a, b) => playerSortScore(a) - playerSortScore(b)),
);

const activeCount = computed(
  () =>
    players.value.filter((p) => p.playback_state == PlaybackState.PLAYING)
      .length,
);

// --- Players shelf visibility (edit mode) ---
const playersEnabledPref = getPreference<boolean>(
  "discoverPlayersEnabled",
  true,
);
const playersEnabled = computed(() => playersEnabledPref.value !== false);
const showPlayers = computed(
  () => players.value.length > 0 && (props.editMode || playersEnabled.value),
);
const togglePlayers = () =>
  setPreference("discoverPlayersEnabled", !playersEnabled.value);

const topPicksEnabledPref = getPreference<boolean>(
  "discoverTopPicksEnabled",
  true,
);
const topPicksEnabled = computed(() => topPicksEnabledPref.value !== false);
const showTopPicks = computed(
  () =>
    heroEntries.value.length > 0 && (props.editMode || topPicksEnabled.value),
);
const toggleTopPicks = () =>
  setPreference("discoverTopPicksEnabled", !topPicksEnabled.value);

const genresEnabledPref = getPreference<boolean>("discoverGenresEnabled", true);
const genresEnabled = computed(() => genresEnabledPref.value !== false);
const showGenres = computed(
  () => genres.value.length > 0 && (props.editMode || genresEnabled.value),
);
const toggleGenres = () =>
  setPreference("discoverGenresEnabled", !genresEnabled.value);

function playerSortScore(player: Player) {
  if (player.playback_state == PlaybackState.PLAYING) return 0;
  if (player.playback_state == PlaybackState.PAUSED) return 1;
  if (player.current_media && player.powered) return 3;
  if (player.current_media) return 4;
  return 99;
}

function playerClicked(player: Player) {
  store.activePlayerId = player.player_id;
}

const playersOrderKey = computed(() =>
  players.value.map((p) => p.player_id).join(","),
);

function alignPlayersShelf() {
  const shelf = playersShelf.value;
  if (!shelf) return;
  const activeId = store.activePlayerId;
  if (activeId) {
    shelf.alignItemStart(`[data-player-id="${activeId}"]`);
  } else {
    shelf.scrollToStart();
  }
}

watch(playersOrderKey, () => {
  if (!showPlayers.value) return;
  nextTick(alignPlayersShelf);
});

watch(loading, (isLoading) => {
  if (!isLoading) nextTick(alignPlayersShelf);
});

watch(
  () => store.activePlayerId,
  () => {
    if (!showPlayers.value) return;
    nextTick(alignPlayersShelf);
  },
);

const folderProvider = (folder: RecommendationFolder) => folder.provider || "";

// --- Top Picks: a curated mix from specific recommendation folders ---
interface HeroEntry {
  item: MediaItemTypeOrItemMapping;
  tag: string;
}
// 1 large lead card + the rest split into columns of 2 (a horizontal scroller).
const HERO_COUNT = 9;

const norm = (s: string) => (s || "").toLowerCase();
const findFolder = (...needles: string[]) =>
  recommendations.value.find((f) => {
    const hay = norm(f.name);
    return needles.some((n) => hay.includes(n));
  });

const shuffled = <T,>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const buildHeroEntries = (randomize = false): HeroEntry[] => {
  const playlists = findFolder("playlists made for you", "made for you");
  const mood = findFolder("find your mood", "mood");
  const stations = findFolder("stations for you", "radio stations for you");
  const releases = findFolder("new releases for you");
  // "Artist-focused" stations = artist items inside the stations folder.
  const artistStations = (stations?.items ?? []).filter(
    (i) => i.media_type === MediaType.ARTIST,
  );

  const order = (items: MediaItemTypeOrItemMapping[]) =>
    randomize ? shuffled(items) : items;
  const playlistItems = order(playlists?.items ?? []);
  const moodItems = order(mood?.items ?? []);
  const stationItems = order(stations?.items ?? []);
  const releaseItems = order(releases?.items ?? []);
  const artistStationItems = order(artistStations);

  const entry = (
    item: MediaItemTypeOrItemMapping | undefined,
    folder: RecommendationFolder | undefined,
  ): HeroEntry | null => (item && folder ? { item, tag: folder.name } : null);

  const recipe = [
    entry(playlistItems[0], playlists),
    entry(moodItems[0], mood),
    entry(artistStationItems[0], stations),
    entry(releaseItems[0], releases),
    entry(stationItems[0], stations),
    entry(releaseItems[1], releases),
    entry(artistStationItems[1], stations),
    entry(playlistItems[1], playlists),
    entry(moodItems[1], mood),
    entry(releaseItems[2], releases),
  ];

  const seen = new Set<string>();
  const out: HeroEntry[] = [];
  const push = (e: HeroEntry | null) => {
    if (e && !seen.has(e.item.uri)) {
      seen.add(e.item.uri);
      out.push(e);
    }
  };
  recipe.forEach(push);

  // Top up with random unused items from any folder (then recently played).
  if (out.length < HERO_COUNT) {
    const pool: HeroEntry[] = [
      ...recommendations.value.flatMap((f) =>
        f.items.map((item) => ({ item, tag: f.name })),
      ),
      ...recentlyPlayed.value.map((item) => ({
        item,
        tag: $t("recently_played"),
      })),
    ].filter((e) => !seen.has(e.item.uri));
    for (const e of shuffled(pool)) {
      if (out.length >= HERO_COUNT) break;
      push(e);
    }
  }
  const picks = out.slice(0, HERO_COUNT);

  return randomize ? shuffled(picks) : picks;
};

const heroEntries = ref<HeroEntry[]>([]);
// Everything after the lead card, grouped into columns of 2 stacked cards.
const heroColumns = computed<HeroEntry[][]>(() => {
  const rest = heroEntries.value.slice(1);
  const cols: HeroEntry[][] = [];
  for (let i = 0; i < rest.length; i += 2) cols.push(rest.slice(i, i + 2));
  return cols;
});

// --- Top Picks horizontal scroller (lead + columns that overflow on narrower
// screens) with hover chevrons, mirroring EditorialShelf's nav affordance. ---
// Only track hover (for the nav chevrons) on hover-capable devices. On touch
// devices the emulated mouseenter would mutate the DOM, which makes mobile
// Safari swallow the first tap as "hover" instead of a click.
const canHover = window.matchMedia?.("(hover: hover)")?.matches ?? true;
const heroGrid = ref<HTMLElement | null>(null);
const heroHovering = ref(false);
const heroCanLeft = ref(false);
const heroCanRight = ref(false);

const updateHeroNav = () => {
  const el = heroGrid.value;
  if (!el) return;
  heroCanLeft.value = el.scrollLeft > 1;
  heroCanRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
};

const scrollHero = (dir: number) => {
  const el = heroGrid.value;
  if (!el) return;
  el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
};

let heroRo: ResizeObserver | undefined;
const observeHero = () => {
  const el = heroGrid.value;
  if (!el) return;
  updateHeroNav();
  if ("ResizeObserver" in window && !heroRo) {
    heroRo = new ResizeObserver(updateHeroNav);
    heroRo.observe(el);
  }
};

watch(heroEntries, () => nextTick(observeHero), { deep: false });
const HERO_CACHE_KEY = "discoverTopPicks";
const HERO_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

interface HeroCache {
  ts: number;
  userId?: string;
  count?: number;
  entries: HeroEntry[];
}

const readHeroCache = (): HeroEntry[] | null => {
  try {
    const raw = localStorage.getItem(HERO_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as HeroCache;
    if (!cache?.entries?.length) return null;
    if (Date.now() - cache.ts > HERO_CACHE_TTL) return null;
    if (cache.userId !== store.currentUser?.user_id) return null;
    // Invalidate when the target count changes (e.g. layout now wants more).
    if (cache.count !== HERO_COUNT) return null;
    return cache.entries;
  } catch {
    return null;
  }
};

const writeHeroCache = (entries: HeroEntry[]) => {
  try {
    const cache: HeroCache = {
      ts: Date.now(),
      userId: store.currentUser?.user_id,
      count: HERO_COUNT,
      entries,
    };
    localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota / serialization errors
  }
};

// Reuse the cached picks while still fresh; otherwise rebuild and re-cache.
const resolveHeroPicks = () => {
  const cached = readHeroCache();
  if (cached) {
    heroEntries.value = cached;
    return;
  }
  const fresh = buildHeroEntries();
  heroEntries.value = fresh;
  if (fresh.length) writeHeroCache(fresh);
};

const heroRefreshing = ref(false);
const refreshTopPicks = async () => {
  if (heroRefreshing.value) return;
  heroRefreshing.value = true;
  try {
    await loadRecommendations();
    const fresh = buildHeroEntries(true);
    if (fresh.length) {
      heroEntries.value = fresh;
      writeHeroCache(fresh);
    }
  } finally {
    heroRefreshing.value = false;
  }
};

// --- Recommendation shelves with per-row visibility + ordering (edit mode) ---
interface RowSetting {
  position: number;
  enabled: boolean;
}
const savedRowSettings = getPreference<Record<string, RowSetting>>(
  "discoverRowSettings",
  {},
);
const rowSettings = ref<Record<string, RowSetting>>({});

const ensureRowSettings = () => {
  const settings: Record<string, RowSetting> = { ...savedRowSettings.value };
  let maxPos = Object.values(settings).reduce(
    (m, s) => Math.max(m, s.position),
    -1,
  );
  for (const f of recommendations.value) {
    if (!settings[f.uri])
      settings[f.uri] = { position: ++maxPos, enabled: true };
  }
  rowSettings.value = settings;
};

watch(savedRowSettings, ensureRowSettings, { deep: true });

const orderedRows = computed(() =>
  recommendations.value
    .filter((f) => f.items.length)
    .map((f) => ({
      folder: f,
      setting: rowSettings.value[f.uri] ?? { position: 9999, enabled: true },
    }))
    .sort((a, b) => a.setting.position - b.setting.position),
);
const displayedRows = computed(() =>
  props.editMode
    ? orderedRows.value
    : orderedRows.value.filter((r) => r.setting.enabled),
);

const persistRowSettings = () =>
  setPreference("discoverRowSettings", rowSettings.value);

const toggleRow = (uri: string) => {
  const s = rowSettings.value[uri];
  if (!s) return;
  s.enabled = !s.enabled;
  persistRowSettings();
};
const moveRow = (uri: string, dir: number) => {
  const rows = orderedRows.value;
  const i = rows.findIndex((r) => r.folder.uri === uri);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  const a = rowSettings.value[rows[i].folder.uri];
  const b = rowSettings.value[rows[j].folder.uri];
  [a.position, b.position] = [b.position, a.position];
  persistRowSettings();
};

const loadRecommendations = async () => {
  const [recs, recent] = await Promise.all([
    api.getRecommendations().catch(() => [] as RecommendationFolder[]),
    api.getRecentlyPlayedItems(12).catch(() => [] as ItemMapping[]),
  ]);
  recommendations.value = recs;
  recentlyPlayed.value = recent;
  ensureRowSettings();
};

// "Browse by genre": show the 8 genres with the most linked media items
// (most relevant to the user) rather than the first 8 alphabetically.
const loadGenres = async () => {
  const all = await api
    .getLibraryGenres({ hide_empty: true })
    .catch(() => [] as Genre[]);
  if (!all.length) return;
  let ranked = all;
  try {
    const counts = await api.getGenreMediaCounts(all.map((g) => g.item_id));
    const total = (id: string) =>
      Object.values(counts[id] ?? {}).reduce((sum, n) => sum + n, 0);
    ranked = [...all].sort((a, b) => total(b.item_id) - total(a.item_id));
  } catch {
    // counts endpoint unavailable on older servers → keep server (name) order
  }
  genres.value = ranked.slice(0, 8);
};

onMounted(async () => {
  await Promise.all([loadRecommendations(), loadGenres()]);
  resolveHeroPicks();
  loading.value = false;
  nextTick(observeHero);
  window.addEventListener("resize", updateHeroNav);

  const refreshRecommendations = useDebounceFn(async () => {
    await loadRecommendations();
    // Keeps the same picks while the cache is fresh; rebuilds once expired.
    resolveHeroPicks();
  }, 1500);

  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    (evt: EventMessage) => {
      // Only refetch when a track actually finished (is_playing = false),
      // not on the periodic ~30s progress reports that also emit this event.
      if (evt.data && !(evt.data as Record<string, unknown>).is_playing) {
        refreshRecommendations();
      }
    },
  );
  onBeforeUnmount(unsub);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateHeroNav);
  heroRo?.disconnect();
});
</script>

<style scoped>
.ed-loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.ed-section {
  margin-bottom: 32px;
}

.ed-players {
  margin-top: 4px;
}
.ed-players__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ed-players__label {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
}
.ed-players__count {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.ed-player-slot {
  flex: 0 0 auto;
  width: 280px;
  scroll-snap-align: start;
}
.ed-player-slot :deep(.panel-item) {
  height: auto;
  margin-top: 0;
  margin-bottom: 0;
  max-width: 100%;
}
.ed-player-slot :deep(.panel-item-details .v-list-item__content) {
  min-width: 0;
  overflow: hidden;
}

.ed-hero-row {
  padding: 0 28px;
}

.ed-dimmed {
  opacity: 0.4;
}
.ed-hero-row__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ed-hero-row__title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ed-hero-row__title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.6px;
  color: rgb(var(--v-theme-on-background));
}
.ed-hero-refresh--spinning {
  animation: ed-hero-refresh-spin 0.8s linear infinite;
}
@keyframes ed-hero-refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.ed-hero-row__viewport {
  position: relative;
}
/* Horizontal scroller: fixed-size lead + columns of 2, so cards don't stretch
   on wide screens. The default viewport shows the lead + 2 columns; the
   remaining columns scroll into view (and fit outright on big screens). */
.ed-hero-grid {
  display: flex;
  gap: 14px;
  height: 320px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}
.ed-hero-grid::-webkit-scrollbar {
  display: none;
}
.ed-hero-grid__lead {
  flex: 1.5 0 520px;
  height: 100%;
  scroll-snap-align: start;
}
.ed-hero-grid__col {
  flex: 1 0 360px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scroll-snap-align: start;
}
.ed-hero-grid__col > * {
  flex: 1;
  min-height: 0;
}
.ed-hero-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--v-theme-on-background));
  background: rgb(var(--v-theme-panel));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}
.ed-hero-nav:hover {
  background: rgb(var(--v-theme-surface));
}
.ed-hero-nav:active {
  transform: translateY(-50%) scale(0.94);
}
.ed-hero-nav--left {
  left: 12px;
}
.ed-hero-nav--right {
  right: 12px;
}

.ed-genres {
  padding: 0 28px;
}
.ed-genres__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ed-genres__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
}
.ed-genres__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ed-footer-space {
  height: 40px;
}

@media (max-width: 900px) {
  .ed-genres__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .ed-hero-grid {
    display: flex;
    height: auto;
    gap: 12px;
    overflow-x: auto;
    overflow-y: visible;
    scroll-snap-type: x mandatory;
    /* pan-y too: a vertical swipe starting on a tile must scroll the page */
    touch-action: pan-x pan-y;
    scrollbar-width: none;
    margin-inline: -28px;
    padding-inline: 28px;
    /* snap tiles to the gutter so the first tile lines up with the title */
    scroll-padding-inline: 28px;
  }
  .ed-hero-grid::-webkit-scrollbar {
    display: none;
  }
  .ed-hero-grid__col {
    display: contents;
  }
  .ed-hero-row .ed-hero-grid :deep(.ed-hero) {
    flex: 0 0 44%;
    height: 220px;
    min-height: 0;
    scroll-snap-align: start;
  }

  .ed-hero-row .ed-hero-grid :deep(.ed-hero--large .ed-hero__title) {
    font-size: 18px;
  }
  .ed-hero-row .ed-hero-grid :deep(.ed-hero--large .ed-hero__content) {
    padding: 16px;
  }
}

@media (max-width: 600px) {
  .ed-section {
    margin-bottom: 16px;
  }
  .ed-hero-row,
  .ed-genres {
    padding-left: 16px;
    padding-right: 16px;
  }
  .ed-hero-grid {
    margin-inline: -16px;
    padding-inline: 16px;
    scroll-padding-inline: 16px;
  }
  .ed-hero-row .ed-hero-grid :deep(.ed-hero) {
    flex: 0 0 82%;
    height: 200px;
  }
  .ed-hero-row__title {
    font-size: 22px;
  }
  .ed-hero-nav {
    display: none;
  }
}
</style>
