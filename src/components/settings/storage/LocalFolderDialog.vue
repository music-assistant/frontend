<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="sm:max-w-[480px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader>
        <DialogTitle>
          {{ $t("settings.storage.add_local_folder") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("settings.storage.folder_dialog.description") }}
        </DialogDescription>
      </DialogHeader>
      <form :id="formId" @submit.prevent="save">
        <FieldGroup>
          <Field :data-invalid="pathInvalid || !!error">
            <FieldLabel :for="`${formId}-path`">
              {{ $t("settings.storage.folder_dialog.path") }}
            </FieldLabel>
            <Input
              :id="`${formId}-path`"
              v-model="path"
              :disabled="saving"
              :aria-invalid="pathInvalid || !!error"
              autocomplete="off"
              data-testid="folder-path"
            />
            <FieldError
              v-if="pathInvalid"
              :errors="[$t('auth.field_required')]"
            />
            <FieldError v-else-if="error" data-testid="folder-error">
              {{ error }}
            </FieldError>
            <FieldDescription v-else>
              {{ $t("settings.storage.folder_dialog.path_hint") }}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          data-testid="folder-cancel"
          @click="onOpenChange(false)"
        >
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          :form="formId"
          :loading="saving"
          data-testid="folder-save"
        >
          {{ $t("add") }}
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import { storageErrorText } from "@/helpers/storage";
import { api } from "@/plugins/api";
import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

/** Registers a folder on the server itself as a music location. */
const props = defineProps<{ open: boolean }>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  added: [];
}>();

const { t } = useI18n();
const formId = useId();

const path = ref("");
// an empty path is only flagged once adding was tried
const submitted = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const pathInvalid = computed(() => submitted.value && !path.value.trim());

// the form waits for the answer to its save, which belongs to what is on screen
const onOpenChange = (open: boolean) => {
  if (!open && saving.value) return;
  emit("update:open", open);
};

const save = async () => {
  submitted.value = true;
  if (!path.value.trim()) return;
  saving.value = true;
  error.value = null;
  try {
    await api.addLocalFolder(path.value.trim());
    toast.success(t("settings.storage.folder_added"));
    emit("added");
    emit("update:open", false);
  } catch (err) {
    // the dialog stays open, so the reason shows under the path it is about
    error.value = storageErrorText(
      err,
      t("settings.storage.folder_add_failed"),
    );
  } finally {
    saving.value = false;
  }
};

// a typed path invalidates the reason the server gave for the previous one
watch(path, () => (error.value = null));

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    path.value = "";
    submitted.value = false;
    error.value = null;
  },
  { immediate: true },
);
</script>
