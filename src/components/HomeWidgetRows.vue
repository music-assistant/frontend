<template>
  <div>
    <div v-if="loading" class="ed-loading">
      <v-progress-circular indeterminate />
    </div>

    <template v-else>
      <EditorialShelf
        v-if="players.length"
        class="ed-players"
        :gap="12"
        :nav-center="42"
      >
        <template #header>
          <div class="ed-players__head">
            <h2 class="ed-players__label">{{ $t("players") }}</h2>
            <span v-if="activeCount" class="ed-players__count">
              {{ activeCount }} {{ $t("state.playing") }}
            </span>
          </div>
        </template>
        <div
          v-for="player in players"
          :key="player.player_id"
          class="ed-player-slot"
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

      <section v-if="heroItems.length" class="ed-section ed-hero-row">
        <div class="ed-hero-row__head">
          <h2 class="ed-hero-row__title">{{ $t("top_picks_for_you") }}</h2>
        </div>
        <div class="ed-hero-grid">
          <EditorialHeroCard
            class="ed-hero-grid__lead"
            :item="heroItems[0]"
            :tag="heroTag"
            large
          />
          <div v-if="heroItems.length > 1" class="ed-hero-grid__col">
            <EditorialHeroCard
              v-for="item in heroItems.slice(1, 3)"
              :key="item.uri"
              :item="item"
              :tag="heroTag"
            />
          </div>
          <div v-if="heroItems.length > 3" class="ed-hero-grid__col">
            <EditorialHeroCard
              v-for="item in heroItems.slice(3, 5)"
              :key="item.uri"
              :item="item"
              :tag="heroTag"
            />
          </div>
        </div>
      </section>

      <EditorialShelf
        v-for="(row, idx) in displayedRows"
        :key="row.folder.uri"
        :title="folderTitle(row.folder)"
        :dimmed="editMode && !row.setting.enabled"
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
import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import PlayerCard from "@/components/PlayerCard.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { playerVisible } from "@/helpers/utils";
import api from "@/plugins/api";
import {
  type EventMessage,
  EventType,
  type Genre,
  type ItemMapping,
  MediaType,
  PlaybackState,
  type Player,
  type RecommendationFolder,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{ editMode?: boolean }>(), {
  editMode: false,
});

const loading = ref(true);
const recommendations = ref<RecommendationFolder[]>([]);
const recentlyPlayed = ref<ItemMapping[]>([]);
const genres = ref<Genre[]>([]);

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

const folderTitle = (folder: RecommendationFolder) =>
  folder.translation_key
    ? $t(`recommendations.${folder.translation_key}`, folder.name)
    : folder.name;

const HERO_MEDIA_TYPES = [
  MediaType.ALBUM,
  MediaType.PLAYLIST,
  MediaType.ARTIST,
  MediaType.TRACK,
];

const heroFolder = computed(() => {
  const folders = recommendations.value.filter((f) => f.items.length);
  return (
    folders.find((f) =>
      f.items.some((it) => HERO_MEDIA_TYPES.includes(it.media_type)),
    ) || folders[0]
  );
});

const heroItems = computed(() => {
  if (heroFolder.value) return heroFolder.value.items.slice(0, 5);
  return recentlyPlayed.value.slice(0, 5);
});

const heroTag = computed(() =>
  heroFolder.value ? folderTitle(heroFolder.value) : $t("recently_played"),
);

// --- Recommendation shelves with per-row visibility + ordering (edit mode) ---
interface RowSetting {
  position: number;
  enabled: boolean;
}
const { getPreference, setPreference } = useUserPreferences();
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

const orderedRows = computed(() =>
  recommendations.value
    .filter((f) => f.items.length && f.uri !== heroFolder.value?.uri)
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
  loading.value = false;

  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    async (evt: EventMessage) => {
      if (evt.data && !(evt.data as Record<string, unknown>).is_playing) {
        loadRecommendations();
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
  align-items: baseline;
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
  .ed-hero-grid {
    grid-template-columns: 1fr 1fr;
    height: auto;
  }
  .ed-hero-grid__lead {
    grid-column: 1 / -1;
    min-height: 240px;
  }
  .ed-genres__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .ed-hero-row,
  .ed-genres {
    padding-left: 16px;
    padding-right: 16px;
  }
  .ed-hero-grid {
    grid-template-columns: 1fr;
  }
  .ed-hero-row__title {
    font-size: 22px;
  }
}
</style>
