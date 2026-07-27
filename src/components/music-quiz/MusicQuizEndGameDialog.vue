<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent class="gap-3 p-4 sm:max-w-sm sm:p-5">
      <AlertDialogHeader class="gap-1 text-left">
        <AlertDialogTitle>
          {{ $t("providers.music_quiz.end_game") }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("providers.music_quiz.end_game_confirm") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="flex-row justify-end">
        <AlertDialogCancel class="mt-0">{{ $t("cancel") }}</AlertDialogCancel>
        <Button
          variant="destructive"
          data-testid="confirm-end-game"
          :disabled="busy"
          @click="confirm"
        >
          {{ $t("providers.music_quiz.end_game") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { $t } from "@/plugins/i18n";

defineProps<{
  busy: boolean;
}>();
const emit = defineEmits<{
  confirm: [];
}>();
const open = defineModel<boolean>({ required: true });

function confirm() {
  open.value = false;
  emit("confirm");
}
</script>
