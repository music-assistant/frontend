<template>
  <AlertDialog :open="!!location" @update:open="onOpenChange">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            isShare
              ? $t("settings.storage.remove_share_title")
              : $t("settings.storage.remove_folder_title")
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            isShare
              ? $t("settings.storage.remove_share_confirm", { name })
              : $t("settings.storage.remove_folder_confirm", { name })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("cancel") }}</AlertDialogCancel>
        <AlertDialogAction
          :class="buttonVariants({ variant: 'destructive' })"
          data-testid="storage-confirm-remove"
          @click="confirm"
        >
          {{ $t("remove") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
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
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { isManagedShare } from "@/helpers/storage";
import type { StorageLocation } from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";

/** Asks before a network share or a registered folder is removed; open while `location` is set. */
const props = defineProps<{ location: StorageLocation | null }>();

const emit = defineEmits<{
  "update:location": [location: StorageLocation | null];
  confirm: [location: StorageLocation];
}>();

// the text stays on the location while the dialog animates closed
const shown = ref<StorageLocation | null>(null);
watch(
  () => props.location,
  (location) => {
    if (location) shown.value = location;
  },
  { immediate: true },
);

const isShare = computed(() => !!shown.value && isManagedShare(shown.value));
const name = computed(() => shown.value?.name ?? "");

const onOpenChange = (open: boolean) => {
  if (!open) emit("update:location", null);
};

const confirm = () => {
  if (shown.value) emit("confirm", shown.value);
};
</script>
