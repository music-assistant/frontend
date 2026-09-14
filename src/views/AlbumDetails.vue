<template>
  <section class="album-details">
    <AlbumHero
      :item="itemDetails"
      :backdrop="backdrop.url"
      :blur-backdrop="backdrop.blurred"
      :track-count="albumTracks?.length"
      :duration="albumDuration"
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
          :meta="versionItems?.length ? String(versionItems.length) : undefined"
          :items="versionItems"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        >
          <template #subtitle="{ item }">{{ versionSubtitle(item) }}</template>
          <template #tag="{ item }">
            <ProviderIcon :domain="getProviderIconDomain(item)" :size="12" />
            {{ providerName(item) }}
          </template>
        </MediaRowList>

        <!-- more from the album artist -->
        <ReleaseShelf
          v-else-if="rowId === 'more_from_artist' && showRow(artistReleases)"
          :title="moreFromArtistTitle"
          :items="artistReleases"
          :view-all-to="artistAlbumsRoute"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
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
      v-if="itemDetails"
      v-model:open="rowsEditorOpen"
      :item="itemDetails"
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
  albumDuration as tracksDuration,
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
import RowsEditor from "@/components/details/RowsEditor.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import MediaItemImages from "@/components/MediaItemImages.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { useAlbumRowData } from "@/composables/useAlbumRowData";
import { api } from "@/plugins/api";
import { getProviderIconDomain } from "@/plugins/api/helpers";
import {
  AlbumType,
  EventMessage,
  EventType,
  MediaItemType,
  Scope,
  type Album,
  type Artist,
  type ItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();

const itemDetails = ref<Album>();
const rowsEditorOpen = ref(false);

// the album's own tracks, as the listing below last loaded them unfiltered:
// what the hero counts and times
const albumTracks = ref<Track[]>();

// the album artist's own images, for an album without wide art of its own;
// undefined while that lookup is still pending, null when there is none
const backdropArtist = ref<Artist | null>();

// the rows the page can render for this album; the editor lists the same set
const availableRows = computed(() =>
  availableAlbumRowIds(authManager.hasScope(Scope.LIBRARY_MANAGE)),
);

// reads the user's preferences from the store, so the page follows the editor
const visibleRows = computed(() => {
  const { order, hidden } = albumRows.resolve(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});

const { versionItems, artistReleases } = useAlbumRowData(
  itemDetails,
  visibleRows,
);

// the cover at first; the artist's fanart takes over once that lookup is done
const backdrop = computed(() =>
  itemDetails.value
    ? albumBackdrop(itemDetails.value, backdropArtist.value ?? undefined)
    : { blurred: false },
);

const review = computed(() =>
  itemDetails.value ? albumReview(itemDetails.value) : undefined,
);

const albumDuration = computed(() =>
  albumTracks.value ? tracksDuration(albumTracks.value) : undefined,
);

const albumArtist = computed(() => itemDetails.value?.artists[0]);

const moreFromArtistTitle = computed(() =>
  albumArtist.value
    ? $t("more_from_artist_name", { name: albumArtist.value.name })
    : $t("more_from_artist"),
);

// the shelf shows the newest releases; the rest are on the artist's own page
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
  more_from_artist: artistReleases.value?.length
    ? String(artistReleases.value.length)
    : undefined,
}));

const loadItemDetails = async function () {
  const { itemId, provider } = props;
  // the previous album must not stay actionable under the new route
  itemDetails.value = undefined;
  albumTracks.value = undefined;
  const album = await api.getAlbum(itemId, provider);
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

// a new album starts at the top of the page and looks up its backdrop;
// anything else (a favorite toggle, a metadata update) leaves both alone
watch(
  () => itemDetails.value?.uri,
  () => {
    document.querySelector(".content-section")?.scrollTo({ top: 0 });
    loadBackdropArtist();
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
        itemDetails.value = updatedItem as Album;
      } else if ("provider_mappings" in updatedItem) {
        for (const provMap of updatedItem.provider_mappings) {
          if (
            provMap.item_id == props.itemId &&
            [provMap.provider_instance, provMap.provider_domain].includes(
              props.provider,
            )
          ) {
            itemDetails.value = updatedItem as Album;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);
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

/** Loads the album artist when the album has no wide art of its own. */
async function loadBackdropArtist() {
  const album = itemDetails.value;
  backdropArtist.value = undefined;
  if (!album) return;
  const artist = album.artists[0];
  if (!artist || !backdrop.value.blurred) {
    backdropArtist.value = null;
    return;
  }
  const loaded = await api
    .getArtist(artist.item_id, artist.provider)
    .catch(() => undefined);
  // a slower response for a previous album must not replace the current one
  if (itemDetails.value?.uri !== album.uri) return;
  backdropArtist.value = loaded ?? null;
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

/** The name of the source a version comes from, the library included. */
function providerName(item: MediaItemType | ItemMapping): string {
  const domain = getProviderIconDomain(item);
  if (domain === "library") return $t("library");
  return (
    api.getProvider(item.provider)?.name ??
    api.getProviderManifest(domain)?.name ??
    item.provider
  );
}
</script>
