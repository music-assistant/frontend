<template>
  <PlayersWidgetRow
    v-if="widgetRowSettings['players']?.enabled || editMode"
    :settings="widgetRowSettings['players']"
    :edit-mode="editMode"
    @update:settings="(settings) => onUpdateSettings('players', settings)"
  />
  <div
    v-for="widgetRow in widgetRows
      .filter((x) => x.items.length && (x.settings!.enabled || editMode))
      .sort((a, b) => a.settings!.position - b.settings!.position)"
    :key="widgetRow.uri"
  >
    <HomeWidgetRow
      v-if="widgetRows.length"
      :widget-row="widgetRow"
      :edit-mode="editMode"
      @update:settings="
        (settings) => onUpdateSettings(widgetRow.uri!, settings)
      "
    />
  </div>
</template>

<script setup lang="ts">
import HomeWidgetRow, {
  WidgetRow,
  WidgetRowSettings,
} from "@/components/WidgetRow.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaType,
  type SonicSimilarItem,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import PlayersWidgetRow from "./PlayersWidgetRow.vue";

const widgetRows = ref<WidgetRow[]>([]);
const widgetRowSettings = ref<Record<string, WidgetRowSettings>>({});
const { getPreference, setPreference } = useUserPreferences();
const savedSettings = getPreference<Record<string, WidgetRowSettings>>(
  "widgetRowSettings",
  {
    players: {
      position: 0,
      enabled: true,
    },
  },
);

export interface Props {
  editMode?: boolean;
}
withDefaults(defineProps<Props>(), {
  editMode: false,
});

const loadData = async function () {
  if (store.currentUser?.preferences) {
    widgetRowSettings.value = savedSettings.value || {
      players: {
        position: 0,
        enabled: true,
      },
    };
  } else {
    widgetRowSettings.value = {
      players: {
        position: 0,
        enabled: true,
      },
    };
  }

  const recommendations = await api.getRecommendations();
  const _widgetRows: WidgetRow[] = [];
  let idx = 0;
  for (const recommendation of recommendations) {
    idx++;
    const settings = widgetRowSettings.value[recommendation.uri] || {
      position: idx,
      enabled: true,
    };
    const title = recommendation.translation_key
      ? $t(
          `recommendations.${recommendation.translation_key}`,
          recommendation.name,
        )
      : recommendation.name;
    _widgetRows.push({
      ...recommendation,
      settings,
      title,
    });
    widgetRows.value = _widgetRows;
  }

  await maybeAddInspiredRow(_widgetRows, recommendations);
  widgetRows.value = [..._widgetRows];
};

const INSPIRED_ROW_URI = "sonic_similarity/inspired";

const maybeAddInspiredRow = async function (
  rows: WidgetRow[],
  recommendations: { translation_key?: string }[],
) {
  // Skip everything when the optional sonic_similarity plugin isn't loaded.
  // sendCommand's global error handler fires a toast on every error result,
  // so we must avoid the API call entirely rather than rely on try/catch —
  // the toast would still surface before the local catch swallows the promise.
  const sonicSimilarityLoaded = Object.values(api.providers).some(
    (p) => p.domain === "sonic_similarity",
  );
  if (!sonicSimilarityLoaded) return;

  try {
    const ssStatus = await api.getSonicSimilarityStatus();
    if (!((ssStatus.index_size ?? 0) > 0) || !ssStatus.has_corpus_stats) {
      return;
    }

    const recent = await api.getRecentlyPlayedItems(5, [MediaType.TRACK]);
    if (recent.length === 0) return;

    // Resolve each recent ItemMapping to a full Track so we can pick an
    // underlying provider_mapping. The audio_analysis cache is keyed by the
    // streaming provider's item_id (a file path for filesystem-backed
    // tracks), not the library aggregator's numeric id.
    const recentTracks = await Promise.allSettled(
      recent.map((r) => api.getTrack(r.item_id, r.provider)),
    );
    const seedIds: string[] = [];
    const seedKeys = new Set<string>();
    for (const r of recentTracks) {
      if (r.status !== "fulfilled") continue;
      const mapping = r.value.provider_mappings?.find(
        (m) => m.provider_domain !== "library",
      );
      if (mapping) {
        seedIds.push(mapping.item_id);
        seedKeys.add(`${mapping.provider_domain}:${mapping.item_id}`);
      }
    }
    if (seedIds.length === 0) return;

    // Per-seed top-N rather than blending across seeds: ask the engine for
    // the 5 most-similar tracks to each seed independently, then walk the
    // results in seed order (most-recent play first) deduping by
    // (provider, item_id) until we hit the target count. This avoids the
    // averaging effect that produced muddy multi-genre recommendations.
    const PER_SEED_LIMIT = 5;
    const TARGET_TOTAL = 25;
    const perSeedResults = await Promise.allSettled(
      seedIds.map((sid) =>
        api.getSonicSimilar([sid], "centroid", PER_SEED_LIMIT),
      ),
    );

    const seenItems = new Set<string>(seedKeys);
    const orderedItems: SonicSimilarItem[] = [];
    for (const result of perSeedResults) {
      if (result.status !== "fulfilled") continue;
      if (!result.value.analyzed) continue;
      for (const item of result.value.items) {
        const key = `${item.provider}:${item.item_id}`;
        if (seenItems.has(key)) continue;
        seenItems.add(key);
        orderedItems.push(item);
        if (orderedItems.length >= TARGET_TOTAL) break;
      }
      if (orderedItems.length >= TARGET_TOTAL) break;
    }
    if (orderedItems.length === 0) return;

    const resolved = await Promise.allSettled(
      orderedItems.map((it) => api.getTrack(it.item_id, it.provider)),
    );
    const tracks = resolved
      .filter(
        (r): r is PromiseFulfilledResult<Track> => r.status === "fulfilled",
      )
      .map((r) => r.value);
    if (tracks.length === 0) return;

    const recentlyPlayedIdx = recommendations.findIndex(
      (r) => r.translation_key === "recently_played",
    );
    const insertAt =
      recentlyPlayedIdx >= 0 ? recentlyPlayedIdx + 1 : rows.length;

    const settings = widgetRowSettings.value[INSPIRED_ROW_URI] || {
      position: insertAt + 1,
      enabled: true,
    };

    rows.splice(insertAt, 0, {
      uri: INSPIRED_ROW_URI,
      title: $t("recommendations.inspired_by_recently_played"),
      items: tracks,
      settings,
    });
  } catch {
    // sonic_similarity not installed or not ready — silently omit the row
  }
};

onMounted(() => {
  loadData();
  // signal if/when an item is played (to refresh recommendations)
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    async (evt: EventMessage) => {
      if (evt.data && !(evt.data as Record<string, unknown>).is_playing) {
        loadData();
      }
    },
  );
  onBeforeUnmount(unsub);
});

watch(
  savedSettings,
  (newVal) => {
    if (newVal) {
      loadData();
    }
  },
  { immediate: false, deep: true },
);

const onUpdateSettings = function (uri: string, settings: WidgetRowSettings) {
  // update the item in-place of the list
  for (const widgetRow of widgetRows.value) {
    if (widgetRow.uri === uri) {
      widgetRow.settings = settings;
      break;
    }
  }
  // update persistent settings
  widgetRowSettings.value[uri] = settings;
  setPreference("widgetRowSettings", widgetRowSettings.value);
};
</script>

<style></style>
