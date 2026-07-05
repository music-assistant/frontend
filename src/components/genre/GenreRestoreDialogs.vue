<template>
  <!-- Restore Missing Defaults confirmation -->
  <Dialog v-model:open="showRestoreDialog">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.restore_missing_defaults") }}</DialogTitle>
        <DialogDescription>{{
          $t("settings.confirm_restore_defaults")
        }}</DialogDescription>
      </DialogHeader>
      <div class="grid gap-2 py-2">
        <Label>{{ $t("tooltip.genre_content_type") }}</Label>
        <Select v-model="restoreContentType">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in contentTypeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
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
        <DialogDescription>{{
          $t("settings.confirm_full_restore")
        }}</DialogDescription>
      </DialogHeader>
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
        <DialogDescription>{{
          $t("settings.confirm_full_restore_2")
        }}</DialogDescription>
      </DialogHeader>
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  restoreInProgress: boolean;
  fullRestoreInProgress: boolean;
  contentTypeOptions: { value: string; label: string }[];
}

defineProps<Props>();

const emit = defineEmits<{
  restore: [];
  "full-restore-step2": [];
  "full-restore": [];
}>();

const restoreContentType = defineModel<string>("restoreContentType", {
  required: true,
});
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
