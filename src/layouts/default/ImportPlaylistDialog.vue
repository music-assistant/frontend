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

        <div v-if="musicProviders.length" class="flex flex-col gap-3 mt-4">
          <Label>{{ $t("import_playlist_search_providers") }}</Label>
          <p class="text-muted-foreground text-xs">
            {{ $t("import_playlist_search_providers_description") }}
          </p>
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

          <div v-if="showMatchPolicy" class="flex flex-col gap-2 mt-2">
            <Label>{{ $t("import_playlist_match_policy_label") }}</Label>
            <RadioGroup v-model="matchPolicy" class="gap-2">
              <Label
                v-for="option in matchPolicyOptions"
                :key="option.value"
                :for="`import-playlist-policy-${option.value}`"
                class="flex items-start gap-3 rounded-md border p-3 font-normal cursor-pointer"
              >
                <RadioGroupItem
                  :id="`import-playlist-policy-${option.value}`"
                  :value="option.value"
                  class="mt-0.5"
                />
                <span class="flex flex-1 flex-col items-start gap-1">
                  <span class="text-sm font-medium">{{ option.title }}</span>
                  <span
                    class="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap"
                  >
                    {{ option.description }}
                  </span>
                </span>
              </Label>
            </RadioGroup>
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import api from "@/plugins/api";
import {
  PlaylistMatchPolicy,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { type ImportPlaylistEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
const dialogKey = ref(0);
const m3uData = ref("");
const playlistName = ref("");
const selectedProviders = ref<string[]>([]);
const matchPolicy = ref<PlaylistMatchPolicy>(
  PlaylistMatchPolicy.SAME_RECORDING,
);

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

// older servers always match on the full track title/artist; only offer the
// policy choice once the server can actually honor it.
const showMatchPolicy = computed(
  () => musicProviders.value.length > 0 && api.supportsPlaylistMatchPolicy,
);

const matchPolicyOptions = computed(() => [
  {
    value: PlaylistMatchPolicy.EXACT,
    title: $t("import_playlist_match_policy_exact_title"),
    description: $t("import_playlist_match_policy_exact_description"),
  },
  {
    value: PlaylistMatchPolicy.SAME_RECORDING,
    title: $t("import_playlist_match_policy_same_recording_title"),
    description: $t("import_playlist_match_policy_same_recording_description"),
  },
  {
    value: PlaylistMatchPolicy.BEST_EFFORT,
    title: $t("import_playlist_match_policy_best_effort_title"),
    description: $t("import_playlist_match_policy_best_effort_description"),
  },
]);

watch(showDialog, (open) => {
  store.dialogActive = open;
});

onMounted(() => {
  eventbus.on("importPlaylistDialog", (evt: ImportPlaylistEvent) => {
    m3uData.value = evt.m3uData;
    playlistName.value = evt.playlistName;
    selectedProviders.value = musicProviders.value.map((p) => p.instance_id);
    matchPolicy.value = PlaylistMatchPolicy.SAME_RECORDING;
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
      showMatchPolicy.value ? matchPolicy.value : undefined,
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
  return $t("error_generic");
};
</script>
