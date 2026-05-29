<template>
  <InfoHeader :item="itemDetails" :sort-by="listingRef?.sortBy">
    <template v-if="smartRules" #append-actions>
      <Settings2
        :size="22"
        class="cursor-pointer"
        :title="$t('smart_playlist.edit_rules')"
        @click="showEditDialog = true"
      />
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
    v-if="smartRules"
    v-model:open="showEditDialog"
    :db-playlist-id="props.itemId"
    :playlist-name="itemDetails?.name ?? ''"
    @saved="loadItemDetails"
  />
  <!-- dynamic playlist: content is generated on the fly, so show a sample instead of a fixed tracklist -->
  <DynamicPlaylistSample
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

  <!-- provider mapping details + genre exclusions: not relevant for dynamic playlists -->
  <ProviderDetails
    v-if="itemDetails && !itemDetails.is_dynamic"
    :item-details="itemDetails"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import DynamicPlaylistSample from "@/components/DynamicPlaylistSample.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import SmartPlaylistRulesView from "@/components/smart_playlist/SmartPlaylistRulesView.vue";
import EditSmartPlaylistDialog from "@/layouts/default/EditSmartPlaylistDialog.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Settings2 } from "lucide-vue-next";
import {
  EventType,
  type Playlist,
  type EventMessage,
  type MediaItemType,
  type SmartPlaylistRules,
} from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { watch, ref, onMounted, onBeforeUnmount } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Playlist>();
const smartRules = ref<SmartPlaylistRules | null>(null);
const showEditDialog = ref(false);
const listingRef = ref<InstanceType<typeof ItemsListing>>();

const loadItemDetails = async function () {
  itemDetails.value = await api.getPlaylist(props.itemId, props.provider);
  const isSmartPlaylist = itemDetails.value?.provider_mappings?.some(
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
