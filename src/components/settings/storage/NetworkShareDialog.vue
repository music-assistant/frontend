<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
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
        <form :id="formId" @submit.prevent="save">
          <FieldGroup>
            <FieldSet class="gap-3">
              <FieldLegend variant="label" class="mb-0">
                {{ $t("settings.storage.share_dialog.share_type") }}
              </FieldLegend>
              <RadioGroup
                :model-value="form.shareType"
                :disabled="!!location || shareTypeChoices.length < 2"
                class="flex flex-wrap gap-6"
                @update:model-value="onShareTypeChange(String($event))"
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

            <Field orientation="horizontal">
              <Switch
                :id="`${formId}-advanced`"
                v-model="showAdvanced"
                data-testid="share-advanced"
              />
              <FieldLabel :for="`${formId}-advanced`" class="font-normal">
                {{ $t("settings.show_advanced_settings") }}
              </FieldLabel>
            </Field>

            <Field v-if="showAdvanced">
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
                    v-for="version in SHARE_VERSIONS[form.shareType]"
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

            <Alert v-if="error" variant="destructive" data-testid="share-error">
              <TriangleAlert />
              <AlertDescription>{{ error }}</AlertDescription>
            </Alert>
          </FieldGroup>
        </form>
      </div>
      <DialogFooter class="border-t px-6 pt-4 pb-6">
        <Button variant="outline" @click="emit('update:open', false)">
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
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import {
  emptyNetworkShareForm,
  type ManagedShareLocation,
  type NetworkShareForm,
  networkShareAddSettings,
  networkShareChanges,
  networkShareFormFromLocation,
  SHARE_TYPE_LABEL_KEYS,
  SHARE_VERSIONS,
  storageErrorText,
} from "@/helpers/storage";
import { api } from "@/plugins/api";
import { ShareType } from "@/plugins/api/interfaces";
import { TriangleAlert } from "@lucide/vue";
import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

/** Adds a network share, or edits the settings of a managed one. */
const props = defineProps<{
  open: boolean;
  // the managed share to edit; null adds a new one
  location: ManagedShareLocation | null;
  // the share types this install can mount
  shareTypes: ShareType[];
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  // a share was added or changed
  saved: [];
}>();

// reka's select cannot hold an empty value, so "automatic" gets a value of its own
const VERSION_AUTO = "auto";

const { t } = useI18n();
const formId = useId();

const form = ref<NetworkShareForm>(emptyNetworkShareForm(ShareType.CIFS));
const showAdvanced = ref(false);
// the required fields are only flagged once saving was tried
const submitted = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const isCifs = computed(() => form.value.shareType === ShareType.CIFS);
const shareTypeChoices = computed(() =>
  props.location ? [props.location.share_type] : props.shareTypes,
);
const serverInvalid = computed(
  () => submitted.value && !form.value.server.trim(),
);
const shareInvalid = computed(
  () => submitted.value && !form.value.share.trim(),
);

const onShareTypeChange = (value: string) => {
  const shareType = value as ShareType;
  form.value.shareType = shareType;
  // the versions differ per share type
  if (
    form.value.version &&
    !SHARE_VERSIONS[shareType].includes(form.value.version)
  ) {
    form.value.version = null;
  }
};

const onVersionChange = (value: string) => {
  form.value.version = value === VERSION_AUTO ? null : value;
};

const save = async () => {
  submitted.value = true;
  if (!form.value.server.trim() || !form.value.share.trim()) return;
  saving.value = true;
  error.value = null;
  try {
    if (props.location) {
      const changes = networkShareChanges(props.location, form.value);
      if (Object.keys(changes).length > 0) {
        await api.updateNetworkShare(props.location.share_name, changes);
        toast.success(t("settings.storage.share_saved"));
        emit("saved");
      }
    } else {
      await api.addNetworkShare(
        form.value.shareType,
        networkShareAddSettings(form.value),
      );
      toast.success(t("settings.storage.share_added"));
      emit("saved");
    }
    emit("update:open", false);
  } catch (err) {
    // the dialog stays open, so the reason shows next to what the user can correct
    error.value = storageErrorText(
      err,
      t("settings.storage.share_save_failed"),
    );
  } finally {
    saving.value = false;
  }
};

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.value = props.location
      ? networkShareFormFromLocation(props.location)
      : emptyNetworkShareForm(props.shareTypes[0] ?? ShareType.CIFS);
    showAdvanced.value = form.value.version !== null;
    submitted.value = false;
    error.value = null;
  },
  { immediate: true },
);
</script>
