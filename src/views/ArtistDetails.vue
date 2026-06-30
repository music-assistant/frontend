<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <!-- begin artist_type == ArtistType.SINGER -->
    <div v-if="itemDetails && itemDetails.artist_type == ArtistType.SINGER">
      <!-- albums in library (library artists only) -->
      <ItemsListing
        v-if="itemDetails && !loading && itemDetails.provider == 'library'"
        itemtype="artistalbums"
        :path="`artistalbums.${itemId}.${provider}`"
        :parent-item="itemDetails"
        :show-provider="true"
        :show-favorites-only-filter="true"
        :show-provider-filter="true"
        :single-provider-filter="true"
        :provider-filter-options="mappingProviderIds"
        :show-album-type-filter="true"
        :show-refresh-button="false"
        :load-items="loadArtistAlbums"
        :sort-keys="[
          'sort_name',
          'name',
          'year',
          'name_desc',
          'sort_name_desc',
          'year_desc',
        ]"
        :title="$t('albums')"
        :subtitle="$t('in_library')"
        :empty-message="$t('artist_no_library_albums')"
        :allow-collapse="true"
      />
      <!-- tracks in library (library artists only) -->
      <ItemsListing
        v-if="itemDetails && !loading && itemDetails.provider == 'library'"
        itemtype="artisttracks"
        :path="`artisttracks.${itemId}.${provider}`"
        :parent-item="itemDetails"
        :show-provider="true"
        :show-favorites-only-filter="true"
        :show-provider-filter="mappingProviderIds.length > 1"
        :single-provider-filter="true"
        :provider-filter-options="mappingProviderIds"
        :show-refresh-button="false"
        :show-track-number="false"
        :load-items="loadArtistTracks"
        :sort-keys="[
          'sort_name',
          'name',
          'album',
          'album_sort_name',
          'duration',
          'name_desc',
          'sort_name_desc',
          'duration_desc',
        ]"
        :title="$t('tracks')"
        :subtitle="$t('in_library')"
        :empty-message="$t('artist_no_library_tracks')"
        :allow-collapse="true"
      />
      <!-- all albums (full per-provider listing) -->
      <ItemsListing
        v-if="itemDetails && !loading && albumSourceProviderIds.length > 0"
        itemtype="artistalbums"
        path="artistallalbums"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :require-provider-selection="true"
        :provider-filter-options="albumSourceProviderIds"
        :show-refresh-button="false"
        :load-items="loadAllAlbums"
        :sort-keys="[
          'original',
          'name',
          'sort_name',
          'year',
          'name_desc',
          'sort_name_desc',
          'year_desc',
        ]"
        :title="$t('artist_all_albums')"
        :subtitle="$t('on_provider', [activeAlbumProvider])"
        :allow-collapse="true"
      />
      <!-- all tracks (full per-provider listing) -->
      <ItemsListing
        v-if="itemDetails && !loading && trackSourceProviderIds.length > 0"
        itemtype="artisttracks"
        path="artistalltracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :require-provider-selection="true"
        :provider-filter-options="trackSourceProviderIds"
        :show-refresh-button="false"
        :show-track-number="false"
        :load-items="loadAllTracks"
        :sort-keys="[
          'original',
          'name',
          'sort_name',
          'album',
          'duration',
          'name_desc',
          'sort_name_desc',
          'duration_desc',
        ]"
        :title="$t('artist_all_tracks')"
        :subtitle="$t('on_provider', [activeTrackProvider])"
        :allow-collapse="true"
      />
      <!-- top albums (per provider) -->
      <ItemsListing
        v-if="itemDetails && !loading && hasTopAlbumsProvider"
        itemtype="artistalbums"
        path="artisttopalbums"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :require-provider-selection="true"
        :provider-filter-options="topAlbumProviderIds"
        :show-refresh-button="false"
        :load-items="loadArtistTopAlbums"
        :sort-keys="['original', 'name', 'year', 'year_desc']"
        :title="$t('artist_topalbums')"
        :subtitle="$t('on_provider', [activeTopAlbumProvider])"
        :allow-collapse="true"
      />
      <!-- top tracks (per provider) -->
      <ItemsListing
        v-if="itemDetails && !loading && hasTopTracksProvider"
        itemtype="artisttracks"
        path="artisttoptracks"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :require-provider-selection="true"
        :provider-filter-options="topTrackProviderIds"
        :show-refresh-button="false"
        :show-track-number="false"
        :load-items="loadArtistTopTracks"
        :sort-keys="['original', 'name', 'duration', 'duration_desc']"
        :title="$t('artist_toptracks')"
        :subtitle="$t('on_provider', [activeTopTrackProvider])"
        :allow-collapse="true"
      />
      <!-- similar artists (per provider) -->
      <ItemsListing
        v-if="itemDetails && !loading && hasSimilarArtistsProvider"
        itemtype="similarartists"
        path="similarartists"
        :parent-item="itemDetails"
        :show-provider="false"
        :show-favorites-only-filter="false"
        :require-provider-selection="true"
        :provider-filter-options="similarArtistsProviderIds"
        :show-refresh-button="false"
        :load-items="loadSimilarArtists"
        :title="$t('similar_artists')"
        :subtitle="$t('on_provider', [activeSimilarArtistsProvider])"
        :allow-collapse="true"
      />
    </div>
    <!-- end artist_type == ArtistType.SINGER -->
    <!-- begin artist_type == ArtistType.AUTHOR or NARRATOR -->
    <div
      v-if="
        itemDetails &&
        [ArtistType.AUTHOR, ArtistType.NARRATOR].includes(
          itemDetails.artist_type,
        )
      "
    >
      <!-- audiobooks in library (library artists only) -->
      <ItemsListing
        v-if="itemDetails && !loading && itemDetails.provider == 'library'"
        itemtype="artistaudiobooks"
        :path="`artistaudiobooks.${itemId}.${provider}`"
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
      />
      <!-- all audiobooks (full per-provider listing) -->
      <ItemsListing
        v-if="itemDetails && !loading && audiobookSourceMappings.length > 0"
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
    </div>
    <!-- end artist_type == ArtistType.AUTHOR or NARRATOR -->
    <!-- media images -->
    <MediaItemImages
      v-if="
        itemDetails?.provider == 'library' &&
        itemDetails?.metadata?.images &&
        authManager.isAdmin()
      "
      v-model="itemDetails.metadata.images"
      @update:model-value="UpdateItemInDb"
    />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
    <br />
  </section>
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import MediaItemImages from "@/components/MediaItemImages.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import {
  ArtistType,
  EventMessage,
  EventType,
  MediaItemType,
  ProviderFeature,
  ProviderType,
  type Artist,
} from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Artist>();
const loading = ref(false);

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

// library albums/tracks can be filtered to the providers the artist is
// actually mapped to.
const mappingProviderIds = computed(() => [
  ...new Set(
    (itemDetails.value?.provider_mappings || []).map(
      (mapping) => mapping.provider_instance,
    ),
  ),
]);

// a user-level provider_filter, when set, restricts which providers are offered
// (mirrors the listing's own provider selector).
const providerAllowed = (instanceId: string) =>
  !(
    store.currentUser &&
    store.currentUser.provider_filter.length > 0 &&
    !store.currentUser.provider_filter.includes(instanceId)
  );

// unique providers the artist is mapped to that can supply the full per-provider
// listing for a feature. each entry keeps the artist's id on that provider so
// the backend can be queried directly for that provider's complete catalog.
const sourceMappingsForFeature = (feature: ProviderFeature) =>
  computed(() => {
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

const albumSourceMappings = sourceMappingsForFeature(
  ProviderFeature.ARTIST_ALBUMS,
);
const trackSourceMappings = sourceMappingsForFeature(
  ProviderFeature.ARTIST_TRACKS,
);
const audiobookSourceMappings = (() => {
  if (itemDetails.value?.artist_type === ArtistType.AUTHOR) {
    return sourceMappingsForFeature(ProviderFeature.AUTHOR_AUDIOBOOKS);
  }
  return sourceMappingsForFeature(ProviderFeature.NARRATOR_AUDIOBOOKS);
})();

const albumSourceProviderIds = computed(() =>
  albumSourceMappings.value.map((mapping) => mapping.provider_instance),
);
const audiobookSourceProviderIds = computed(() =>
  audiobookSourceMappings.value.map((mapping) => mapping.provider_instance),
);
const trackSourceProviderIds = computed(() =>
  trackSourceMappings.value.map((mapping) => mapping.provider_instance),
);

// query the selected provider directly (defaulting to the first one) for that
// provider's complete album/track listing.
const loadAllAlbums = async function (params: LoadDataParams) {
  const mappings = albumSourceMappings.value;
  const providerId = params.provider?.[0] ?? mappings[0]?.provider_instance;
  const source = mappings.find((m) => m.provider_instance === providerId);
  if (!source) return [];
  return await api.getArtistAlbums(source.item_id, source.provider_instance);
};

const loadAllAudiobooks = async function (params: LoadDataParams) {
  const mappings = audiobookSourceMappings.value;
  const providerId = params.provider?.[0] ?? mappings[0]?.provider_instance;
  const source = mappings.find((m) => m.provider_instance === providerId);
  if (!source) return [];
  if (!itemDetails.value) return [];
  return await api.getArtistAudiobooks(
    source.item_id,
    source.provider_instance,
    itemDetails.value.artist_type,
  );
};

const loadAllTracks = async function (params: LoadDataParams) {
  const mappings = trackSourceMappings.value;
  const providerId = params.provider?.[0] ?? mappings[0]?.provider_instance;
  const source = mappings.find((m) => m.provider_instance === providerId);
  if (!source) return [];
  return await api.getArtistTracks(source.item_id, source.provider_instance);
};

// the per-media-type provider selection each listing persists, used to resolve
// the active provider shown in its "On <provider>" subtitle.
const { getItemsListingPreferences } = useUserPreferences();
const albumListingPrefs = getItemsListingPreferences(
  "artistallalbums",
  "artistalbums",
);
const trackListingPrefs = getItemsListingPreferences(
  "artistalltracks",
  "artisttracks",
);

// the active provider's display name: the stored selection when valid for this
// artist, otherwise the default (first) provider.
const activeProviderName = (
  providerIds: string[],
  selectedProviderId: string | undefined,
) => {
  if (providerIds.length === 0) return "";
  const activeId =
    selectedProviderId && providerIds.includes(selectedProviderId)
      ? selectedProviderId
      : providerIds[0];
  return api.providers[activeId]?.name || "";
};

const activeAlbumProvider = computed(() =>
  activeProviderName(
    albumSourceProviderIds.value,
    albumListingPrefs.value.providerFilter?.[0],
  ),
);
const activeTrackProvider = computed(() =>
  activeProviderName(
    trackSourceProviderIds.value,
    trackListingPrefs.value.providerFilter?.[0],
  ),
);
const activeAudiobookProvider = computed(() =>
  activeProviderName(audiobookSourceProviderIds.value, undefined),
);

// providers for the backend-aggregated features (top albums/tracks, similar
// artists): those the artist is mapped to that support the feature, plus — for
// library items — any metadata/plugin provider that does. (a provider item can
// only use its own provider.)
const aggregatedProviderIdsForFeature = (feature: ProviderFeature) =>
  computed(() => {
    if (!itemDetails.value) return [];
    const ids = new Set<string>();
    for (const mapping of itemDetails.value.provider_mappings || []) {
      if (!providerAllowed(mapping.provider_instance)) continue;
      if (
        api.providers[mapping.provider_instance]?.supported_features.includes(
          feature,
        )
      ) {
        ids.add(mapping.provider_instance);
      }
    }
    if (itemDetails.value.provider === "library") {
      for (const provider of Object.values(api.providers)) {
        if (!providerAllowed(provider.instance_id)) continue;
        const isMetadataOrPlugin =
          provider.type === ProviderType.METADATA ||
          provider.type === ProviderType.PLUGIN;
        if (
          isMetadataOrPlugin &&
          provider.supported_features.includes(feature)
        ) {
          ids.add(provider.instance_id);
        }
      }
    }
    // sort by provider name so the default (first) matches the selector order.
    return [...ids].sort((a, b) => {
      const nameA = api.providers[a]?.name || "";
      const nameB = api.providers[b]?.name || "";
      return nameA.localeCompare(nameB);
    });
  });

const topAlbumProviderIds = aggregatedProviderIdsForFeature(
  ProviderFeature.ARTIST_TOPALBUMS,
);
const topTrackProviderIds = aggregatedProviderIdsForFeature(
  ProviderFeature.ARTIST_TOPTRACKS,
);

const topAlbumListingPrefs = getItemsListingPreferences(
  "artisttopalbums",
  "artistalbums",
);
const topTrackListingPrefs = getItemsListingPreferences(
  "artisttoptracks",
  "artisttracks",
);

const activeTopAlbumProvider = computed(() =>
  activeProviderName(
    topAlbumProviderIds.value,
    topAlbumListingPrefs.value.providerFilter?.[0],
  ),
);
const activeTopTrackProvider = computed(() =>
  activeProviderName(
    topTrackProviderIds.value,
    topTrackListingPrefs.value.providerFilter?.[0],
  ),
);

const similarArtistsProviderIds = aggregatedProviderIdsForFeature(
  ProviderFeature.SIMILAR_ARTISTS,
);

const similarArtistsListingPrefs = getItemsListingPreferences(
  "similarartists",
  "similarartists",
);

const activeSimilarArtistsProvider = computed(() =>
  activeProviderName(
    similarArtistsProviderIds.value,
    similarArtistsListingPrefs.value.providerFilter?.[0],
  ),
);

// a listing is shown when at least one provider can supply it
const hasTopAlbumsProvider = computed(
  () => topAlbumProviderIds.value.length > 0,
);
const hasTopTracksProvider = computed(
  () => topTrackProviderIds.value.length > 0,
);
const hasSimilarArtistsProvider = computed(
  () => similarArtistsProviderIds.value.length > 0,
);

const loadArtistAlbums = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistAlbums(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    params.provider?.[0],
  );
};

const loadArtistAudiobooks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistAudiobooks(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    itemDetails.value.artist_type,
  );
};

const loadArtistTracks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistTracks(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    params.provider?.[0],
  );
};

// library items aggregate top albums/tracks per provider — restrict to the
// selected one so the result is a single provider's listing (consistent with
// "all albums"/"all tracks"). a provider item is queried directly (its only
// option is itself).
const loadArtistTopAlbums = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  const providerFilter =
    itemDetails.value.provider === "library" ? params.provider?.[0] : undefined;
  return await api.getArtistTopAlbums(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    providerFilter,
  );
};

const loadArtistTopTracks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  const providerFilter =
    itemDetails.value.provider === "library" ? params.provider?.[0] : undefined;
  return await api.getArtistTopTracks(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    providerFilter,
  );
};

const loadSimilarArtists = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  const providerFilter =
    itemDetails.value.provider === "library" ? params.provider?.[0] : undefined;
  return await api.getSimilarArtists(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    providerFilter,
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
</script>
