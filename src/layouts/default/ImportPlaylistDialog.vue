<!--
  Dialog for importing a playlist from an M3U/M3U8 file.
  Shows provider selection for library matching, then calls the import API.
  Triggered via eventbus from the playlists listing view.
-->
<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t("import_playlist_title") }}
        </DialogTitle>
        <DialogDescription>
          {{ playlistName }}
        </DialogDescription>

        <div
          v-if="musicProviders.length"
          class="flex flex-col gap-3 mt-4"
        >
          <Label>{{ $t("import_playlist_search_providers") }}</Label>
          <div class="flex flex-col gap-2">
            <div
              v-for="provider in musicProviders"
              :key="provider.instance_id"
              class="flex items-center gap-2"
            >
              <Checkbox
                :id="`provider-${provider.instance_id}`"
                :checked="selectedProviders.includes(provider.instance_id)"
                @update:checked="toggleProvider(provider.instance_id)"
              />
              <Label :for="`provider-${provider.instance_id}`">
                {{ provider.name }}
              </Label>
            </div>
          </div>
        </div>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button @click="doImport">
          {{ $t("import_playlist") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import api from "@/plugins/api";
import { ProviderFeature, ProviderType } from "@/plugins/api/interfaces";
import { type ImportPlaylistEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
const dialogKey = ref(0);
const m3uData = ref("");
const playlistName = ref("");
const selectedProviders = ref<string[]>([]);

const musicProviders = computed(() => {
  return Object.values(api.providers)
    .filter(
      (x) =>
        x.available &&
        x.type === ProviderType.MUSIC &&
        x.supported_features.includes(ProviderFeature.SEARCH),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
});

watch(showDialog, (open) => {
  store.dialogActive = open;
});

onMounted(() => {
  eventbus.on("importPlaylistDialog", (evt: ImportPlaylistEvent) => {
    m3uData.value = evt.m3uData;
    playlistName.value = evt.playlistName;
    selectedProviders.value = musicProviders.value.map(
      (p) => p.instance_id,
    );
    dialogKey.value++;
    showDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("importPlaylistDialog");
});

const toggleProvider = (instanceId: string) => {
  const idx = selectedProviders.value.indexOf(instanceId);
  if (idx >= 0) {
    selectedProviders.value.splice(idx, 1);
  } else {
    selectedProviders.value.push(instanceId);
  }
};

const doImport = async () => {
  showDialog.value = false;
  try {
    const playlist = await api.importPlaylist(
      m3uData.value,
      true,
      selectedProviders.value.length < musicProviders.value.length
        ? selectedProviders.value
        : undefined,
    );
    toast.success($t("playlist_created"), {
      action: {
        label: $t("open_playlist"),
        onClick: () => {
          store.showFullscreenPlayer = false;
          router.push({
            name: "playlist",
            params: {
              itemId: playlist.item_id,
              provider: playlist.provider,
            },
          });
        },
      },
    });
  } catch (e) {
    toast.error(getErrorMessage(e));
  }
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return $t("error");
};
</script>
