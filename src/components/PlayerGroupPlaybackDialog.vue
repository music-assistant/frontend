<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("player_group_playback.title") }}</DialogTitle>
        <DialogDescription>{{ message }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          :disabled="loading"
          @click="close"
        >
          {{ $t("cancel") }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          data-testid="stop-and-ungroup"
          :disabled="loading"
          @click="runAction(onStopAndUngroup)"
        >
          {{ $t("player_group_playback.stop_and_ungroup") }}
        </Button>
        <Button
          type="button"
          data-testid="keep-playing"
          :disabled="loading"
          @click="runAction(onKeepPlaying)"
        >
          {{ $t("player_group_playback.keep_playing") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  eventbus,
  type PlayerGroupPlaybackDialogEvent,
} from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t } = useI18n();
const open = ref(false);
const loading = ref(false);
const change = ref<PlayerGroupPlaybackDialogEvent["change"]>("remove");
const playerName = ref("");
let onKeepPlaying: (() => void | Promise<void>) | undefined;
let onStopAndUngroup: (() => void | Promise<void>) | undefined;

const message = computed(() =>
  t(`player_group_playback.${change.value}_message`, [playerName.value]),
);

watch(open, (value) => {
  store.dialogActive = value;
});

onMounted(() => {
  eventbus.on("playerGroupPlaybackDialog", onPlaybackChangeRequested);
});

onBeforeUnmount(() => {
  eventbus.off("playerGroupPlaybackDialog", onPlaybackChangeRequested);
  if (open.value) store.dialogActive = false;
});

async function runAction(action?: () => void | Promise<void>) {
  if (!action || loading.value) return;

  loading.value = true;
  try {
    await action();
    close();
  } catch (error) {
    toast.error(String(error));
  } finally {
    loading.value = false;
  }
}

function setOpen(value: boolean) {
  if (!value && !loading.value) close();
}

function close() {
  open.value = false;
}

function onPlaybackChangeRequested(evt: PlayerGroupPlaybackDialogEvent) {
  change.value = evt.change;
  playerName.value = evt.playerName;
  onKeepPlaying = evt.onKeepPlaying;
  onStopAndUngroup = evt.onStopAndUngroup;
  loading.value = false;
  open.value = true;
}
</script>
