<template>
  <section class="playlist-details">
    <PlaylistHero
      :item="itemDetails"
      :backdrop="backdrop.url"
      :blur-backdrop="backdrop.blurred"
      :track-count="playlistTracks?.length"
      :duration="runningTime"
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
            :load-items="loadPlaylistTracks"
            :sort-keys="[
              'position',
              'position_desc',
              'timestamp_added',
              'timestamp_added_desc',
              'name',
              'artist',
              'album',
              'duration',
              'duration_desc',
            ]"
            :update-available="updateAvailable"
            :track-table="true"
            :allow-key-hooks="true"
            :path="`playlist.${props.itemId}.${props.provider}`"
            :restore-state="true"
            :no-server-side-sorting="true"
          />
        </template>

        <PlaylistFeaturedArtists
          v-else-if="rowId === 'featured_artists'"
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
  type PlaylistItem,
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
import { canSharePlaylist } from "@/helpers/playlist_access";
import EditSmartPlaylistDialog from "@/layouts/default/EditSmartPlaylistDialog.vue";
import { api } from "@/plugins/api";
import {
  Scope,
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
// editing the rules of a smart playlist changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);

// the playlist's tracks, as the listing below last loaded them: what the hero
// counts and times
const playlistTracks = ref<PlaylistItem[]>();

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
      playlistTracks.value = undefined;
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
  onUpdate: () => (updateAvailable.value = true),
});

const loadPlaylistTracks = async function (params: LoadDataParams) {
  const { itemId, provider } = props;
  const tracks = await api.getPlaylistTracks(itemId, provider, params.refresh);
  if (itemId === props.itemId && provider === props.provider) {
    playlistTracks.value = tracks;
  }
  return tracks;
};

// the track table loads the tracks the hero and the featured artists read, so
// with that row hidden the page loads them itself
const tracksRowHidden = computed(
  () =>
    !!itemDetails.value &&
    !itemDetails.value.is_dynamic &&
    !visibleRows.value.includes("tracks"),
);
watch(
  [tracksRowHidden, () => itemDetails.value?.uri],
  async ([hidden]) => {
    if (!hidden || playlistTracks.value) return;
    const { itemId, provider } = props;
    try {
      const tracks = await api.getPlaylistTracks(itemId, provider);
      if (itemId === props.itemId && provider === props.provider) {
        playlistTracks.value = tracks;
      }
    } catch {
      // the api already reports the failure to the user
    }
  },
  { immediate: true },
);
</script>
