<!--
  Dialog to edit the rules of an existing smart playlist.
-->
<template>
  <Dialog v-model:open="showDialog">
    <DialogContent class="sp-fluid sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t("smart_playlist.edit_rules") }}
        </DialogTitle>
      </DialogHeader>

      <div
        v-if="loading"
        class="py-8 text-center text-muted-foreground text-sm"
      >
        {{ $t("loading") }}
      </div>

      <div v-else class="flex flex-col gap-3 py-2">
        <div class="flex flex-col gap-2">
          <Label for="sp-edit-name">{{
            $t("smart_playlist.name_label")
          }}</Label>
          <Input id="sp-edit-name" v-model="name" />
        </div>

        <div class="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          <SmartPlaylistRulesForm
            ref="rulesForm"
            :initial-rules="loadedRules"
            :initial-artist-items="loadedArtistItems"
            :initial-album-items="loadedAlbumItems"
            :initial-excluded-artist-items="loadedExcludedArtistItems"
            :initial-excluded-album-items="loadedExcludedAlbumItems"
            lock-type
            @track-count-update="onTrackCountUpdate"
          />
        </div>

        <SmartPlaylistTrackCountDisplay
          :mode="rulesForm?.mode ?? 'library'"
          :is-counting-tracks="isCountingTracks"
          :matching-track-count="matchingTrackCount"
          :matching-duration="matchingDuration"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button
          :disabled="
            loading || isSaving || (!rulesForm?.hasChanges && !nameDirty)
          "
          @click="doSave"
        >
          <span v-if="isSaving">{{ $t("smart_playlist.saving") }}</span>
          <span v-else>{{ $t("settings.save") }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

import SmartPlaylistRulesForm from "@/components/smart_playlist/SmartPlaylistRulesForm.vue";
import SmartPlaylistTrackCountDisplay from "@/components/smart_playlist/SmartPlaylistTrackCountDisplay.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/plugins/api";
import type { Playlist, SmartPlaylistRules } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

export interface Props {
  dbPlaylistId: string;
  playlist: Playlist;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "saved"): void }>();

const showDialog = defineModel<boolean>("open", { default: false });

const loading = ref(false);
const isSaving = ref(false);
const name = ref("");

const nameDirty = computed(
  () => name.value.trim() !== "" && name.value.trim() !== props.playlist.name,
);
const matchingTrackCount = ref<number | null>(null);
const matchingDuration = ref<number | null>(null);
const isCountingTracks = ref(false);
const rulesForm = ref<InstanceType<typeof SmartPlaylistRulesForm>>();

const loadedRules = ref<SmartPlaylistRules | null>(null);
const loadedArtistItems = ref<{ id: number; name: string }[]>([]);
const loadedAlbumItems = ref<{ id: number; name: string }[]>([]);
const loadedExcludedArtistItems = ref<{ id: number; name: string }[]>([]);
const loadedExcludedAlbumItems = ref<{ id: number; name: string }[]>([]);

function resetDialogState() {
  loading.value = false;
  isSaving.value = false;
  name.value = "";
  matchingTrackCount.value = null;
  matchingDuration.value = null;
  isCountingTracks.value = false;
  loadedRules.value = null;
  loadedArtistItems.value = [];
  loadedAlbumItems.value = [];
  loadedExcludedArtistItems.value = [];
  loadedExcludedAlbumItems.value = [];
}

watch(showDialog, async (open) => {
  if (open) {
    loading.value = true;
    name.value = props.playlist.name;
    loadedRules.value = null;
    loadedArtistItems.value = [];
    loadedAlbumItems.value = [];
    loadedExcludedArtistItems.value = [];
    loadedExcludedAlbumItems.value = [];

    try {
      const fetchedRules = await api.getSmartPlaylistRules(props.dbPlaylistId);

      if (fetchedRules) {
        await Promise.all([
          ...fetchedRules.artist_ids.map(async (id) => {
            const nameFromRules = fetchedRules.artist_names?.[id];
            if (nameFromRules) {
              loadedArtistItems.value.push({ id, name: nameFromRules });
              return;
            }
            try {
              const artist = await api.getArtist(String(id), "library");
              loadedArtistItems.value.push({ id, name: artist.name });
            } catch {
              loadedArtistItems.value.push({ id, name: String(id) });
            }
          }),
          ...fetchedRules.album_ids.map(async (id) => {
            const nameFromRules = fetchedRules.album_names?.[id];
            if (nameFromRules) {
              loadedAlbumItems.value.push({ id, name: nameFromRules });
              return;
            }
            try {
              const album = await api.getAlbum(String(id), "library");
              loadedAlbumItems.value.push({ id, name: album.name });
            } catch {
              loadedAlbumItems.value.push({ id, name: String(id) });
            }
          }),
          ...(fetchedRules.excluded_artist_ids ?? []).map(async (id) => {
            const nameFromRules = fetchedRules.excluded_artist_names?.[id];
            if (nameFromRules) {
              loadedExcludedArtistItems.value.push({ id, name: nameFromRules });
              return;
            }
            try {
              const artist = await api.getArtist(String(id), "library");
              loadedExcludedArtistItems.value.push({ id, name: artist.name });
            } catch {
              loadedExcludedArtistItems.value.push({ id, name: String(id) });
            }
          }),
          ...(fetchedRules.excluded_album_ids ?? []).map(async (id) => {
            const nameFromRules = fetchedRules.excluded_album_names?.[id];
            if (nameFromRules) {
              loadedExcludedAlbumItems.value.push({ id, name: nameFromRules });
              return;
            }
            try {
              const album = await api.getAlbum(String(id), "library");
              loadedExcludedAlbumItems.value.push({ id, name: album.name });
            } catch {
              loadedExcludedAlbumItems.value.push({ id, name: String(id) });
            }
          }),
        ]);
        loadedRules.value = fetchedRules;
      }
    } catch {
      loadedRules.value = null;
    }
    loading.value = false;
  } else {
    resetDialogState();
  }
});

function onTrackCountUpdate(
  count: number | null,
  duration: number | null,
  counting: boolean,
) {
  matchingTrackCount.value = count;
  matchingDuration.value = duration;
  isCountingTracks.value = counting;
}

async function doSave() {
  if (isSaving.value) return;
  const errors = rulesForm.value!.validate();
  if (errors.length) {
    toast.error(errors[0]);
    return;
  }
  const trimmedName = name.value.trim();
  if (!trimmedName) {
    toast.error($t("smart_playlist.name_required"));
    return;
  }
  isSaving.value = true;
  try {
    if (nameDirty.value) {
      await api.updatePlaylist(
        props.dbPlaylistId,
        { ...props.playlist, name: trimmedName },
        true,
      );
    }
    if (rulesForm.value!.hasChanges) {
      const finalRules = rulesForm.value!.getFinalRules();
      await api.updateSmartPlaylistRules(props.dbPlaylistId, finalRules);
    }
    toast.success($t("smart_playlist.edited", { name: trimmedName }));
    showDialog.value = false;
    emit("saved");
  } catch (e) {
    toast.error(String(e));
  } finally {
    isSaving.value = false;
  }
}
</script>
