<template>
  <div>
    <div v-if="loading" class="ed-loading">
      <v-progress-circular indeterminate />
    </div>

    <template v-else>
      <div ref="listEl" class="ed-rows">
        <div
          v-for="(row, idx) in displayedRows"
          :key="row.id"
          class="ed-row"
          :data-drag-index="idx"
          :class="{ 'ed-row--drag-source': draggingIndex === idx }"
          :style="
            isDragging
              ? {
                  transform: `translateY(${rowOffset(idx)}px)`,
                  transition:
                    draggingIndex !== idx ? 'transform 200ms ease-out' : 'none',
                }
              : undefined
          "
        >
          <!-- Players row -->
          <EditorialShelf
            v-if="row.kind === 'players'"
            :ref="setPlayersShelfRef"
            class="ed-players"
            :gap="12"
            :nav-center="42"
            :dimmed="editMode && row.hidden"
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
              <button
                class="ed-drag-handle"
                :aria-label="$t('queue_reorder')"
                @pointerdown.stop.prevent="startItemDrag($event, idx)"
                @click.stop
              >
                <GripVertical />
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="$t('tooltip.toggle_players')"
                @click="toggleRow(row)"
              >
                <Eye v-if="!row.hidden" />
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
                :show-child-volumes="false"
                :show-group-controls="false"
                @click="playerClicked(player)"
              />
            </div>
          </EditorialShelf>

          <!-- Top picks row -->
          <section
            v-else-if="row.kind === 'top_picks'"
            class="ed-section ed-hero-row"
            :class="{ 'ed-dimmed': editMode && row.hidden }"
          >
            <div class="ed-hero-row__head">
              <div class="ed-hero-row__title-group">
                <h2 class="ed-hero-row__title">
                  {{ $t("top_picks_for_you") }}
                </h2>
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
              <div v-if="editMode" class="ed-edit-controls">
                <button
                  class="ed-drag-handle"
                  :aria-label="$t('queue_reorder')"
                  @pointerdown.stop.prevent="startItemDrag($event, idx)"
                  @click.stop
                >
                  <GripVertical />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="$t('tooltip.toggle_top_picks')"
                  @click="toggleRow(row)"
                >
                  <Eye v-if="!row.hidden" />
                  <EyeOff v-else />
                </Button>
              </div>
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

          <!-- Recommendation shelf -->
          <EditorialShelf
            v-else-if="row.kind === 'recommendation' && row.folder"
            :title="row.folder.name"
            :subtitle="row.folder.subtitle"
            :provider="folderProvider(row.folder)"
            :dimmed="editMode && row.hidden"
            :tiles-per-view="tilesPerView"
          >
            <template v-if="editMode" #actions>
              <button
                class="ed-drag-handle"
                :aria-label="$t('queue_reorder')"
                @pointerdown.stop.prevent="startItemDrag($event, idx)"
                @click.stop
              >
                <GripVertical />
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="$t('tooltip.toggle_row')"
                @click="toggleRow(row)"
              >
                <Eye v-if="!row.hidden" />
                <EyeOff v-else />
              </Button>
            </template>
            <EditorialMediaCard
              v-for="item in row.folder?.items || []"
              :key="item.uri"
              :item="item"
            />
          </EditorialShelf>

          <!-- Genres row -->
          <section
            v-else-if="row.kind === 'genres'"
            class="ed-section ed-genres"
            :class="{ 'ed-dimmed': editMode && row.hidden }"
          >
            <div class="ed-genres__head">
              <h2 class="ed-genres__title">{{ $t("browse_by_genre") }}</h2>
              <div v-if="editMode" class="ed-edit-controls">
                <button
                  class="ed-drag-handle"
                  :aria-label="$t('queue_reorder')"
                  @pointerdown.stop.prevent="startItemDrag($event, idx)"
                  @click.stop
                >
                  <GripVertical />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :title="row.hidden ? $t('enable') : $t('disable')"
                  :aria-label="row.hidden ? $t('enable') : $t('disable')"
                  @click="toggleRow(row)"
                >
                  <Eye v-if="!row.hidden" />
                  <EyeOff v-else />
                </Button>
              </div>
            </div>
            <div class="ed-genres__grid">
              <EditorialGenreTile
                v-for="genre in genres"
                :key="genre.uri"
                :item="genre"
              />
            </div>
          </section>
        </div>

        <!-- Floating ghost that follows the pointer while dragging a row -->
        <div
          v-if="isDragging && draggedRow"
          class="ed-drag-ghost"
          :style="{ top: `${ghostY}px` }"
        >
          <GripVertical class="ed-drag-ghost__icon" />
          <span class="ed-drag-ghost__title">{{ draggedRow.title }}</span>
        </div>
      </div>

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
import {
  GENRES_ROW_ID,
  PLAYERS_ROW_ID,
  DEFAULT_PRIORITY_ROWS,
  TOP_PICKS_ROW_ID,
  resolveDiscoverRowsConfig,
  setDiscoverRowHidden,
  setDiscoverRowsOrder,
} from "@/components/discover/utils/discoverRows";
import PlayerCard from "@/components/PlayerCard.vue";
import { Button } from "@/components/ui/button";
import { useListDragReorder } from "@/composables/useListDragReorder";
import { useOrderedPlayers } from "@/composables/useOrderedPlayers";
import { panelViewItemResponsive } from "@/helpers/utils";
import api from "@/plugins/api";
import {
  EventType,
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
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  RefreshCw,
} from "@lucide/vue";
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

// Entering edit mode needs the whole catalog to toggle/discover rows, so
// bypass the persisted `wanted` set for a one-off full fetch.
watch(
  () => props.editMode,
  async (isEdit) => {
    if (isEdit) {
      await loadRecommendations();
      resolveHeroPicks();
    }
  },
);

const loading = ref(true);
const playersShelf = ref<EditorialShelfExpose | null>(null);
const recommendations = ref<RecommendationFolder[]>([]);
const recentlyPlayed = ref<ItemMapping[]>([]);
const genres = ref<Genre[]>([]);

const tilesPerView = computed(() => {
  const isPhone = getBreakpointValue({ breakpoint: "bp1", condition: "lt" });
  return isPhone ? 2.2 : panelViewItemResponsive(0) + 0.5;
});

const players = useOrderedPlayers();

const activeCount = computed(
  () =>
    players.value.filter((p) => p.playback_state == PlaybackState.PLAYING)
      .length,
);

function playerClicked(player: Player) {
  store.activePlayerId = player.player_id;
}

const setPlayersShelfRef = (el: unknown) => {
  playersShelf.value = (el as EditorialShelfExpose | null) ?? null;
};

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

const showPlayers = computed(() =>
  displayedRows.value.some((row) => row.kind === "players"),
);

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

// --- Top Picks (Model B): a balanced interleave of items across the rows the
// user has enabled. Only shown, non-empty recommendation folders feed it, so
// the mix reflects the user's enabled rows; recently-played fills any
// shortfall. ---
interface HeroEntry {
  item: MediaItemTypeOrItemMapping;
  tag: string;
}
// 1 large lead card + the rest split into columns of 2 (a horizontal scroller).
const HERO_COUNT = 9;

const shuffled = <T,>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const buildHeroEntries = (randomize = false): HeroEntry[] => {
  // Each shown (non-hidden), non-empty folder contributes its items under its
  // own tag, so an opted-out row never feeds the hero. `randomize` (explicit
  // refresh) reshuffles the row order and the items within a row; the resolve
  // path stays deterministic so repeated builds are content-equal.
  const rows = recommendations.value
    .filter((f) => shownRecRowIds.value.has(f.uri) && f.items.length > 0)
    .map((f) => ({
      tag: f.name,
      items: randomize ? shuffled(f.items) : f.items,
    }));
  const sources = randomize ? shuffled(rows) : rows;

  const seen = new Set<string>();
  const out: HeroEntry[] = [];
  const push = (item: MediaItemTypeOrItemMapping | undefined, tag: string) => {
    if (item && !seen.has(item.uri) && out.length < HERO_COUNT) {
      seen.add(item.uri);
      out.push({ item, tag });
    }
  };

  // Round-robin: one item per row per pass, so the mix is balanced across rows.
  const maxLen = sources.reduce((m, r) => Math.max(m, r.items.length), 0);
  for (let i = 0; i < maxLen && out.length < HERO_COUNT; i++) {
    for (const r of sources) push(r.items[i], r.tag);
  }

  // Fill any shortfall from recently played.
  for (const item of recentlyPlayed.value) push(item, $t("recently_played"));

  return out;
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
let observedHeroGrid: HTMLElement | null = null;

const observeHero = () => {
  const el = heroGrid.value;
  if (!(el instanceof HTMLElement)) {
    heroRo?.disconnect();
    observedHeroGrid = null;
    return;
  }
  updateHeroNav();
  if (!("ResizeObserver" in window)) return;
  heroRo ??= new ResizeObserver(updateHeroNav);
  if (observedHeroGrid === el) return;
  heroRo.disconnect();
  heroRo.observe(el);
  observedHeroGrid = el;
};

watch(heroEntries, () => nextTick(observeHero), { deep: false });

// Assign heroEntries only when the picks actually changed — cheap insurance
// against redundant re-renders from repeated builds with identical content.
const heroEntriesEqual = (a: HeroEntry[], b: HeroEntry[]) =>
  a.length === b.length &&
  a.every((e, i) => e.item.uri === b[i].item.uri && e.tag === b[i].tag);
const setHeroEntries = (next: HeroEntry[]) => {
  if (!heroEntriesEqual(heroEntries.value, next)) heroEntries.value = next;
};

const resolveHeroPicks = () => {
  setHeroEntries(buildHeroEntries());
};

const heroRefreshing = ref(false);
const refreshTopPicks = async () => {
  if (heroRefreshing.value) return;
  heroRefreshing.value = true;
  try {
    await loadRecommendations();
    heroEntries.value = buildHeroEntries(true);
  } finally {
    heroRefreshing.value = false;
  }
};

// --- Unified row list: visibility + ordering via the discover.rows pref ---
type DiscoverRowKind = "players" | "top_picks" | "recommendation" | "genres";

interface DiscoverRow {
  id: string;
  kind: DiscoverRowKind;
  title: string;
  hidden: boolean;
  folder?: RecommendationFolder;
}

const recommendationRows = computed(() =>
  recommendations.value.filter((f) => f.items.length > 0),
);
const defaultHiddenIds = computed(() =>
  recommendations.value.filter((f) => !f.enabled_by_default).map((f) => f.uri),
);

// Default order of every candidate row (recommendation rows not yet known to be
// empty), well-known rows first, remaining server rows as returned, genres last.
const availableRowIds = computed<string[]>(() => {
  const recUris = recommendationRows.value.map((d) => d.uri);
  const recSet = new Set(recUris);
  const ids: string[] = [];
  for (const id of DEFAULT_PRIORITY_ROWS) {
    if (id === PLAYERS_ROW_ID) {
      if (players.value.length > 0) ids.push(id);
    } else if (id === TOP_PICKS_ROW_ID) {
      if (heroEntries.value.length > 0) ids.push(id);
    } else if (recSet.has(id)) {
      ids.push(id);
    }
  }
  for (const uri of recUris) {
    if (!ids.includes(uri)) ids.push(uri);
  }
  if (genres.value.length > 0) ids.push(GENRES_ROW_ID);
  return ids;
});

const allRows = computed<DiscoverRow[]>(() => {
  const { order, hidden } = resolveDiscoverRowsConfig(
    availableRowIds.value,
    defaultHiddenIds.value,
  );
  const folders = new Map(recommendationRows.value.map((d) => [d.uri, d]));
  const rows: DiscoverRow[] = [];
  for (const id of order) {
    if (id === PLAYERS_ROW_ID) {
      rows.push({
        id,
        kind: "players",
        title: $t("players"),
        hidden: hidden.has(id),
      });
    } else if (id === TOP_PICKS_ROW_ID) {
      rows.push({
        id,
        kind: "top_picks",
        title: $t("top_picks_for_you"),
        hidden: hidden.has(id),
      });
    } else if (id === GENRES_ROW_ID) {
      rows.push({
        id,
        kind: "genres",
        title: $t("browse_by_genre"),
        hidden: hidden.has(id),
      });
    } else {
      const folder = folders.get(id);
      if (!folder) continue;
      rows.push({
        id,
        kind: "recommendation",
        title: folder.name,
        hidden: hidden.has(id),
        folder,
      });
    }
  }
  return rows;
});

const displayedRows = computed(() =>
  props.editMode ? allRows.value : allRows.value.filter((row) => !row.hidden),
);

// The recommendation rows currently visible to the user (not hidden). The Top
// Picks hero draws only from these, so an opted-out row never feeds it.
const shownRecRowIds = computed(
  () =>
    new Set(
      allRows.value
        .filter((r) => r.kind === "recommendation" && !r.hidden)
        .map((r) => r.id),
    ),
);

const toggleRow = (row: DiscoverRow) => {
  setDiscoverRowHidden(row.id, !row.hidden);
};

// --- Drag-to-reorder (edit mode), same interaction as the navigation menu ---
const listEl = ref<HTMLElement | null>(null);

const { startItemDrag, draggingIndex, isDragging, ghostY, rowOffset } =
  useListDragReorder({
    listEl,
    count: () => displayedRows.value.length,
    onCommit: (from, to) => {
      const ids = displayedRows.value.map((row) => row.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      setDiscoverRowsOrder(ids, availableRowIds.value);
    },
  });

const draggedRow = computed(() =>
  draggingIndex.value != null
    ? (displayedRows.value[draggingIndex.value] ?? null)
    : null,
);

// Cache the server's row catalog (which rows exist + their default visibility) — the one
// thing `discover.rows` prefs don't carry. The wanted set is derived fresh from this catalog
// resolved against the prefs on each load, so hide/show state lives only in prefs.
const ROW_CATALOG_KEY = "discoverRowCatalog";
interface RowCatalogEntry {
  uri: string;
  enabled_by_default: boolean;
}
const readRowCatalog = (): RowCatalogEntry[] => {
  try {
    const raw = localStorage.getItem(ROW_CATALOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter(
          (x): x is RowCatalogEntry =>
            !!x &&
            typeof x.uri === "string" &&
            typeof x.enabled_by_default === "boolean",
        )
      : [];
  } catch {
    return [];
  }
};
const writeRowCatalog = (folders: RecommendationFolder[]): void => {
  try {
    const catalog: RowCatalogEntry[] = folders.map((f) => ({
      uri: f.uri,
      enabled_by_default: f.enabled_by_default,
    }));
    localStorage.setItem(ROW_CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // ignore
  }
};
// The recommendation-row URIs to request, derived from the cached catalog resolved against
// discover.rows prefs. `undefined` when no catalog is known yet → the caller does a full fetch.
const wantedFromPrefs = (): string[] | undefined => {
  const catalog = readRowCatalog();
  if (!catalog.length) return undefined;
  const availableIds = catalog.map((c) => c.uri);
  const defaultHidden = catalog
    .filter((c) => !c.enabled_by_default)
    .map((c) => c.uri);
  const { hidden } = resolveDiscoverRowsConfig(availableIds, defaultHidden);
  return availableIds.filter((uri) => !hidden.has(uri));
};

const loadRecommendations = async (wanted?: string[]) => {
  // Preserve the currently shown rows on a (transient) refresh failure instead
  // of wiping them; log so a recurring failure is visible.
  const [rows, recent] = await Promise.allSettled([
    api.getRecommendations(wanted),
    api.getRecentlyPlayedItems(12),
  ]);
  if (rows.status === "fulfilled") {
    recommendations.value = rows.value;
    // A full fetch (no `wanted`) returns the whole catalog — remember it so the next
    // cold load can request only the shown rows.
    if (wanted === undefined) writeRowCatalog(rows.value);
  } else console.error("Failed to load recommendations:", rows.reason);
  if (recent.status === "fulfilled") recentlyPlayed.value = recent.value;
  else console.error("Failed to load recently played:", recent.reason);
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

let isUnmounted = false;
let refreshRecommendationsTimer: ReturnType<typeof setTimeout> | undefined;

const cancelScheduledRecommendationRefresh = () => {
  if (refreshRecommendationsTimer) {
    clearTimeout(refreshRecommendationsTimer);
    refreshRecommendationsTimer = undefined;
  }
};

const scheduleRecommendationRefresh = () => {
  cancelScheduledRecommendationRefresh();
  refreshRecommendationsTimer = setTimeout(async () => {
    refreshRecommendationsTimer = undefined;
    if (isUnmounted) return;
    // Refetches folder content so play-history rows and rotated picks stay current.
    await loadRecommendations(wantedFromPrefs());
    if (isUnmounted) return;
    resolveHeroPicks();
  }, 1500);
};

const isFinishedPlaybackEvent = (
  data: unknown,
): data is { is_playing: false } =>
  typeof data === "object" &&
  data !== null &&
  "is_playing" in data &&
  data.is_playing === false;

const unsubscribeRecommendations = api.subscribe(
  EventType.MEDIA_ITEM_PLAYED,
  (evt: EventMessage) => {
    // Only refetch when a track actually finished (is_playing = false),
    // not on the periodic ~30s progress reports that also emit this event.
    if (isFinishedPlaybackEvent(evt.data)) {
      scheduleRecommendationRefresh();
    }
  },
);

onMounted(async () => {
  await Promise.all([loadRecommendations(wantedFromPrefs()), loadGenres()]);
  if (isUnmounted) return;
  loading.value = false;
  resolveHeroPicks();
  nextTick(() => {
    if (!isUnmounted) observeHero();
  });
  window.addEventListener("resize", updateHeroNav);
});

onBeforeUnmount(() => {
  isUnmounted = true;
  window.removeEventListener("resize", updateHeroNav);
  unsubscribeRecommendations();
  cancelScheduledRecommendationRefresh();
  heroRo?.disconnect();
  heroRo = undefined;
  observedHeroGrid = null;
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

.ed-rows {
  position: relative;
}
.ed-row {
  position: relative;
}
.ed-row--drag-source {
  opacity: 0.35;
}

.ed-edit-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ed-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  cursor: grab;
  touch-action: none;
}
.ed-drag-handle:active {
  cursor: grabbing;
}
.ed-drag-handle svg {
  width: 16px;
  height: 16px;
}

.ed-drag-ghost {
  position: absolute;
  left: 28px;
  right: 28px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: rgb(var(--v-theme-panel));
  color: rgb(var(--v-theme-on-background));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  font-size: 15px;
  font-weight: 600;
  opacity: 0.95;
  pointer-events: none;
  cursor: grabbing;
}
.ed-drag-ghost__icon {
  width: 16px;
  height: 16px;
  opacity: 0.6;
  flex-shrink: 0;
}
.ed-drag-ghost__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ed-players {
  margin-top: 4px;
}
.ed-players :deep(.ed-shelf__track) {
  align-items: stretch;
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
  display: flex;
  flex: 0 0 auto;
  width: 280px;
  scroll-snap-align: start;
}
.ed-player-slot :deep([data-slot="card"]) {
  width: 100%;
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
  .ed-drag-ghost {
    left: 16px;
    right: 16px;
  }
}
</style>
