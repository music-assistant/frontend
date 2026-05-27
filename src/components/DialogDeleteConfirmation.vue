<!--
  Generic delete/remove confirmation dialog.
  Replaces native browser confirm() prompts with a styled dialog.
  Driven through the centralized eventbus so it can be triggered from anywhere:

    eventbus.emit("deleteConfirmationDialog", {
      title: $t("remove_library"),
      message: $t("confirm_library_remove"),
      confirmLabel: $t("remove"),
      onConfirm: () => { ... },
    });
-->
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
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          :disabled="loading"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const open = ref(false);
const loading = ref(false);
const title = ref("");
const message = ref("");
const confirmLabel = ref("");
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
  loading.value = false;
  onConfirm = undefined;
};

watch(open, (v) => {
  store.dialogActive = v;
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
      title.value = evt.title ?? t("delete");
      message.value = evt.message;
      confirmLabel.value = evt.confirmLabel ?? t("delete");
      onConfirm = evt.onConfirm;
      open.value = true;
    },
  );
});

onBeforeUnmount(() => {
  eventbus.off("deleteConfirmationDialog");
});
</script>
