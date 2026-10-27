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
import { onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
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

const handleConfirm = async () => {
  if (!onConfirm) {
    open.value = false;
    return;
  }
  try {
    loading.value = true;
    await onConfirm();
  } finally {
    open.value = false;
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
};

// the confirmation can be asked on top of another dialog that stays open
// behind it (such as the search popup), so closing it restores the flag
// rather than clearing it for the dialog underneath
let dialogActiveBeforeOpen = false;

watch(open, (v) => {
  store.dialogActive = v || (dialogActiveBeforeOpen && store.dialogActive);
  if (!v) {
    // Reset after close animation
    setTimeout(reset, 200);
  }
});

onMounted(() => {
  eventbus.on(
    "deleteConfirmationDialog",
    (evt: DeleteConfirmationDialogEvent) => {
      reset();
      if (!open.value) dialogActiveBeforeOpen = store.dialogActive;
      title.value = evt.title ?? t("delete");
      message.value = evt.message;
      confirmLabel.value = evt.confirmLabel ?? t("delete");
      destructive.value = evt.destructive ?? true;
      acknowledgement.value = evt.acknowledgement ?? "";
      onConfirm = evt.onConfirm;
      open.value = true;
    },
  );
});

onBeforeUnmount(() => {
  eventbus.off("deleteConfirmationDialog");
});
</script>
