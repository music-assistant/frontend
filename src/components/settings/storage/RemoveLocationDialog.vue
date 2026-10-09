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
        <!-- a div, so the warning is part of what the dialog is announced with -->
        <AlertDialogDescription as="div" class="flex flex-col gap-2">
          <p class="m-0">
            {{
              isShare
                ? $t("settings.storage.remove_share_confirm", { name })
                : $t("settings.storage.remove_folder_confirm", { name })
            }}
          </p>
          <!-- styled as the warning in the genre merge dialog -->
          <p
            v-if="readByWarning"
            class="text-destructive m-0 font-medium"
            data-testid="storage-remove-read-by"
          >
            {{ readByWarning }}
          </p>
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
import {
  formatNames,
  isManagedShare,
  storageLocationName,
} from "@/helpers/storage";
import type { StorageLocation } from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

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

const { t, locale } = useI18n();

const isShare = computed(() => !!shown.value && isManagedShare(shown.value));

// removing a share takes its files away from the sources that read it through their
// own folder; a registered folder is only taken off the list, its files stay
const readByWarning = computed(() => {
  const location = shown.value;
  if (!location || !isManagedShare(location) || !location.read_by.length) {
    return null;
  }
  return t("settings.storage.remove_share_read_by", location.read_by.length, {
    named: { sources: formatNames(location.read_by, locale.value) },
  });
});
const name = computed(() =>
  shown.value ? storageLocationName(shown.value) : "",
);

const onOpenChange = (open: boolean) => {
  if (!open) emit("update:location", null);
};

const confirm = () => {
  if (shown.value) emit("confirm", shown.value);
};
</script>
