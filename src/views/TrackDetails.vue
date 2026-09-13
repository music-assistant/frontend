<template>
  <section class="track-details">
    <TrackHero
      :item="itemDetails"
      :backdrop="backdrop"
      @edit-rows="rowsEditorOpen = true"
    />

    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <!-- lyrics -->
        <TrackLyricsRow
          v-if="rowId === 'lyrics' && lyrics !== null"
          :item="itemDetails"
          :lyrics="lyrics ?? undefined"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- appears on -->
        <MediaRowList
          v-else-if="rowId === 'appears_on' && showRow(appearsOnItems)"
          :title="$t('appears_on')"
          :meta="releasesMeta"
          :items="appearsOnItems"
          show-favorite
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        >
          <template #subtitle="{ item }">
            {{ releaseSubtitle(item) }}
          </template>
        </MediaRowList>

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

        <!-- similar tracks -->
        <MediaRowList
          v-else-if="rowId === 'similar_tracks' && showRow(similarItems)"
          :title="$t('similar_tracks')"
          :items="similarItems"
          :limit="similarLimit"
          :view-all-to="similarListingRoute"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        >
          <template #subtitle="{ item }">{{ similarSubtitle(item) }}</template>
        </MediaRowList>

        <!-- provider mapping details -->
        <DetailAdminCard v-else-if="rowId === 'provider_mappings'">
          <ProviderDetails :item-details="itemDetails" />
        </DetailAdminCard>
      </template>
    </template>
    <RowsEditor
      v-if="itemDetails"
      v-model:open="rowsEditorOpen"
      :item="itemDetails"
      :registry="trackRows"
      :available-ids="availableRows"
      :row-meta="rowMeta"
      :subtitle="$t('edit_rows_subtitle_track')"
    />
    <br />
  </section>
</template>

<script setup lang="ts">
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import MediaRowList from "@/components/details/MediaRowList.vue";
import RowsEditor from "@/components/details/RowsEditor.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  releaseSubtitle,
  trackBackdrop,
  trackReleaseYear,
} from "@/components/track/trackData";
import TrackHero from "@/components/track/TrackHero.vue";
import TrackLyricsRow from "@/components/track/TrackLyricsRow.vue";
import {
  availableTrackRowIds,
  trackRows,
  type TrackRowId,
} from "@/components/track/trackRows";
import { useTrackRowData } from "@/composables/useTrackRowData";
import { getArtistsString, getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { getProviderIconDomain } from "@/plugins/api/helpers";
import {
  EventMessage,
  EventType,
  ImageType,
  MediaItemType,
  type Artist,
  type ItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
  // uri of the album the track was opened from, when it appears on several
  album?: string;
}
const props = defineProps<Props>();

const itemDetails = ref<Track>();
const rowsEditorOpen = ref(false);

// the first artist's own images, for a track whose album has no wide art;
// undefined while that lookup is still pending, null when there is none
const backdropArtist = ref<Artist | null>();

const isPhone = computed(() => isPhoneSizedScreen());

// the rows the page can render for this track; the editor lists the same set
const availableRows = computed(() => availableTrackRowIds());

// reads the user's preferences from the store, so the page follows the editor
const visibleRows = computed(() => {
  const { order, hidden } = trackRows.resolve(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});

const { lyrics, appearsOnItems, versionItems, similarItems } = useTrackRowData(
  itemDetails,
  visibleRows,
);

// the cover at first; the artist's fanart takes over once that lookup is done
const backdrop = computed(() =>
  itemDetails.value
    ? trackBackdrop(itemDetails.value, backdropArtist.value ?? undefined)
    : undefined,
);

const releasesMeta = computed(() => {
  const count = appearsOnItems.value?.length;
  return count ? $t("n_releases", count, { named: { count } }) : undefined;
});

// how much each row currently holds, for the editor's per-row meta line
const rowMeta = computed<Partial<Record<TrackRowId, string>>>(() => ({
  appears_on: releasesMeta.value,
  other_versions: versionItems.value?.length
    ? String(versionItems.value.length)
    : undefined,
  similar_tracks: similarItems.value?.length
    ? String(similarItems.value.length)
    : undefined,
}));

const similarLimit = computed(() => (isPhone.value ? 5 : 8));

// "View all" only when the row holds more than it shows
const similarListingRoute = computed<RouteLocationRaw | undefined>(() => {
  const track = itemDetails.value;
  if (!track || (similarItems.value?.length ?? 0) <= similarLimit.value) {
    return undefined;
  }
  return {
    name: "tracklisting",
    params: {
      provider: track.provider,
      itemId: track.item_id,
      listing: "similar",
    },
    query: props.album ? { album: props.album } : undefined,
  };
});

const loadItemDetails = async function () {
  const { itemId, provider, album } = props;
  // the previous track must not stay actionable under the new route
  itemDetails.value = undefined;
  const track = await api.getTrack(itemId, provider, album);
  // a slower response for a previous track must not replace the current one
  if (
    itemId !== props.itemId ||
    provider !== props.provider ||
    album !== props.album
  ) {
    return;
  }
  itemDetails.value = track;
};

watch(
  () => [props.itemId, props.provider, props.album],
  ([itemId]) => {
    if (itemId) loadItemDetails();
  },
  { immediate: true },
);

// a new track starts at the top of the page and looks up its backdrop;
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
        // update UI with the updated item
        itemDetails.value = updatedItem as Track;
      } else if ("provider_mappings" in updatedItem) {
        for (const provMap of updatedItem.provider_mappings) {
          if (
            provMap.item_id == props.itemId &&
            [provMap.provider_instance, provMap.provider_domain].includes(
              props.provider,
            )
          ) {
            itemDetails.value = updatedItem as Track;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);
});

/** Loads the first artist when the track and its album have no wide art of their own. */
async function loadBackdropArtist() {
  const track = itemDetails.value;
  backdropArtist.value = undefined;
  if (!track) return;
  const artist = track.artists[0];
  if (!artist || hasWideArt(track)) {
    backdropArtist.value = null;
    return;
  }
  const loaded = await api
    .getArtist(artist.item_id, artist.provider)
    .catch(() => undefined);
  // a slower response for a previous track must not replace the current one
  if (itemDetails.value?.uri !== track.uri) return;
  backdropArtist.value = loaded ?? null;
}

/** A row is rendered while it loads and once it has something to show. */
function showRow(items?: unknown[]): boolean {
  return items === undefined || items.length > 0;
}

/** Whether the track or its album carries fanart or landscape art. */
function hasWideArt(track: Track): boolean {
  return !!(
    getImageThumbForItem(track, ImageType.FANART) ||
    getImageThumbForItem(track, ImageType.LANDSCAPE)
  );
}

/** "Album · 2025": the album and year a version of the track was released on. */
function versionSubtitle(item: MediaItemType | ItemMapping): string {
  if (!("album" in item) || !item.album) return "";
  const parts = [item.album.name];
  const year = trackReleaseYear(item);
  if (year) parts.push(String(year));
  return parts.join(" · ");
}

/** "Artist · Album": who a similar track is by and, when known, its album. */
function similarSubtitle(item: MediaItemType | ItemMapping): string {
  if (!("artists" in item)) return "";
  const parts = [getArtistsString(item.artists)];
  if ("album" in item && item.album) parts.push(item.album.name);
  return parts.filter(Boolean).join(" · ");
}

/** The name of the provider a version comes from, the library included. */
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
