<template>
  <section class="album-details">
    <AlbumHero
      :item="itemDetails"
      :backdrop="backdrop.url"
      :blur-backdrop="backdrop.blurred"
      :track-count="albumTracks?.length"
      :duration="runningTime"
      @edit-rows="rowsEditorOpen = true"
    />

    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <!-- the album's tracks -->
        <ItemsListing
          v-if="rowId === 'tracks'"
          itemtype="albumtracks"
          :parent-item="itemDetails"
          :show-provider="true"
          :show-track-number="true"
          :show-favorites-only-filter="true"
          :show-library-only-filter="
            itemDetails.provider == 'library' && api.hasStreamingProviders.value
          "
          :show-refresh-button="false"
          :allow-key-hooks="true"
          :load-items="loadTracks"
          :sort-keys="[
            'track_number',
            'name',
            'sort_name',
            'duration',
            'duration_desc',
          ]"
          :title="$t('tracks')"
          :refresh-on-parent-update="true"
        />

        <!-- review -->
        <DetailTextRow
          v-else-if="rowId === 'review' && !!review"
          :title="$t('review')"
          :text="review"
          :dialog-title="itemDetails.name"
          markdown
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- other versions -->
        <MediaRowList
          v-else-if="rowId === 'other_versions' && showRow(versionItems)"
          :title="$t('other_versions')"
          :items="versionItems"
          show-source
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        >
          <template #subtitle="{ item }">{{ versionSubtitle(item) }}</template>
        </MediaRowList>

        <!-- more from the album artist -->
        <ReleaseShelf
          v-else-if="rowId === 'more_from_artist' && moreFromArtistVisible"
          :title="moreFromArtistTitle"
          :source-label="moreFromArtistSourceDisplay?.label"
          :source-domain="moreFromArtistSourceDisplay?.domain"
          :source-options="moreFromArtistOptions"
          :source-value="moreFromArtistSource"
          :items="artistReleaseItems"
          :view-all-to="artistAlbumsRoute"
          :empty-message="$t('artist_row_empty')"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
          @select-source="selectMoreFromArtistSource"
        />

        <!-- provider mapping details -->
        <DetailAdminCard v-else-if="rowId === 'provider_mappings'">
          <ProviderDetails :item-details="itemDetails" />
        </DetailAdminCard>

        <!-- media images -->
        <DetailAdminCard
          v-else-if="
            rowId === 'artwork' &&
            itemDetails.provider == 'library' &&
            itemDetails.metadata?.images
          "
        >
          <MediaItemImages
            v-model="itemDetails.metadata.images"
            @update:model-value="UpdateItemInDb"
          />
        </DetailAdminCard>
      </template>
    </template>
    <RowsEditor
      v-if="albumForRows"
      v-model:open="rowsEditorOpen"
      :item="albumForRows"
      :registry="albumRows"
      :available-ids="availableRows"
      :row-meta="rowMeta"
      :subtitle="$t('edit_rows_subtitle_album')"
    />
    <br />
  </section>
</template>

<script setup lang="ts">
import {
  albumBackdrop,
  albumDuration,
  albumReview,
  loadAlbumTracks,
} from "@/components/album/albumData";
import AlbumHero from "@/components/album/AlbumHero.vue";
import {
  albumRows,
  availableAlbumRowIds,
  type AlbumRowId,
} from "@/components/album/albumRows";
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import MediaRowList from "@/components/details/MediaRowList.vue";
import ReleaseShelf from "@/components/details/ReleaseShelf.vue";
import {
  rowSourceOptions,
  type RowSource,
  type SourceOption,
} from "@/components/details/rowRegistry";
import RowsEditor from "@/components/details/RowsEditor.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import MediaItemImages from "@/components/MediaItemImages.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { useAlbumRowData } from "@/composables/useAlbumRowData";
import { keepOwnFavorite, subscribeOwnFavorites } from "@/helpers/favorites";
import { backFromMediaDetails } from "@/helpers/navigation";
import { api } from "@/plugins/api";
import { MUSICBRAINZ_PROVIDER } from "@/plugins/api/helpers";
import {
  AlbumType,
  EventMessage,
  EventType,
  MediaItemType,
  MediaType,
  Scope,
  type Album,
  type Artist,
  type ItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();

const router = useRouter();

const itemDetails = ref<Album>();
const rowsEditorOpen = ref(false);

// the album's own tracks, as the listing below last loaded them unfiltered:
// what the hero counts and times
const albumTracks = ref<Track[]>();

// the full album artist, loaded once the album is shown: its provider mappings
// feed the "more from this artist" source picker, and its wide art backs the
// hero when the album has none of its own. Pending while unresolved, null when
// there is none.
const fullArtist = ref<Artist | null>();

// the rows the page can render for this album; the editor lists the same set
const availableRows = computed(() =>
  availableAlbumRowIds(authManager.hasScope(Scope.LIBRARY_MANAGE)),
);

// reads the user's preferences from the store, so the page follows the editor
const visibleRows = computed(() => {
  const { order, hidden } = albumRows.resolve(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});

// the album with its full artist grafted into artists[0], once loaded: the row
// registry reads the artist's provider mappings from there to build the source
// picker, while itemDetails stays as the server sent it
const albumForRows = computed<Album | undefined>(() => {
  const album = itemDetails.value;
  if (!album) return undefined;
  if (!fullArtist.value) return album;
  return { ...album, artists: [fullArtist.value, ...album.artists.slice(1)] };
});

const {
  versionItems,
  artistReleaseItems,
  moreFromArtistSource,
  moreFromArtistSourceDisplay,
} = useAlbumRowData(albumForRows, visibleRows);

// the cover at first; the artist's fanart takes over once that lookup is done
const backdrop = computed(() =>
  itemDetails.value
    ? albumBackdrop(itemDetails.value, fullArtist.value ?? undefined)
    : { blurred: false },
);

const review = computed(() =>
  itemDetails.value ? albumReview(itemDetails.value) : undefined,
);

const runningTime = computed(() =>
  albumTracks.value ? albumDuration(albumTracks.value) : undefined,
);

// the resolved album artist once loaded, else the slim mapping the album came
// with; both carry the name, and the resolved one the library id for "View all"
const albumArtist = computed(
  () => fullArtist.value ?? itemDetails.value?.artists[0],
);

const moreFromArtistTitle = computed(() =>
  albumArtist.value
    ? $t("more_from_artist_name", { name: albumArtist.value.name })
    : $t("more_from_artist"),
);

// the sources the artist's releases can be switched between, so the shelf badge
// becomes a picker matching the rows editor
const moreFromArtistOptions = computed<SourceOption[]>(() =>
  albumForRows.value
    ? rowSourceOptions(albumRows, "more_from_artist", albumForRows.value)
    : [],
);

// the shelf stays rendered while it loads, when it has releases, or when it is
// empty but offers a picker, so switching to a source that came up empty leaves
// a way back
const moreFromArtistVisible = computed(
  () =>
    showRow(artistReleaseItems.value) || moreFromArtistOptions.value.length > 1,
);

// the shelf shows the newest releases; the rest are on the artist's own page,
// opened on the same source the shelf is showing
const artistAlbumsRoute = computed<RouteLocationRaw | undefined>(() => {
  const artist = albumArtist.value;
  if (!artist) return undefined;
  return {
    name: "artistlisting",
    params: {
      provider: artist.provider,
      itemId: artist.item_id,
      listing: "albums",
    },
    query: moreFromArtistSource.value
      ? { source: moreFromArtistSource.value }
      : undefined,
  };
});

// how much each row currently holds, for the editor's per-row meta line
const rowMeta = computed<Partial<Record<AlbumRowId, string>>>(() => ({
  tracks: albumTracks.value?.length
    ? $t("n_tracks", albumTracks.value.length, {
        named: { count: albumTracks.value.length },
      })
    : undefined,
  other_versions: versionItems.value?.length
    ? String(versionItems.value.length)
    : undefined,
  more_from_artist: artistReleaseItems.value?.length
    ? String(artistReleaseItems.value.length)
    : undefined,
}));

const loadItemDetails = async function () {
  const { itemId, provider } = props;
  // the previous album must not stay actionable under the new route
  itemDetails.value = undefined;
  albumTracks.value = undefined;
  const album =
    provider === MUSICBRAINZ_PROVIDER
      ? await resolveMusicBrainzAlbum(itemId)
      : await api.getAlbum(itemId, provider);
  // a slower response for a previous album must not replace the current one
  if (itemId !== props.itemId || provider !== props.provider) return;
  itemDetails.value = album;
};

watch(
  () => [props.itemId, props.provider],
  ([itemId]) => {
    if (itemId) loadItemDetails();
  },
  { immediate: true },
);

// the full artist is loaded only when something needs it: the "more from this
// artist" picker needs its provider mappings (both on the shelf and in the rows
// editor), and the hero falls back to its wide art. Browsing albums whose row is
// hidden and that carry their own wide art then makes no extra request.
const needsFullArtist = computed(
  () =>
    !!itemDetails.value &&
    (rowsEditorOpen.value ||
      visibleRows.value.includes("more_from_artist") ||
      albumBackdrop(itemDetails.value).blurred),
);

// a new album starts at the top of the page and drops the previous artist;
// the artist is (re)loaded once whatever needs it is in play, so unhiding the
// row later still fetches it. A favorite toggle or metadata update keeps both.
watch(
  [() => itemDetails.value?.uri, needsFullArtist],
  ([uri], [previousUri]) => {
    if (uri !== previousUri) {
      document.querySelector(".content-section")?.scrollTo({ top: 0 });
      fullArtist.value = undefined;
    }
    if (needsFullArtist.value && fullArtist.value === undefined) {
      loadFullArtist();
    }
  },
);

onMounted(() => {
  //signal if/when item updates
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      // check if the updated item is the current item
      if (itemDetails.value?.uri == updatedItem.uri) {
        itemDetails.value = keepOwnFavorite(
          updatedItem,
          itemDetails.value,
        ) as Album;
      } else if ("provider_mappings" in updatedItem) {
        for (const provMap of updatedItem.provider_mappings) {
          if (
            provMap.item_id == props.itemId &&
            [provMap.provider_instance, provMap.provider_domain].includes(
              props.provider,
            )
          ) {
            itemDetails.value = keepOwnFavorite(
              updatedItem,
              itemDetails.value,
            ) as Album;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);

  // the user's own like or dislike, wherever they made it
  const unsubFavorite = subscribeOwnFavorites((update) => {
    const item = itemDetails.value;
    if (item?.uri == update.uri) item.favorite = update.favorite;
  });
  onBeforeUnmount(unsubFavorite);
});

const loadTracks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  const tracks = await loadAlbumTracks(itemDetails.value, params.libraryOnly);
  // the hero counts the whole album, not the library half of it
  if (!params.libraryOnly) albumTracks.value = tracks;
  return tracks;
};

const UpdateItemInDb = async function () {
  if (!itemDetails.value) return;
  itemDetails.value = await api.sendCommand("music/albums/update", {
    item_id: itemDetails.value.item_id,
    update: itemDetails.value,
    overwrite: true,
  });
};

/** Switch the artist source from the shelf badge; the shelf reloads that source. */
function selectMoreFromArtistSource(source: RowSource) {
  albumRows.setSource("more_from_artist", source);
}

/**
 * Loads the full album artist: its provider mappings feed the source picker and
 * its wide art backs the hero when the album has none. get_artist resolves a
 * provider id to the library artist when the artist is in the library, so the
 * picker offers the library and its mapped providers there too.
 */
async function loadFullArtist() {
  const album = itemDetails.value;
  const artist = album?.artists[0];
  if (!album || !artist) {
    fullArtist.value = null;
    return;
  }
  const loaded = await api
    .getArtist(artist.item_id, artist.provider)
    .catch(() => undefined);
  // a slower response for a previous album must not replace the current one
  if (itemDetails.value?.uri !== album.uri) return;
  fullArtist.value = loaded ?? null;
}

/**
 * Resolves a MusicBrainz release to the same album on one of the user's music
 * services, which is what the page shows. Returns undefined when none of them
 * has it, leaving the page for where the user came from.
 */
async function resolveMusicBrainzAlbum(
  itemId: string,
): Promise<Album | undefined> {
  try {
    return (await api.getItem(
      MediaType.ALBUM,
      itemId,
      MUSICBRAINZ_PROVIDER,
    )) as Album;
  } catch {
    // the server's own message is already on screen as a toast; a lookup that
    // outlived a move to another album must not pull the user off that one
    if (itemId === props.itemId && props.provider === MUSICBRAINZ_PROVIDER) {
      backFromMediaDetails(router);
    }
    return undefined;
  }
}

/** A row is rendered while it loads and once it has something to show. */
function showRow(items?: unknown[]): boolean {
  return items === undefined || items.length > 0;
}

/** "Album · 2011": what kind of release a version is, and when it came out. */
function versionSubtitle(item: MediaItemType | ItemMapping): string {
  const parts: string[] = [];
  if ("album_type" in item && item.album_type !== AlbumType.UNKNOWN) {
    parts.push($t(`album_type.${item.album_type}`));
  }
  if ("year" in item && item.year) parts.push(String(item.year));
  return parts.join(" · ");
}
</script>

<style scoped>
/* the shelf carries only bottom spacing, the rows above it only top; on this
   page it can follow the versions list, so give it a matching top gap to keep
   the row rhythm instead of sitting flush against the row above */
.album-details :deep(.ed-shelf) {
  margin-top: 26px;
}
@media (max-width: 768px) {
  /* the list tightens its row rhythm to 20px on phones; follow it here */
  .album-details :deep(.ed-shelf) {
    margin-top: 20px;
  }
}
</style>
