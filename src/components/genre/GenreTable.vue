<template>
  <GenreDataTable
    v-model:filter="filter"
    :data="activeGenreRows"
    :excluded-data="excludedGenreRows"
    :loading="loading"
    :counts-loading="countsLoading"
    :filter-options="filterOptions"
    :pending-id="pendingId"
    :restore-pending-id="restorePendingId"
    @navigate="navigateToGenre"
    @navigate-library="navigateToLibraryByGenre"
    @exclude="excludeGenre"
    @restore="restoreGenre"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import GenreDataTable from "@/components/genre/GenreDataTable.vue";
import type {
  ExcludedGenreRow,
  GenreRow,
} from "@/components/genre/GenreDataTable.vue";
import { scheduleGenreScan } from "@/helpers/genre";
import { getGenreDisplayName, getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { EventMessage, Genre } from "@/plugins/api/interfaces";
import { EventType, ImageType } from "@/plugins/api/interfaces";

interface Props {
  version?: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "data-changed": [] }>();

const router = useRouter();
const { t, te } = useI18n();

const filter = ref("all");

const filterOptions = [
  { value: "all", label: t("tooltip.show_all_genres") },
  { value: "non_empty", label: t("tooltip.hide_empty_genres") },
  { value: "default", label: t("tooltip.show_only_default_genres") },
];

const allGenres = ref<Genre[]>([]);
const globalExclusions = ref<Genre[]>([]);
const allMediaCounts = ref<Record<string, Record<string, number>> | null>(null);
const countsLoading = ref(false);
const loading = ref(false);
const pendingId = ref<string | null>(null);
const restorePendingId = ref<string | null>(null);

const activeGenreRows = computed<GenreRow[]>(() =>
  allGenres.value.map((genre) => ({
    id: genre.item_id,
    genre,
    displayName: getGenreDisplayName(genre.name, genre.translation_key, t, te),
    thumbSrc: getImageThumbForItem(genre, ImageType.THUMB, 40) ?? undefined,
    aliasCount: genre.genre_aliases?.length ?? 0,
    trackCount:
      allMediaCounts.value === null
        ? null
        : (allMediaCounts.value[genre.item_id]?.track ?? 0),
    albumCount:
      allMediaCounts.value === null
        ? null
        : (allMediaCounts.value[genre.item_id]?.album ?? 0),
    artistCount:
      allMediaCounts.value === null
        ? null
        : (allMediaCounts.value[genre.item_id]?.artist ?? 0),
    playlistCount:
      allMediaCounts.value === null
        ? null
        : (allMediaCounts.value[genre.item_id]?.playlist ?? 0),
    podcastCount:
      allMediaCounts.value === null
        ? null
        : (allMediaCounts.value[genre.item_id]?.podcast ?? 0),
    audiobookCount:
      allMediaCounts.value === null
        ? null
        : (allMediaCounts.value[genre.item_id]?.audiobook ?? 0),
  })),
);

const excludedGenreRows = computed<ExcludedGenreRow[]>(() =>
  globalExclusions.value.map((genre) => ({
    id: genre.item_id,
    genre,
    displayName: getGenreDisplayName(genre.name, genre.translation_key, t, te),
    thumbSrc: getImageThumbForItem(genre, ImageType.THUMB, 40) ?? undefined,
  })),
);

const loadData = async () => {
  loading.value = true;
  allMediaCounts.value = null;
  try {
    const hideEmpty =
      filter.value === "non_empty"
        ? true
        : filter.value === "default"
          ? null
          : false;
    [allGenres.value, globalExclusions.value] = await Promise.all([
      api.getLibraryGenres({ hide_empty: hideEmpty }),
      api.getGlobalGenreExclusions(),
    ]);
  } finally {
    loading.value = false;
  }
  loadCounts();
};

const loadCounts = async () => {
  if (allGenres.value.length === 0) return;
  countsLoading.value = true;
  try {
    allMediaCounts.value = await api.getGenreMediaCounts(
      allGenres.value.map((g) => g.item_id),
    );
  } catch {
    // Endpoint not yet available
  } finally {
    countsLoading.value = false;
  }
};

const navigateToGenre = (genre: Genre) => {
  router.push({
    name: "genre",
    params: { provider: genre.provider, itemId: genre.item_id },
  });
};

const navigateToLibraryByGenre = (genre: Genre, mediaType: string) => {
  router.push({
    name: `${mediaType}s`,
    query: { genre_ids: genre.item_id },
  });
};

const excludeGenre = async (itemId: string) => {
  pendingId.value = itemId;
  try {
    const genre = allGenres.value.find((g) => g.item_id === itemId);
    await api.removeGenreFromLibrary(itemId);
    allGenres.value = allGenres.value.filter((g) => g.item_id !== itemId);
    if (genre) globalExclusions.value = [...globalExclusions.value, genre];
    scheduleGenreScan();
  } finally {
    pendingId.value = null;
  }
};

const restoreGenre = async (exclusion: Genre) => {
  restorePendingId.value = exclusion.item_id;
  try {
    const restored = await api.removeGlobalGenreExclusion(exclusion.item_id);
    globalExclusions.value = globalExclusions.value.filter(
      (e) => e.item_id !== exclusion.item_id,
    );
    allGenres.value = [...allGenres.value, restored].sort((a, b) =>
      (a.sort_name ?? a.name).localeCompare(b.sort_name ?? b.name),
    );
    emit("data-changed");
    scheduleGenreScan();
  } finally {
    restorePendingId.value = null;
  }
};

let tableReloadTimer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void) | null = null;

const scheduleTableReload = () => {
  if (tableReloadTimer) clearTimeout(tableReloadTimer);
  tableReloadTimer = setTimeout(async () => {
    tableReloadTimer = null;
    await loadData();
    emit("data-changed");
  }, 1500);
};

onMounted(() => {
  unsub = api.subscribe_multi(
    [
      EventType.MEDIA_ITEM_ADDED,
      EventType.MEDIA_ITEM_UPDATED,
      EventType.MEDIA_ITEM_DELETED,
    ],
    (evt: EventMessage) => {
      if (evt.object_id?.startsWith("library://genre")) scheduleTableReload();
    },
  );
});

onBeforeUnmount(() => {
  if (tableReloadTimer) clearTimeout(tableReloadTimer);
  unsub?.();
});

watch(filter, loadData);
watch(() => props.version, loadData, { immediate: true });
</script>
