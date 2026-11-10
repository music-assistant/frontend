<template>
  <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
    <span data-testid="rotation-round-status">{{ text }}</span>
    <span v-if="status.error" class="text-destructive" role="alert">
      {{ $t("rotation.editor.round_error", { error: status.error }) }}
    </span>
    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogTrigger as-child>
        <Button variant="link" size="sm" class="h-auto p-0">
          {{ $t("rotation.editor.new_round") }}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("rotation.editor.new_round_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("rotation.editor.new_round_text") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("cancel") }}</AlertDialogCancel>
          <AlertDialogAction @click="emit('reset')">
            {{ $t("rotation.editor.new_round_confirm") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ItemKind } from "@/helpers/rotation";
import type { RotationRoundStatus } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";

const props = defineProps<{
  status: RotationRoundStatus;
  // what a unit of the round is, for example an album
  unitKind: ItemKind;
}>();

const emit = defineEmits<{
  reset: [];
}>();

const confirmOpen = ref(false);

const text = computed(() => {
  const { round, units_played, units_total, exact } = props.status;
  if (units_played == null || units_total == null) {
    return $t("rotation.editor.round_only", { round });
  }
  const key =
    exact === false
      ? "rotation.editor.round_status_at_least"
      : "rotation.editor.round_status";
  return $t(
    `${key}.${props.unitKind}`,
    { round, played: units_played, total: units_total },
    units_total,
  );
});
</script>
