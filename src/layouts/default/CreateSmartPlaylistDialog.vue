<template>
  <Dialog v-model:open="showDialog">
    <DialogContent class="sp-fluid sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle class="mb-2">
          {{ $t("smart_playlist.create") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("smart_playlist.desc") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 py-2">
        <div
          class="flex flex-col gap-5 max-h-[60vh] overflow-y-auto -mx-6 px-6"
        >
          <div class="flex flex-col gap-2">
            <Label for="sp-name">{{ $t("new_playlist_name") }}</Label>
            <Input
              id="sp-name"
              ref="nameInput"
              v-model="playlistName"
              @keyup.enter="doSave"
            />
          </div>

          <SmartPlaylistRulesForm
            :key="dialogKey"
            ref="rulesForm"
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

import SmartPlaylistRulesForm from "@/components/smart_playlist/SmartPlaylistRulesForm.vue";
import SmartPlaylistTrackCountDisplay from "@/components/smart_playlist/SmartPlaylistTrackCountDisplay.vue";
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
import api from "@/plugins/api";
import { type CreateSmartPlaylistEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
const dialogKey = ref(0);
const playlistName = ref("");
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
  const errors = rulesForm.value!.validate();
  if (errors.length) {
    toast.error(errors[0]);
    return;
  }
  isSaving.value = true;
  showDialog.value = false;
  try {
    const finalRules = rulesForm.value!.getFinalRules();
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
  } catch (e) {
    toast.error(String(e));
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  eventbus.on("createSmartPlaylist", (_evt: CreateSmartPlaylistEvent) => {
    playlistName.value = "";
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
