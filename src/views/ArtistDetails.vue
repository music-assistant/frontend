<template>
  <section class="artist-details">
    <ArtistHero
      :item="itemDetails"
      :release-counts="releaseCounts"
      @edit-rows="rowsEditorOpen = true"
    />

    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <!-- biography -->
        <ArtistBioRow
          v-if="rowId === 'bio' && !!itemDetails.metadata?.description"
          :item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- top tracks, beside the latest release -->
        <ArtistTopTracksRow
          v-else-if="rowId === 'top_tracks' && rowHasItems(topTracksItems)"
          :artist="itemDetails"
          :tracks="topTracksItems"
          :source-label="topTracksProvider?.name"
          :source-domain="topTracksProvider?.domain"
          :library-track-count="libraryTracks?.length"
          :latest-release="latestRelease"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- albums -->
        <ArtistReleaseShelf
          v-else-if="rowId === 'albums' && rowHasItems(albumItems)"
          :title="$t('albums')"
          :meta="albumsMeta"
          :items="albumItems"
          :view-all-to="listingRoute('albums')"
          size="lg"
          :show-library-state="true"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
          @library-changed="refreshReleases"
        />

        <!-- singles & EPs -->
        <ArtistReleaseShelf
          v-else-if="rowId === 'singles_eps' && rowHasItems(singleItems)"
          :title="$t('singles_eps')"
          :meta="singleItems?.length ? String(singleItems.length) : undefined"
          :items="singleItems"
          :view-all-to="listingRoute('singles')"
          :show-library-state="true"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
          @library-changed="refreshReleases"
        />

        <!-- appears on -->
        <ArtistReleaseShelf
          v-else-if="rowId === 'appears_on' && rowHasItems(appearsOnItems)"
          :title="$t('appears_on')"
          :meta="$t('appears_on_hint')"
          :items="appearsOnItems"
          :view-all-to="listingRoute('appears_on')"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- similar artists -->
        <ArtistSimilarShelf
          v-else-if="
            rowId === 'similar_artists' && rowHasItems(similarArtistItems)
          "
          :items="similarArtistItems"
          :source-label="similarArtistsProvider?.name"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- audiobooks in library (library authors/narrators only) -->
        <ItemsListing
          v-else-if="
            rowId === 'audiobooks' &&
            !loading &&
            itemDetails.provider == 'library'
          "
          itemtype="artistaudiobooks"
          path="artistaudiobooks"
          :parent-item="itemDetails"
          :show-provider="true"
          :show-favorites-only-filter="true"
          :show-provider-filter="true"
          :single-provider-filter="true"
          :provider-filter-options="mappingProviderIds"
          :show-album-type-filter="false"
          :show-refresh-button="false"
          :load-items="loadArtistAudiobooks"
          :sort-keys="[
            'sort_name',
            'name',
            'year',
            'name_desc',
            'sort_name_desc',
            'year_desc',
          ]"
          :title="$t('audiobooks')"
          :subtitle="$t('in_library')"
          :empty-message="$t('artist_no_library_audiobooks')"
          :allow-collapse="true"
          :show-collapse-collections="true"
        />

        <!-- all audiobooks (full per-provider listing) -->
        <ItemsListing
          v-else-if="
            rowId === 'audiobooks_all' &&
            !loading &&
            audiobookSourceProviderIds.length > 0
          "
          itemtype="artistaudiobooks"
          path="artistallaudiobooks"
          :parent-item="itemDetails"
          :show-provider="false"
          :show-favorites-only-filter="false"
          :require-provider-selection="true"
          :provider-filter-options="audiobookSourceProviderIds"
          :show-refresh-button="false"
          :load-items="loadAllAudiobooks"
          :sort-keys="[
            'original',
            'name',
            'sort_name',
            'year',
            'name_desc',
            'sort_name_desc',
            'year_desc',
          ]"
          :title="$t('artist_all_audiobooks')"
          :subtitle="$t('on_provider', [activeAudiobookProvider])"
          :allow-collapse="true"
        />

        <!-- provider mapping details -->
        <ProviderDetails
          v-else-if="rowId === 'provider_mappings'"
          :item-details="itemDetails"
        />

        <!-- media images -->
        <MediaItemImages
          v-else-if="
            rowId === 'artwork' &&
            itemDetails.provider == 'library' &&
            itemDetails.metadata?.images
          "
          v-model="itemDetails.metadata.images"
          @update:model-value="UpdateItemInDb"
        />
      </template>
    </template>
    <!-- ArtistRowsEditor mounts here -->
    <br />
  </section>
</template>

<script setup lang="ts">
import ArtistBioRow from "@/components/artist/ArtistBioRow.vue";
import {
  appearsOnAlbums,
  isInLibrary,
  isSingleOrEp,
  loadArtistLibraryTracks,
  loadArtistReleases,
  loadArtistTopTracks,
  loadSimilarArtists,
  sortReleasesNewestFirst,
} from "@/components/artist/artistData";
import ArtistHero from "@/components/artist/ArtistHero.vue";
import ArtistReleaseShelf from "@/components/artist/ArtistReleaseShelf.vue";
import {
  availableArtistRowIds,
  effectiveArtistRowSource,
  resolveArtistRows,
  type ArtistRowId,
  type ArtistRowSource,
} from "@/components/artist/artistRows";
import ArtistSimilarShelf from "@/components/artist/ArtistSimilarShelf.vue";
import ArtistTopTracksRow from "@/components/artist/ArtistTopTracksRow.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import MediaItemImages from "@/components/MediaItemImages.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { api } from "@/plugins/api";
import {
  ArtistType,
  EventMessage,
  EventType,
  MediaItemType,
  ProviderFeature,
  type Album,
  type Artist,
  type ItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();

const itemDetails = ref<Artist>();
const loading = ref(false);
const rowsEditorOpen = ref(false);

// Row data per source: two rows fed by the same source share one request and
// a source change in the editor loads the new one. Absent = still loading.
const releases = ref(new Map<ArtistRowSource, Album[]>());
const topTracks = ref(new Map<ArtistRowSource, Track[]>());
const similarArtists = ref(new Map<ArtistRowSource, Artist[]>());
const libraryTracks = ref<Track[]>();

// the requests already sent for the artist currently shown, as "<kind>:<source>"
let requested = new Set<string>();

const isAudiobookArtist = computed(() => {
  const artistType = itemDetails.value?.artist_type;
  return artistType === ArtistType.AUTHOR || artistType === ArtistType.NARRATOR;
});

// appearances are derived from the library, so a provider-only artist has none
const availableRows = computed(() =>
  availableArtistRowIds(isAudiobookArtist.value, authManager.isAdmin()).filter(
    (rowId) =>
      rowId !== "appears_on" || itemDetails.value?.provider === "library",
  ),
);

// reads the user's preferences from the store, so the page follows the editor
const visibleRows = computed(() => {
  const { order, hidden } = resolveArtistRows(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});

const rowSource = function (rowId: ArtistRowId): ArtistRowSource | undefined {
  if (!itemDetails.value) return undefined;
  return effectiveArtistRowSource(
    rowId,
    itemDetails.value,
    api.supportsArtistDiscography,
  );
};

const albumsSource = computed(() => rowSource("albums"));
const singlesSource = computed(() => rowSource("singles_eps"));
const topTracksSource = computed(() => rowSource("top_tracks"));
const similarArtistsSource = computed(() => rowSource("similar_artists"));

// releases sorted newest first, from the source that feeds the given row
const sortedReleases = function (source?: ArtistRowSource) {
  const items = sourceItems(releases.value, source);
  return items ? sortReleasesNewestFirst(items) : undefined;
};

const albumSourceReleases = computed(() => sortedReleases(albumsSource.value));
const singlesSourceReleases = computed(() =>
  sortedReleases(singlesSource.value),
);

const albumItems = computed(() =>
  albumSourceReleases.value?.filter((album) => !isSingleOrEp(album)),
);
const singleItems = computed(() =>
  singlesSourceReleases.value?.filter((album) => isSingleOrEp(album)),
);
const latestRelease = computed(() => albumSourceReleases.value?.[0]);

const albumsMeta = computed(() =>
  albumItems.value?.length
    ? `${albumItems.value.length} · ${$t("newest_first")}`
    : undefined,
);

// the in-library albums are the ones the artist is an album artist of, so
// every other album their library tracks point at is an appearance
const appearsOnItems = computed<Array<Album | ItemMapping> | undefined>(() => {
  const ownAlbums = releases.value.get("library");
  if (!itemDetails.value || !libraryTracks.value || !ownAlbums)
    return undefined;
  return appearsOnAlbums(libraryTracks.value, itemDetails.value, ownAlbums);
});

// the full discography is the only list that knows how much of it is missing
const releaseCounts = computed(() => {
  const all = releases.value.get("all");
  if (!all?.length) return undefined;
  return {
    inLibrary: all.filter((album) => isInLibrary(album)).length,
    total: all.length,
  };
});

// falls back to the newest library tracks when no provider supplies top tracks
const topTracksItems = computed(() => {
  const items = sourceItems(topTracks.value, topTracksSource.value);
  if (items === undefined) return undefined;
  if (items.length) return items;
  return libraryTracks.value && newestLibraryTracks(libraryTracks.value);
});

const similarArtistItems = computed(() =>
  sourceItems(similarArtists.value, similarArtistsSource.value),
);

const topTracksProvider = computed(() => sourceProvider(topTracksSource.value));
const similarArtistsProvider = computed(() =>
  sourceProvider(similarArtistsSource.value),
);

// library audiobooks can be filtered to the providers the artist is mapped to
const mappingProviderIds = computed(() => [
  ...new Set(
    (itemDetails.value?.provider_mappings || []).map(
      (mapping) => mapping.provider_instance,
    ),
  ),
]);

// unique providers the artist is mapped to that can supply the full
// per-provider audiobook listing. each entry keeps the artist's id on that
// provider so the backend can be queried directly for its complete catalog.
const audiobookSourceMappings = computed(() => {
  const feature =
    itemDetails.value?.artist_type === ArtistType.AUTHOR
      ? ProviderFeature.AUTHOR_AUDIOBOOKS
      : ProviderFeature.NARRATOR_AUDIOBOOKS;
  const seen = new Set<string>();
  const mappings: { provider_instance: string; item_id: string }[] = [];
  for (const mapping of itemDetails.value?.provider_mappings || []) {
    if (seen.has(mapping.provider_instance)) continue;
    if (!providerAllowed(mapping.provider_instance)) continue;
    const provider = api.providers[mapping.provider_instance];
    if (!provider?.supported_features.includes(feature)) continue;
    seen.add(mapping.provider_instance);
    mappings.push({
      provider_instance: mapping.provider_instance,
      item_id: mapping.item_id,
    });
  }
  // first entry is the default source: sort by provider name to match the
  // (alphabetically sorted) order shown in the provider selector.
  return mappings.sort((a, b) =>
    (api.providers[a.provider_instance]?.name || "").localeCompare(
      api.providers[b.provider_instance]?.name || "",
    ),
  );
});

const audiobookSourceProviderIds = computed(() =>
  audiobookSourceMappings.value.map((mapping) => mapping.provider_instance),
);

const activeAudiobookProvider = computed(
  () => api.providers[audiobookSourceProviderIds.value[0]]?.name || "",
);

const loadItemDetails = async function () {
  loading.value = true;
  itemDetails.value = await api.getArtist(props.itemId, props.provider);
  loading.value = false;
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

// a new artist starts from empty rows; anything else (a favorite toggle, a
// metadata update) keeps what is already loaded
watch(
  () => itemDetails.value?.uri,
  () => {
    releases.value = new Map();
    topTracks.value = new Map();
    similarArtists.value = new Map();
    libraryTracks.value = undefined;
    requested = new Set();
    loadRowData();
  },
);

// unhiding a row or switching its source in the editor loads what it needs,
// without re-requesting what the visible rows already share
watch(
  [
    visibleRows,
    albumsSource,
    singlesSource,
    topTracksSource,
    similarArtistsSource,
  ],
  () => loadRowData(),
);

onMounted(() => {
  //signal if/when item updates
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      // check if the updated item is the current item
      if (itemDetails.value?.uri == updatedItem.uri) {
        // update UI with the updated item
        loading.value = true;
        itemDetails.value = updatedItem as Artist;
        loading.value = false;
      } else if ("provider_mappings" in updatedItem) {
        for (const provMap of updatedItem.provider_mappings) {
          if (
            provMap.item_id == props.itemId &&
            [provMap.provider_instance, provMap.provider_domain].includes(
              props.provider,
            )
          ) {
            loading.value = true;
            itemDetails.value = updatedItem as Artist;
            loading.value = false;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadArtistAudiobooks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistAudiobooks(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    itemDetails.value.artist_type,
    undefined,
    params.collapseCollections,
  );
};

const loadAllAudiobooks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  const mappings = audiobookSourceMappings.value;
  const providerId = params.provider?.[0] ?? mappings[0]?.provider_instance;
  const source = mappings.find((m) => m.provider_instance === providerId);
  if (!source) return [];
  return await api.getArtistAudiobooks(
    source.item_id,
    source.provider_instance,
    itemDetails.value.artist_type,
  );
};

const UpdateItemInDb = async function () {
  if (!itemDetails.value) return;
  itemDetails.value = await api.sendCommand("music/artists/update", {
    item_id: itemDetails.value.item_id,
    update: itemDetails.value,
    overwrite: true,
  });
};

/** A row is rendered while it loads and once it has something to show. */
function rowHasItems(items?: unknown[]): boolean {
  return items === undefined || items.length > 0;
}

/** The "View all" target of a shelf. */
function listingRoute(listing: string): RouteLocationRaw | undefined {
  if (!itemDetails.value) return undefined;
  return {
    name: "artistlisting",
    params: {
      provider: itemDetails.value.provider,
      itemId: itemDetails.value.item_id,
      listing,
    },
  };
}

/** The provider behind a row's source, when a single one feeds it. */
function sourceProvider(source?: ArtistRowSource) {
  if (!source || source === "all" || source === "library") return undefined;
  const provider = api.getProvider(source);
  return provider && { name: provider.name, domain: provider.domain };
}

/** The library tracks of the newest releases first, the top-tracks fallback. */
function newestLibraryTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => albumYear(b) - albumYear(a));
}

/** The release year of a track's album, 0 when it carries none. */
function albumYear(track: Track): number {
  return (track.album && "year" in track.album && track.album.year) || 0;
}

// a user-level provider_filter, when set, restricts which providers are offered
// (mirrors the listing's own provider selector).
function providerAllowed(instanceId: string): boolean {
  return !(
    store.currentUser &&
    store.currentUser.provider_filter.length > 0 &&
    !store.currentUser.provider_filter.includes(instanceId)
  );
}

/** Request what the visible rows need, skipping what is already on its way. */
function loadRowData() {
  const artist = itemDetails.value;
  if (!artist) return;
  const rows = visibleRows.value;
  // the hero's release chip needs the complete discography
  if (artist.provider === "library" && api.supportsArtistDiscography) {
    fetchReleases(artist, "all");
  }
  if (rows.includes("albums")) fetchReleases(artist, albumsSource.value!);
  if (rows.includes("singles_eps")) fetchReleases(artist, singlesSource.value!);
  if (rows.includes("appears_on")) {
    fetchReleases(artist, "library");
    fetchLibraryTracks(artist);
  }
  if (rows.includes("top_tracks")) {
    fetchLibraryTracks(artist);
    fetchTopTracks(artist, topTracksSource.value!);
  }
  if (rows.includes("similar_artists")) {
    fetchSimilarArtists(artist, similarArtistsSource.value!);
  }
}

/** Reloads every release list on screen, so a library change made from a shelf shows everywhere. */
function refreshReleases() {
  const artist = itemDetails.value;
  if (!artist) return;
  for (const source of releases.value.keys()) {
    requested.delete(`releases:${source}`);
    fetchReleases(artist, source);
  }
}

function fetchReleases(artist: Artist, source: ArtistRowSource) {
  return fetchInto(
    artist,
    "releases",
    source,
    releases.value,
    loadArtistReleases,
  );
}

function fetchTopTracks(artist: Artist, source: ArtistRowSource) {
  return fetchInto(
    artist,
    "top_tracks",
    source,
    topTracks.value,
    loadArtistTopTracks,
  );
}

function fetchSimilarArtists(artist: Artist, source: ArtistRowSource) {
  return fetchInto(
    artist,
    "similar_artists",
    source,
    similarArtists.value,
    loadSimilarArtists,
  );
}

async function fetchLibraryTracks(artist: Artist) {
  if (requested.has("library_tracks")) return;
  requested.add("library_tracks");
  const items = await orEmpty(loadArtistLibraryTracks(artist));
  if (stillShown(artist)) libraryTracks.value = items;
}

/** One request per kind and source, kept for every row that shares it. */
async function fetchInto<T>(
  artist: Artist,
  kind: string,
  source: ArtistRowSource,
  cache: Map<ArtistRowSource, T[]>,
  load: (artist: Artist, source: ArtistRowSource) => Promise<T[]>,
) {
  const key = `${kind}:${source}`;
  if (requested.has(key)) return;
  requested.add(key);
  const items = await orEmpty(load(artist, source));
  if (stillShown(artist)) cache.set(source, items);
}

/** The cached items of a source, undefined while unknown or still loading. */
function sourceItems<T>(
  cache: Map<ArtistRowSource, T[]>,
  source?: ArtistRowSource,
): T[] | undefined {
  return source ? cache.get(source) : undefined;
}

/** Whether a finished request still belongs to the artist on screen. */
function stillShown(artist: Artist): boolean {
  return itemDetails.value?.uri === artist.uri;
}

/** A failing provider must not blank the page, so its row just stays empty. */
async function orEmpty<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request;
  } catch (err) {
    console.error("[ArtistDetails] failed to load a row", err);
    return [];
  }
}
</script>
