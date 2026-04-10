<!--
  Dialog to edit the rules of an existing dynamic smart playlist.
-->
<template>
  <Dialog v-model:open="showDialog">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t("smart_playlist.edit_rules") }}
        </DialogTitle>
        <DialogDescription>
          {{ playlistName }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="loading"
        class="py-8 text-center text-muted-foreground text-sm"
      >
        {{ $t("loading") }}
      </div>

      <div v-else class="flex flex-col gap-4 py-2">
        <Separator />

        <SmartPlaylistRulesForm
          ref="rulesForm"
          :initial-rules="loadedRules"
          :initial-artist-items="loadedArtistItems"
          :initial-album-items="loadedAlbumItems"
          @track-count-update="onTrackCountUpdate"
        />
      </div>

      <DialogFooter class="items-center">
        <span
          v-if="isCountingTracks"
          class="text-sm text-muted-foreground mr-auto"
        >
          …
        </span>
        <span
          v-else-if="matchingTrackCount !== null"
          class="text-sm text-muted-foreground mr-auto"
        >
          ~{{ matchingTrackCount }} {{ $t("tracks") }}
        </span>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button :disabled="loading || isSaving" @click="doSave">
          <span v-if="isSaving">{{ $t("smart_playlist.saving") }}</span>
          <span v-else>{{ $t("settings.save") }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import SmartPlaylistRulesForm from "@/components/smart_playlist/SmartPlaylistRulesForm.vue";
import api from "@/plugins/api";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

export interface Props {
  dbPlaylistId: string;
  playlistName: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "saved"): void }>();

const showDialog = defineModel<boolean>("open", { default: false });

const loading = ref(false);
const isSaving = ref(false);
const matchingTrackCount = ref<number | null>(null);
const isCountingTracks = ref(false);
const rulesForm = ref<InstanceType<typeof SmartPlaylistRulesForm>>();

const loadedRules = ref<SmartPlaylistRules | null>(null);
const loadedArtistItems = ref<{ id: number; name: string }[]>([]);
const loadedAlbumItems = ref<{ id: number; name: string }[]>([]);

watch(showDialog, async (open) => {
  if (open) {
    loading.value = true;
    loadedRules.value = null;
    loadedArtistItems.value = [];
    loadedAlbumItems.value = [];

    const fetchedRules = await api.getSmartPlaylistRules(props.dbPlaylistId);

    if (fetchedRules) {
      await Promise.all([
        ...fetchedRules.artist_ids.map(async (id) => {
          try {
            const artist = await api.getArtist(String(id), "library");
            loadedArtistItems.value.push({ id, name: artist.name });
          } catch {
            loadedArtistItems.value.push({ id, name: String(id) });
          }
        }),
        ...fetchedRules.album_ids.map(async (id) => {
          try {
            const album = await api.getAlbum(String(id), "library");
            loadedAlbumItems.value.push({ id, name: album.name });
          } catch {
            loadedAlbumItems.value.push({ id, name: String(id) });
          }
        }),
      ]);
      loadedRules.value = fetchedRules;
    }
    loading.value = false;
  }
});

function onTrackCountUpdate(count: number | null, counting: boolean) {
  matchingTrackCount.value = count;
  isCountingTracks.value = counting;
}

async function doSave() {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const finalRules = rulesForm.value!.getFinalRules();
    await api.updateSmartPlaylistRules(props.dbPlaylistId, finalRules);
    toast.success($t("settings.save"));
    showDialog.value = false;
    emit("saved");
  } catch (e) {
    toast.error(String(e));
  } finally {
    isSaving.value = false;
  }
}
</script>
