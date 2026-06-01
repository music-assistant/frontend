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
            <h2 class="ed-players__label">{{ $t("players") }}</h2>
            <span v-if="activeCount" class="ed-players__count">
              {{ activeCount }} {{ $t("state.playing") }}
            </span>
          </div>
        </template>
        <template v-if="editMode" #actions>
          <v-btn
            :icon="playersEnabled ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
            size="small"
            variant="text"
            @click="togglePlayers"
          />
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

      <section v-if="heroEntries.length" class="ed-section ed-hero-row">
        <div class="ed-hero-row__head">
          <h2 class="ed-hero-row__title">{{ $t("top_picks_for_you") }}</h2>
        </div>
        <div class="ed-hero-grid">
          <EditorialHeroCard
            class="ed-hero-grid__lead"
            :item="heroEntries[0].item"
            :tag="heroEntries[0].tag"
            large
          />
          <div v-if="heroEntries.length > 1" class="ed-hero-grid__col">
            <EditorialHeroCard
              v-for="entry in heroEntries.slice(1, 3)"
              :key="entry.item.uri"
              :item="entry.item"
              :tag="entry.tag"
            />
          </div>
          <div v-if="heroEntries.length > 3" class="ed-hero-grid__col">
            <EditorialHeroCard
              v-for="entry in heroEntries.slice(3, 5)"
              :key="entry.item.uri"
              :item="entry.item"
              :tag="entry.tag"
            />
          </div>
        </div>
      </section>

      <EditorialShelf
        v-for="(row, idx) in displayedRows"
        :key="row.folder.uri"
        :title="folderTitle(row.folder)"
        :dimmed="editMode && !row.setting.enabled"
        :tiles-per-view="tilesPerView"
      >
        <template v-if="editMode" #actions>
          <v-btn
            :icon="
              row.setting.enabled ? 'mdi-eye-outline' : 'mdi-eye-off-outline'
            "
            size="small"
            variant="text"
            @click="toggleRow(row.folder.uri)"
          />
          <v-btn
            icon="mdi-chevron-up"
            size="small"
            variant="text"
            :disabled="idx === 0"
            @click="moveRow(row.folder.uri, -1)"
          />
          <v-btn
            icon="mdi-chevron-down"
            size="small"
            variant="text"
            :disabled="idx === displayedRows.length - 1"
            @click="moveRow(row.folder.uri, 1)"
          />
        </template>
        <EditorialMediaCard
          v-for="item in row.folder.items"
          :key="item.uri"
          :item="item"
        />
      </EditorialShelf>

      <section v-if="genres.length" class="ed-section ed-genres">
        <h2 class="ed-genres__title">{{ $t("browse_by_genre") }}</h2>
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
import { useUserPreferences } from "@/composables/userPreferences";
import { panelViewItemResponsive, playerVisible } from "@/helpers/utils";
import api from "@/plugins/api";
import {
  type EventMessage,
  EventType,
  type Genre,
  type ItemMapping,
  type MediaItemTypeOrItemMapping,
  MediaType,
  PlaybackState,
  type Player,
  type RecommendationFolder,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
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

// Size the recommendation tiles on the same responsive curve as the rest of
// the app (panelViewItemResponsive), plus the half-tile peek. Recomputes on
// resize because panelViewItemResponsive reads the reactive breakpoint width.
const tilesPerView = computed(() => panelViewItemResponsive(0) + 0.5);

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

const folderTitle = (folder: RecommendationFolder) =>
  folder.translation_key
    ? $t(`recommendations.${folder.translation_key}`, folder.name)
    : folder.name;

// --- Top Picks: a curated mix from specific recommendation folders ---
interface HeroEntry {
  item: MediaItemTypeOrItemMapping;
  tag: string;
}

const norm = (s: string) => (s || "").toLowerCase();
const findFolder = (...needles: string[]) =>
  recommendations.value.find((f) => {
    const hay = `${norm(f.name)} ${norm(folderTitle(f))}`;
    return needles.some((n) => hay.includes(n));
  });

const buildHeroEntries = (): HeroEntry[] => {
  const playlists = findFolder("playlists made for you", "made for you");
  const mood = findFolder("find your mood", "mood");
  const stations = findFolder("stations for you", "radio stations for you");
  const releases = findFolder("new releases for you");
  // "Artist-focused" stations = artist items inside the stations folder.
  const artistStations = (stations?.items ?? []).filter(
    (i) => i.media_type === MediaType.ARTIST,
  );

  const entry = (
    item: MediaItemTypeOrItemMapping | undefined,
    folder: RecommendationFolder | undefined,
  ): HeroEntry | null =>
    item && folder ? { item, tag: folderTitle(folder) } : null;

  const recipe = [
    entry(playlists?.items[0], playlists),
    entry(mood?.items[0], mood),
    entry(artistStations[0], stations),
    entry(releases?.items[0], releases),
    entry(stations?.items[0], stations),
    entry(releases?.items[1], releases),
    entry(artistStations[1], stations),
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

  // Top up to 5 with random unused items from any folder (then recently played).
  if (out.length < 5) {
    const pool: HeroEntry[] = [
      ...recommendations.value.flatMap((f) =>
        f.items.map((item) => ({ item, tag: folderTitle(f) })),
      ),
      ...recentlyPlayed.value.map((item) => ({
        item,
        tag: $t("recently_played"),
      })),
    ].filter((e) => !seen.has(e.item.uri));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const e of pool) {
      if (out.length >= 5) break;
      push(e);
    }
  }
  return out.slice(0, 5);
};

// Top Picks are cached for a couple of hours (per user, in localStorage) so the
// selection stays stable across refreshes instead of reshuffling every load.
const heroEntries = ref<HeroEntry[]>([]);
const HERO_CACHE_KEY = "discoverTopPicks";
const HERO_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

interface HeroCache {
  ts: number;
  userId?: string;
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
      entries,
    };
    localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota / serialization errors — caching is best-effort
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

onMounted(async () => {
  await Promise.all([
    loadRecommendations(),
    api
      .getLibraryGenres({ limit: 8, hide_empty: true })
      .then((g) => (genres.value = g))
      .catch(() => {}),
  ]);
  resolveHeroPicks();
  loading.value = false;

  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    async (evt: EventMessage) => {
      if (evt.data && !(evt.data as Record<string, unknown>).is_playing) {
        await loadRecommendations();
        // Keeps the same picks while the cache is fresh; rebuilds once expired.
        resolveHeroPicks();
      }
    },
  );
  onBeforeUnmount(unsub);
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
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.6);
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
.ed-hero-row__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ed-hero-row__title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.6px;
  color: rgb(var(--v-theme-on-background));
}
.ed-hero-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 14px;
  height: 280px;
}
.ed-hero-grid__col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ed-hero-grid__col > * {
  flex: 1;
  min-height: 0;
}

.ed-genres {
  padding: 0 28px;
}
.ed-genres__title {
  margin: 0 0 14px;
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
    touch-action: pan-x;
    scrollbar-width: none;
    margin-inline: -28px;
    padding-inline: 28px;
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
}

@media (max-width: 600px) {
  .ed-hero-row,
  .ed-genres {
    padding-left: 16px;
    padding-right: 16px;
  }
  .ed-hero-grid {
    margin-inline: -16px;
    padding-inline: 16px;
  }
  .ed-hero-row .ed-hero-grid :deep(.ed-hero) {
    flex: 0 0 82%;
    height: 200px;
  }
  .ed-hero-row__title {
    font-size: 22px;
  }
}
</style>
