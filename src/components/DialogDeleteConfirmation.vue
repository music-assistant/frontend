<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <div class="py-4">
        <p class="text-sm text-muted-foreground">
          {{ message }}
        </p>
        <div v-if="acknowledgement" class="mt-4 flex items-start gap-2">
          <Checkbox
            :id="acknowledgementId"
            v-model="acknowledged"
            data-testid="delete-confirmation-acknowledge"
          />
          <Label :for="acknowledgementId" class="leading-snug">
            {{ acknowledgement }}
          </Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="button"
          :variant="destructive ? 'destructive' : 'default'"
          :disabled="loading || (!!acknowledgement && acknowledged !== true)"
          data-testid="delete-confirmation-confirm"
          @click="handleConfirm"
        >
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const open = ref(false);
const loading = ref(false);
const title = ref("");
const message = ref("");
const confirmLabel = ref("");
const destructive = ref(true);
const acknowledgement = ref("");
const acknowledged = ref<boolean | "indeterminate">(false);
const acknowledgementId = useId();
let onConfirm: (() => void | Promise<void>) | undefined;
let onDismiss: (() => void) | undefined;
let dismissOnClose = true;
let dialogGeneration = 0;

const handleConfirm = async () => {
  const confirmingGeneration = dialogGeneration;
  if (!onConfirm) {
    open.value = false;
    return;
  }
  try {
    loading.value = true;
    await onConfirm();
  } finally {
    if (confirmingGeneration === dialogGeneration) {
      dismissOnClose = false;
      open.value = false;
    }
  }
};

const reset = () => {
  title.value = "";
  message.value = "";
  confirmLabel.value = "";
  destructive.value = true;
  acknowledgement.value = "";
  acknowledged.value = false;
  loading.value = false;
  onConfirm = undefined;
  onDismiss = undefined;
  dismissOnClose = true;
};

// the confirmation can be asked on top of another dialog that stays open
// behind it (such as the search popup), so closing it restores the flag
// rather than clearing it for the dialog underneath
let dialogActiveBeforeOpen = false;
let dialogActiveSnapshotCaptured = false;

watch(
  open,
  (v) => {
    if (v) return;
    if (dialogActiveSnapshotCaptured) {
      store.dialogActive = dialogActiveBeforeOpen && store.dialogActive;
      dialogActiveSnapshotCaptured = false;
    }
    if (dismissOnClose) onDismiss?.();
    dismissOnClose = true;
    const closedGeneration = dialogGeneration;
    setTimeout(() => {
      if (!open.value && closedGeneration === dialogGeneration) reset();
    }, 200);
  },
  { flush: "sync" },
);

onMounted(() => {
  eventbus.on(
    "deleteConfirmationDialog",
    (evt: DeleteConfirmationDialogEvent) => {
      const wasOpen = open.value;
      const openingGeneration = ++dialogGeneration;
      let dismissError: unknown;
      let dismissFailed = false;
      if (wasOpen) {
        const previousOnDismiss = onDismiss;
        onDismiss = undefined;
        try {
          previousOnDismiss?.();
        } catch (err) {
          dismissError = err;
          dismissFailed = true;
        }
        if (openingGeneration !== dialogGeneration) {
          if (dismissFailed) throw dismissError;
          return;
        }
        if (!store.dialogActive) dialogActiveBeforeOpen = false;
      } else {
        dialogActiveSnapshotCaptured = false;
      }
      reset();
      title.value = evt.title ?? t("delete");
      message.value = evt.message;
      confirmLabel.value = evt.confirmLabel ?? t("delete");
      destructive.value = evt.destructive ?? true;
      acknowledgement.value = evt.acknowledgement ?? "";
      onConfirm = evt.onConfirm;
      onDismiss = evt.onDismiss;
      open.value = true;
      nextTick(() => {
        if (!open.value || openingGeneration !== dialogGeneration) return;
        if (!dialogActiveSnapshotCaptured) {
          dialogActiveBeforeOpen = store.dialogActive;
          dialogActiveSnapshotCaptured = true;
        }
        store.dialogActive = true;
      });
      if (dismissFailed) throw dismissError;
    },
  );
});

onBeforeUnmount(() => {
  eventbus.off("deleteConfirmationDialog");
});
</script>
