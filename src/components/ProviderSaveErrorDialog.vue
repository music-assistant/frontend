<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.save_failed") }}</DialogTitle>
      </DialogHeader>
      <div class="py-4">
        <p
          class="text-sm text-muted-foreground whitespace-pre-wrap break-words"
        >
          {{ message }}
        </p>
      </div>
      <DialogFooter>
        <Button
          v-if="mode === 'new'"
          type="button"
          variant="outline"
          @click="emit('abort')"
        >
          {{ $t("settings.abort_setup") }}
        </Button>
        <Button
          v-else
          type="button"
          variant="outline"
          @click="emit('update:open', false)"
        >
          {{ $t("cancel") }}
        </Button>
        <Button type="button" @click="emit('retry')">
          {{ $t("settings.retry") }}
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

defineProps<{
  open: boolean;
  message: string;
  // "new" while adding a provider (offers Abort setup), "edit" otherwise (offers Cancel)
  mode: "new" | "edit";
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  retry: [];
  abort: [];
}>();
</script>
