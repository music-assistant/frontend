<template>
  <section class="playlist-details">
    <PlaylistHero
      :item="itemDetails"
      :backdrop="backdrop.url"
      :blur-backdrop="backdrop.blurred"
      :track-count="playlistTracks?.length"
      :duration="runningTime"
      :tracks-sort-field="tracksListing?.[0]?.sortField"
      :tracks-sort-direction="tracksListing?.[0]?.sortDirection"
      :has-rules="!!smartRules"
      :can-edit-rules="!!smartRules && canEditLibrary"
      :can-share="canShare"
      @edit-rows="rowsEditorOpen = true"
      @show-rules="showRulesDialog = true"
      @edit-rules="showEditDialog = true"
      @share="openAccessDialog"
    />

    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <template v-if="rowId === 'tracks'">
          <!-- dynamic playlist: content is generated on the fly, so show a sample instead of a fixed tracklist -->
          <DynamicItemSample
            v-if="itemDetails.is_dynamic"
            :item-details="itemDetails"
            :provider="props.provider"
            @edit-rules="showEditDialog = true"
          />
          <!-- the listing keeps its own toolbar, but takes the title and gutter of the rows around it -->
          <ItemsListing
            v-else
            ref="tracksListing"
            class="px-4 pt-3 max-md:px-1 max-md:pt-2 [&>.v-divider]:hidden"
            itemtype="playlisttracks"
            :parent-item="itemDetails"
            :show-provider="false"
            :show-library="false"
            :show-favorites-only-filter="false"
            :show-favorite="true"
            :show-track-number="false"
            :show-refresh-button="true"
            :refresh-on-parent-update="true"
            :sort-listing="ListingType.PLAYLIST_TRACKS"
            :load-paged-data="loadPlaylistTracks"
            :update-available="updateAvailable"
            :track-table="true"
            :title="$t('tracks')"
            :allow-key-hooks="true"
            :path="`playlist.${props.itemId}.${props.provider}`"
            :restore-state="true"
          >
            <template #title>
              <span
                class="text-[22px] font-bold tracking-[-0.4px] max-md:text-[19px]"
              >
                {{ $t("tracks") }}
              </span>
            </template>
          </ItemsListing>
        </template>

        <!-- spaced from the track list above as the shelf is from the row below -->
        <PlaylistFeaturedArtists
          v-else-if="rowId === 'featured_artists'"
          class="mt-[32px] max-md:mt-[16px]"
          :tracks="playlistTracks"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- description -->
        <DetailTextRow
          v-else-if="rowId === 'description' && !!description"
          :title="$t('description')"
          :text="description"
          :dialog-title="itemDetails.name"
          markdown
          @edit-rows="rowsEditorOpen = true"
        />

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
      :registry="playlistRows"
      :available-ids="availableRows"
      :row-meta="rowMeta"
      :subtitle="$t('edit_rows_subtitle_playlist')"
    />
    <Dialog v-if="smartRules" v-model:open="showRulesDialog">
      <DialogContent class="sp-fluid sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {{ $t("smart_playlist.rules_dialog_title") }}
          </DialogTitle>
          <DialogDescription>
            {{ itemDetails?.name }}
          </DialogDescription>
        </DialogHeader>
        <SmartPlaylistRulesView :rules="smartRules" />
      </DialogContent>
    </Dialog>
    <EditSmartPlaylistDialog
      v-if="smartRules && itemDetails"
      v-model:open="showEditDialog"
      :db-playlist-id="props.itemId"
      :playlist="itemDetails"
      @saved="loadItemDetails"
    />
    <br />
  </section>
</template>

<script setup lang="ts">
import DetailAdminCard from "@/components/details/DetailAdminCard.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import RowsEditor from "@/components/details/RowsEditor.vue";
import DynamicItemSample from "@/components/DynamicItemSample.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import {
  playlistBackdrop,
  playlistDuration,
} from "@/components/playlist/playlistData";
import PlaylistFeaturedArtists from "@/components/playlist/PlaylistFeaturedArtists.vue";
import PlaylistHero from "@/components/playlist/PlaylistHero.vue";
import {
  availablePlaylistRowIds,
  playlistRows,
  type PlaylistRowId,
} from "@/components/playlist/playlistRows";
import ProviderDetails from "@/components/ProviderDetails.vue";
import SmartPlaylistRulesView from "@/components/smart_playlist/SmartPlaylistRulesView.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import { usePlaylistTracks } from "@/composables/usePlaylistTracks";
import { canSharePlaylist } from "@/helpers/playlist_access";
import EditSmartPlaylistDialog from "@/layouts/default/EditSmartPlaylistDialog.vue";
import { api } from "@/plugins/api";
import {
  Scope,
  ListingType,
  type Playlist,
  type SmartPlaylistRules,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Playlist>();
const smartRules = ref<SmartPlaylistRules | null>(null);
const showEditDialog = ref(false);
const showRulesDialog = ref(false);
const rowsEditorOpen = ref(false);
let pendingSnapshotRefreshKey: string | undefined;
// editing the rules of a smart playlist changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);

// what the hero counts and times, the featured artists rank and the listing
// below shows
const {
  tracks: playlistTracks,
  load: loadTracks,
  reset: resetTracks,
} = usePlaylistTracks(() => props);
const tracksListing = ref<InstanceType<typeof ItemsListing>[]>();

const canShare = computed(
  () =>
    canEditLibrary.value &&
    itemDetails.value !== undefined &&
    canSharePlaylist(
      itemDetails.value,
      store.currentUser,
      authManager.hasScope(Scope.LIBRARY_MANAGE),
    ),
);

// the rows the page can render for this playlist; the editor lists the same set.
// A dynamic playlist has no fixed tracks to take featured artists from
const availableRows = computed(() =>
  availablePlaylistRowIds().filter(
    (rowId) => !(rowId === "featured_artists" && itemDetails.value?.is_dynamic),
  ),
);

// reads the user's preferences from the store, so the page follows the editor
const visibleRows = computed(() => {
  const { order, hidden } = playlistRows.resolve(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});

const backdrop = computed(() =>
  itemDetails.value
    ? playlistBackdrop(itemDetails.value)
    : { url: undefined, blurred: false },
);

const description = computed(
  () => itemDetails.value?.metadata?.description || undefined,
);

const runningTime = computed(() =>
  playlistTracks.value ? playlistDuration(playlistTracks.value) : undefined,
);

// how much each row currently holds, for the editor's per-row meta line
const rowMeta = computed<Partial<Record<PlaylistRowId, string>>>(() => ({
  tracks: playlistTracks.value?.length
    ? $t("n_tracks", playlistTracks.value.length, {
        named: { count: playlistTracks.value.length },
      })
    : undefined,
}));

const openAccessDialog = function () {
  if (!itemDetails.value) return;
  eventbus.emit("playlistAccessDialog", { playlist: itemDetails.value });
};

const loadItemDetails = async function () {
  const { itemId, provider } = props;
  const playlist = await api.getPlaylist(itemId, provider);
  const isSmartPlaylist = playlist.provider_mappings.some(
    (m) => m.provider_domain === "smart_playlist",
  );
  let rules: SmartPlaylistRules | null = null;
  if (isSmartPlaylist) {
    try {
      rules = await api.getSmartPlaylistRules(itemId);
    } catch {
      rules = null;
    }
  }
  // a slower response for a previous playlist must not replace the current one
  if (itemId !== props.itemId || provider !== props.provider) return;
  // started before the listing mounts, so it reuses this request
  if (!playlist.is_dynamic) loadTracksQuietly();
  itemDetails.value = playlist;
  smartRules.value = rules;
};

// a new playlist starts at the top of the page, and the previous one must not
// stay actionable under the new route
watch(
  () => [props.itemId, props.provider],
  ([itemId], previous) => {
    if (previous) {
      document.querySelector(".content-section")?.scrollTo({ top: 0 });
      itemDetails.value = undefined;
      smartRules.value = null;
      resetTracks();
      pendingSnapshotRefreshKey = undefined;
      updateAvailable.value = false;
      showRulesDialog.value = false;
      showEditDialog.value = false;
      rowsEditorOpen.value = false;
    }
    if (itemId) loadItemDetails();
  },
  { immediate: true },
);

useDetailItemUpdates(itemDetails, {
  onUpdate: () => {
    updateAvailable.value = true;
    if (!itemDetails.value?.is_dynamic) {
      loadTracksQuietly(true);
    }
  },
});

const loadPlaylistTracks = async function (params: LoadDataParams) {
  const { itemId, provider } = props;
  const playlistKey = `${provider}/${itemId}`;
  if (params.refresh) pendingSnapshotRefreshKey = playlistKey;
  if (pendingSnapshotRefreshKey === playlistKey) {
    await loadTracks(true);
    if (pendingSnapshotRefreshKey === playlistKey) {
      pendingSnapshotRefreshKey = undefined;
    }
  }
  return await api.getPlaylistTracks(
    itemId,
    provider,
    false,
    undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
  );
};

/** Loads the tracks for the page; a failure is reported by the api. */
function loadTracksQuietly(refresh = false) {
  loadTracks(refresh).catch(() => {});
}
</script>
