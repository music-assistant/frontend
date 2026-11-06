<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("stream_held.title") }}</DialogTitle>
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
          data-testid="stop-and-play-here"
          :loading="loading"
          @click="stopAndPlayHere"
        >
          {{ $t("stream_held.stop_and_play_here") }}
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
import { api, ApiCommandError } from "@/plugins/api";
import { eventbus, type StreamHeldDialogEvent } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t } = useI18n();
const open = ref(false);
const loading = ref(false);
const request = shallowRef<StreamHeldDialogEvent>();

const message = computed(() =>
  request.value
    ? t("stream_held.message", [
        request.value.providerName,
        request.value.holderName,
      ])
    : "",
);

watch(open, (value) => {
  store.dialogActive = value;
});

onMounted(() => {
  eventbus.on("streamHeldDialog", onStreamHeld);
});

onBeforeUnmount(() => {
  eventbus.off("streamHeldDialog", onStreamHeld);
  if (open.value) store.dialogActive = false;
});

async function stopAndPlayHere() {
  const current = request.value;
  if (!current || loading.value) return;

  loading.value = true;
  try {
    await api.queueCommandStop(current.holderQueueId);
    // a newer refusal replaced this request while the stop was running
    if (request.value !== current) return;
    await current.retry();
  } catch (error) {
    // the api already reported a server error, or offered this dialog again
    // when another player took the stream in the meantime
    if (!(error instanceof ApiCommandError)) toast.error(String(error));
  } finally {
    // a new refusal reopened the dialog for its own request
    if (request.value === current) {
      loading.value = false;
      close();
    }
  }
}

function setOpen(value: boolean) {
  if (!value && !loading.value) close();
}

function close() {
  open.value = false;
}

function onStreamHeld(evt: StreamHeldDialogEvent) {
  request.value = evt;
  loading.value = false;
  open.value = true;
}
</script>
