<template>
  <InfoHeader :item="itemDetails" :sort-by="listingRef?.sortBy">
    <template v-if="(smartRules && canEditLibrary) || canShare" #append-actions>
      <Settings2
        v-if="smartRules && canEditLibrary"
        :size="22"
        class="cursor-pointer"
        :title="$t('smart_playlist.edit_rules')"
        @click="showEditDialog = true"
      />
      <Share2
        v-if="canShare"
        :size="22"
        class="cursor-pointer"
        :title="$t('share_playlist')"
        @click="openAccessDialog"
      />
    </template>
    <template
      v-if="itemDetails && isMusicAssistantPlaylist(itemDetails)"
      #owner
    >
      <PlaylistAccessSummary :playlist="itemDetails" />
    </template>
    <template v-if="smartRules" #description-dialog="{ open, onOpenChange }">
      <Dialog :open="open" @update:open="onOpenChange">
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
    </template>
  </InfoHeader>
  <EditSmartPlaylistDialog
    v-if="smartRules && itemDetails"
    v-model:open="showEditDialog"
    :db-playlist-id="props.itemId"
    :playlist="itemDetails"
    @saved="loadItemDetails"
  />
  <!-- dynamic playlist: content is generated on the fly, so show a sample instead of a fixed tracklist -->
  <DynamicItemSample
    v-if="itemDetails && itemDetails.is_dynamic"
    :item-details="itemDetails"
    :provider="props.provider"
    @edit-rules="showEditDialog = true"
  />
  <ItemsListing
    v-else-if="itemDetails"
    ref="listingRef"
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
      'name',
      'artist',
      'album',
      'duration',
      'duration_desc',
    ]"
    :update-available="updateAvailable"
    :title="$t('playlist_tracks')"
    :allow-key-hooks="true"
    :path="`playlist.${props.itemId}.${props.provider}`"
    :restore-state="true"
    :no-server-side-sorting="true"
  />

  <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
</template>

<script setup lang="ts">
import DynamicItemSample from "@/components/DynamicItemSample.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import PlaylistAccessSummary from "@/components/PlaylistAccessSummary.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import SmartPlaylistRulesView from "@/components/smart_playlist/SmartPlaylistRulesView.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canSharePlaylist,
  isMusicAssistantPlaylist,
} from "@/helpers/playlist_access";
import EditSmartPlaylistDialog from "@/layouts/default/EditSmartPlaylistDialog.vue";
import { api } from "@/plugins/api";
import {
  EventType,
  Scope,
  type EventMessage,
  type MediaItemType,
  type Playlist,
  type SmartPlaylistRules,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Settings2, Share2 } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Playlist>();
const smartRules = ref<SmartPlaylistRules | null>(null);
const showEditDialog = ref(false);
// editing the rules of a smart playlist changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);
const listingRef = ref<InstanceType<typeof ItemsListing>>();

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

const openAccessDialog = function () {
  if (!itemDetails.value) return;
  eventbus.emit("playlistAccessDialog", { playlist: itemDetails.value });
};

const loadItemDetails = async function () {
  itemDetails.value = await api.getPlaylist(props.itemId, props.provider);
  const isSmartPlaylist = itemDetails.value?.provider_mappings.some(
    (m) => m.provider_domain === "smart_playlist",
  );
  if (isSmartPlaylist) {
    try {
      smartRules.value = await api.getSmartPlaylistRules(props.itemId);
    } catch {
      smartRules.value = null;
    }
  } else {
    smartRules.value = null;
  }
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
      // signal user that there might be updated info available for this item
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        itemDetails.value = updatedItem as Playlist;
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadPlaylistTracks = async function (params: LoadDataParams) {
  return await api.getPlaylistTracks(
    props.itemId,
    props.provider,
    params.refresh,
  );
};
</script>
