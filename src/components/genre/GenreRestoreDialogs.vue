<template>
  <!-- Restore Missing Defaults confirmation -->
  <Dialog v-model:open="showRestoreDialog">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.restore_missing_defaults") }}</DialogTitle>
      </DialogHeader>
      <p>{{ $t("settings.confirm_restore_defaults") }}</p>
      <DialogFooter>
        <Button variant="outline" @click="showRestoreDialog = false">
          {{ $t("cancel") }}
        </Button>
        <Button :disabled="restoreInProgress" @click="handleRestore">
          {{ $t("settings.restore_missing_defaults") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Full Restore confirmation (step 1) -->
  <Dialog v-model:open="showFullRestoreDialog">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.full_restore_genres") }}</DialogTitle>
      </DialogHeader>
      <p>{{ $t("settings.confirm_full_restore") }}</p>
      <DialogFooter>
        <Button variant="outline" @click="showFullRestoreDialog = false">
          {{ $t("cancel") }}
        </Button>
        <Button variant="destructive" @click="handleFullRestoreStep2">
          {{ $t("delete") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Full Restore confirmation (step 2) -->
  <Dialog v-model:open="showFullRestoreDialog2">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.full_restore_genres") }}</DialogTitle>
      </DialogHeader>
      <p>{{ $t("settings.confirm_full_restore_2") }}</p>
      <DialogFooter>
        <Button variant="outline" @click="showFullRestoreDialog2 = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          variant="destructive"
          :disabled="fullRestoreInProgress"
          @click="handleFullRestore"
        >
          {{ $t("delete") }}
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

interface Props {
  restoreInProgress: boolean;
  fullRestoreInProgress: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  restore: [];
  "full-restore-step2": [];
  "full-restore": [];
}>();

const showRestoreDialog = defineModel<boolean>("showRestoreDialog", {
  required: true,
});
const showFullRestoreDialog = defineModel<boolean>("showFullRestoreDialog", {
  required: true,
});
const showFullRestoreDialog2 = defineModel<boolean>("showFullRestoreDialog2", {
  required: true,
});

const handleRestore = () => {
  emit("restore");
};

const handleFullRestoreStep2 = () => {
  emit("full-restore-step2");
};

const handleFullRestore = () => {
  emit("full-restore");
};
</script>
