<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="flex max-h-[90vh] flex-col p-0 sm:max-w-[520px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader class="px-6 pt-6">
        <DialogTitle>
          {{
            location
              ? $t("settings.storage.share_dialog.edit_title")
              : $t("settings.storage.add_network_share")
          }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("settings.storage.share_dialog.description") }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex-1 overflow-y-auto px-6">
        <form :id="formId" @submit.prevent="submit">
          <!-- a disabled fieldset holds every control of the form while it saves -->
          <fieldset :disabled="saving" class="m-0 min-w-0 border-0 p-0">
            <FieldGroup>
              <FieldSet v-if="shareTypeChoices.length > 1" class="gap-3">
                <FieldLegend variant="label" class="mb-0">
                  {{ $t("settings.storage.share_dialog.share_type") }}
                </FieldLegend>
                <RadioGroup
                  :model-value="form.shareType"
                  class="flex flex-wrap gap-6"
                  @update:model-value="setShareType($event as ShareType)"
                >
                  <Field
                    v-for="shareType in shareTypeChoices"
                    :key="shareType"
                    orientation="horizontal"
                    class="w-auto"
                  >
                    <RadioGroupItem
                      :id="`${formId}-${shareType}`"
                      :value="shareType"
                    />
                    <FieldLabel
                      :for="`${formId}-${shareType}`"
                      class="font-normal"
                    >
                      {{ $t(SHARE_TYPE_LABEL_KEYS[shareType]) }}
                    </FieldLabel>
                  </Field>
                </RadioGroup>
              </FieldSet>
              <!-- a single share type is no choice: it is stated, not offered -->
              <Field v-else orientation="horizontal" class="gap-2">
                <FieldTitle>
                  {{ $t("settings.storage.share_dialog.share_type") }}
                </FieldTitle>
                <span class="text-sm" data-testid="share-type">
                  {{ $t(SHARE_TYPE_LABEL_KEYS[form.shareType]) }}
                </span>
              </Field>

              <Field :data-invalid="serverInvalid">
                <FieldLabel :for="`${formId}-server`">
                  {{ $t("settings.storage.share_dialog.server") }}
                </FieldLabel>
                <Input
                  :id="`${formId}-server`"
                  v-model="form.server"
                  :aria-invalid="serverInvalid"
                  autocomplete="off"
                  data-testid="share-server"
                />
                <FieldError
                  v-if="serverInvalid"
                  :errors="[$t('auth.field_required')]"
                />
                <FieldDescription v-else>
                  {{ $t("settings.storage.share_dialog.server_hint") }}
                </FieldDescription>
              </Field>

              <Field :data-invalid="shareInvalid">
                <FieldLabel :for="`${formId}-share`">
                  {{
                    isCifs
                      ? $t("settings.storage.share_dialog.share_name")
                      : $t("settings.storage.share_dialog.export_path")
                  }}
                </FieldLabel>
                <Input
                  :id="`${formId}-share`"
                  v-model="form.share"
                  :aria-invalid="shareInvalid"
                  autocomplete="off"
                  data-testid="share-share"
                />
                <FieldError
                  v-if="shareInvalid"
                  :errors="[$t('auth.field_required')]"
                />
                <FieldDescription v-else>
                  {{
                    isCifs
                      ? $t("settings.storage.share_dialog.share_name_hint")
                      : $t("settings.storage.share_dialog.export_path_hint")
                  }}
                </FieldDescription>
              </Field>

              <template v-if="isCifs">
                <Field>
                  <FieldLabel :for="`${formId}-username`">
                    {{ $t("settings.storage.share_dialog.username") }}
                  </FieldLabel>
                  <Input
                    :id="`${formId}-username`"
                    v-model="form.username"
                    autocomplete="off"
                    data-testid="share-username"
                  />
                </Field>
                <Field>
                  <FieldLabel :for="`${formId}-password`">
                    {{ $t("settings.storage.share_dialog.password") }}
                  </FieldLabel>
                  <!-- new-password keeps the browser from filling in the login of this app -->
                  <Input
                    :id="`${formId}-password`"
                    v-model="form.password"
                    type="password"
                    autocomplete="new-password"
                    :placeholder="
                      location?.username
                        ? $t('settings.storage.share_dialog.password_keep')
                        : undefined
                    "
                    data-testid="share-password"
                  />
                  <FieldDescription>
                    {{ $t("settings.storage.share_dialog.credentials_hint") }}
                  </FieldDescription>
                </Field>
              </template>

              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel :for="`${formId}-read-only`">
                    {{ $t("settings.storage.read_only") }}
                  </FieldLabel>
                  <FieldDescription>
                    {{ $t("settings.storage.share_dialog.read_only_hint") }}
                  </FieldDescription>
                </FieldContent>
                <Switch :id="`${formId}-read-only`" v-model="form.readOnly" />
              </Field>

              <!-- the protocol version is all there is behind the advanced settings -->
              <Field v-if="versionChoices.length > 0" orientation="horizontal">
                <Switch
                  :id="`${formId}-advanced`"
                  :model-value="showAdvanced"
                  data-testid="share-advanced"
                  @update:model-value="toggleAdvanced"
                />
                <FieldLabel :for="`${formId}-advanced`" class="font-normal">
                  {{ $t("settings.show_advanced_settings") }}
                </FieldLabel>
              </Field>

              <Field
                v-if="showAdvanced && versionChoices.length > 0"
                ref="versionField"
              >
                <FieldLabel :for="`${formId}-version`">
                  {{ $t("settings.storage.share_dialog.version") }}
                </FieldLabel>
                <Select
                  :model-value="form.version ?? VERSION_AUTO"
                  @update:model-value="onVersionChange(String($event))"
                >
                  <SelectTrigger :id="`${formId}-version`" class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="VERSION_AUTO">
                      {{ $t("settings.storage.share_dialog.version_auto") }}
                    </SelectItem>
                    <SelectItem
                      v-for="version in versionChoices"
                      :key="version"
                      :value="version"
                    >
                      {{ version }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {{ $t("settings.storage.share_dialog.version_hint") }}
                </FieldDescription>
              </Field>

              <Alert
                v-if="error"
                variant="destructive"
                data-testid="share-error"
              >
                <TriangleAlert />
                <AlertDescription>{{ error }}</AlertDescription>
              </Alert>
            </FieldGroup>
          </fieldset>
        </form>
      </div>
      <DialogFooter class="border-t px-6 pt-4 pb-6">
        <Button
          variant="outline"
          :disabled="saving"
          data-testid="share-cancel"
          @click="onOpenChange(false)"
        >
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          :form="formId"
          :loading="saving"
          data-testid="share-save"
        >
          {{ location ? $t("settings.save") : $t("add") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useNetworkShareForm } from "@/composables/useNetworkShareForm";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import {
  type ManagedShareLocation,
  SHARE_TYPE_LABEL_KEYS,
} from "@/helpers/storage";
import type { ShareType, StorageLocation } from "@/plugins/api/interfaces";
import { TriangleAlert } from "@lucide/vue";
import { nextTick, useId, useTemplateRef } from "vue";
import type { Action } from "vue-sonner";

/** Adds a network share, or edits the settings of a managed one. */
const props = defineProps<{
  open: boolean;
  // the managed share to edit; null adds a new one
  location: ManagedShareLocation | null;
  // the share types this install can mount
  shareTypes: ShareType[];
  // the protocol versions this install can honour per share type
  shareVersions: Partial<Record<ShareType, string[]>>;
  // the next step the toast of a newly added share offers, if any
  addedAction?: (location: StorageLocation) => Action | undefined;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  // a share was added or changed
  saved: [];
}>();

// reka's select cannot hold an empty value, so "automatic" gets a value of its own
const VERSION_AUTO = "auto";

const formId = useId();
const {
  form,
  showAdvanced,
  saving,
  error,
  isCifs,
  shareTypeChoices,
  versionChoices,
  serverInvalid,
  shareInvalid,
  setShareType,
  save,
} = useNetworkShareForm(props);

const versionField = useTemplateRef<InstanceType<typeof Field>>("versionField");

// the revealed field sits at the bottom of a form that may already scroll
const toggleAdvanced = async (shown: boolean) => {
  showAdvanced.value = shown;
  if (!shown) return;
  await nextTick();
  (versionField.value?.$el as HTMLElement | undefined)?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
};

const onVersionChange = (value: string) => {
  form.value.version = value === VERSION_AUTO ? null : value;
};

// the form waits for the answer to its save, which belongs to what is on screen
const onOpenChange = (open: boolean) => {
  if (!open && saving.value) return;
  emit("update:open", open);
};

const submit = async () => {
  const result = await save();
  if (result === "saved") emit("saved");
  if (result === "saved" || result === "unchanged") emit("update:open", false);
};
</script>
