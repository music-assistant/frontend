<!--
  Global dialog to create a new smart playlist from a set of rules.
  Supports two modes: Dynamic (auto-refreshes, saves rules) and Fixed (one-time generation).
  Visibility is controlled via the centralized eventbus.
-->
<template>
  <Dialog v-model:open="showDialog">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t("smart_playlist.create") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("smart_playlist.desc") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-2 py-2">
        <div class="flex flex-col gap-4 h-[55vh] overflow-y-auto -mx-6 px-6">
          <!-- Playlist name -->
          <div class="flex flex-col gap-2">
            <Label for="sp-name">{{ $t("new_playlist_name") }}</Label>
            <Input
              id="sp-name"
              ref="nameInput"
              v-model="playlistName"
              @keyup.enter="doSave"
            />
          </div>

          <!-- Mode: Dynamic / Fixed -->
          <div class="flex flex-col gap-2">
            <Label>{{ $t("smart_playlist.mode") }}</Label>
            <Tabs v-model="mode">
              <TabsList class="h-8">
                <TabsTrigger value="dynamic" class="text-xs px-4">
                  {{ $t("smart_playlist.dynamic") }}
                </TabsTrigger>
                <TabsTrigger value="fixed" class="text-xs px-4">
                  {{ $t("smart_playlist.fixed") }}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <!-- Track count (fixed mode only) -->
          <div v-if="mode === 'fixed'" class="flex flex-col gap-2">
            <Label for="sp-count">{{ $t("smart_playlist.track_count") }}</Label>
            <NumberField
              id="sp-count"
              v-model="trackCount"
              :min="1"
              :max="2000"
              class="max-w-[160px]"
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
          </div>

          <SmartPlaylistRulesForm
            :key="dialogKey"
            ref="rulesForm"
            @track-count-update="onTrackCountUpdate"
          />
        </div>

        <p v-if="isCountingTracks" class="text-sm text-muted-foreground">…</p>
        <p
          v-else-if="matchingTrackCount !== null"
          class="text-sm text-muted-foreground"
        >
          ~{{ matchingTrackCount }} {{ $t("tracks") }}
          <span v-if="matchingDuration !== null" class="ml-1"
            >(~{{ formatDuration(matchingDuration) }})</span
          >
        </p>
        <p class="text-xs text-muted-foreground/70">
          {{ $t("smart_playlist.track_count_hint") }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button :disabled="!playlistName || isSaving" @click="doSave">
          <span v-if="isSaving">{{ $t("smart_playlist.creating") }}</span>
          <span v-else>{{ $t("settings.save") }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SmartPlaylistRulesForm from "@/components/smart_playlist/SmartPlaylistRulesForm.vue";
import { formatDuration } from "@/helpers/utils";
import api from "@/plugins/api";
import { type CreateSmartPlaylistEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
const dialogKey = ref(0);
const playlistName = ref("");
const mode = ref<"dynamic" | "fixed">("dynamic");
const trackCount = ref(100);
const isSaving = ref(false);
const matchingTrackCount = ref<number | null>(null);
const matchingDuration = ref<number | null>(null);
const isCountingTracks = ref(false);
const nameInput = ref();
const rulesForm = ref<InstanceType<typeof SmartPlaylistRulesForm>>();

watch(showDialog, (open) => {
  store.dialogActive = open;
  if (open) {
    nextTick(() => {
      nameInput.value?.focus?.();
    });
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
  if (!playlistName.value || isSaving.value) return;
  isSaving.value = true;
  showDialog.value = false;
  try {
    const finalRules = rulesForm.value!.getFinalRules();
    if (mode.value === "dynamic") {
      const playlist = await api.createSmartPlaylist(
        playlistName.value,
        finalRules,
        true,
      );
      toast.success($t("smart_playlist.created"), {
        action: {
          label: $t("open_playlist"),
          onClick: () => {
            store.showFullscreenPlayer = false;
            router.push({
              name: "playlist",
              params: { itemId: playlist.item_id, provider: "library" },
            });
          },
        },
      });
    } else {
      const playlist = await api.generateSmartPlaylist(
        playlistName.value,
        finalRules,
        trackCount.value,
      );
      toast.success($t("playlist_created"), {
        action: {
          label: $t("open_playlist"),
          onClick: () => {
            store.showFullscreenPlayer = false;
            router.push({
              name: "playlist",
              params: { itemId: playlist.item_id, provider: "library" },
            });
          },
        },
      });
    }
  } catch (e) {
    toast.error(String(e));
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  eventbus.on("createSmartPlaylist", (_evt: CreateSmartPlaylistEvent) => {
    playlistName.value = "";
    mode.value = "dynamic";
    trackCount.value = 100;
    matchingTrackCount.value = null;
    matchingDuration.value = null;
    dialogKey.value++;
    showDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("createSmartPlaylist");
});
</script>
