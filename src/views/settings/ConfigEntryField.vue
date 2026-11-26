<template>
  <div class="min-w-0 flex-1" :data-field-kind="kind">
    <div v-if="kind === 'divider'" class="py-2">
      <Separator />
      <span v-if="confEntry.label" class="mt-3 block text-sm font-semibold">
        {{ confEntry.label }}
      </span>
    </div>

    <LabelField v-else-if="kind === 'label'" :text="displayLabel" />

    <AlertField v-else-if="kind === 'alert'" :text="displayLabel" />

    <!-- presentational, e.g. a pairing QR code -->
    <div v-else-if="kind === 'image'" class="flex justify-center py-2">
      <img
        v-if="imageSrc"
        :src="imageSrc"
        :alt="displayLabel"
        loading="lazy"
        class="max-h-[260px] max-w-full rounded-lg"
      />
    </div>

    <Button
      v-else-if="kind === 'action'"
      type="button"
      class="my-2 mb-5 h-auto min-h-[50px] w-full whitespace-normal"
      :disabled="isFieldDisabled"
      @click="$emit('action')"
    >
      {{ displayActionLabel }}
    </Button>

    <!-- Home Assistant entity picker for a single player control -->
    <HassControlPickerField
      v-else-if="isHassControlPickerEntry(confEntry)"
      :entry="confEntry"
      :disabled="isFieldDisabled"
      @set-entry-value="
        (key: string, value: ConfigValueType, label?: string) =>
          emit('setEntryValue', key, value, label)
      "
    />

    <!-- Home Assistant control entities: current selection plus an entity picker -->
    <HassControlsField
      v-else-if="kind === 'hass_controls'"
      :entry="confEntry"
      :label="displayLabel"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <label
      v-else-if="kind === 'boolean'"
      class="flex min-h-10 cursor-pointer items-center gap-3 py-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
    >
      <Checkbox
        :model-value="confEntry.value === true"
        :disabled="isFieldDisabled"
        @update:model-value="$emit('update:value', $event === true)"
      />
      {{ displayLabel }}
    </label>

    <SliderField
      v-else-if="kind === 'slider' && confEntry.range"
      :label="displayLabel"
      :value="confEntry.value"
      :min="confEntry.range[0]"
      :max="confEntry.range[1]"
      :float="confEntry.type === ConfigEntryType.FLOAT"
      :disabled="isFieldDisabled"
      @update:value="$emit('update:value', $event)"
    />

    <TextField
      v-else-if="kind === 'secret'"
      type="password"
      :label="displayLabel"
      :value="confEntry.value"
      :readonly="!!confEntry.action"
      :disabled="isFieldDisabled"
      :required="confEntry.required"
      :error="validation.error.value"
      :password-visible="showPasswordValues"
      :password-toggle="canRevealPassword"
      clearable
      @update:value="onUpdateValue($event)"
      @clear="onClear"
      @blur="validation.touch"
      @toggle-password="emit('togglePassword')"
    />

    <!-- one box per code character -->
    <PairingCodeField
      v-else-if="kind === 'pairing_code'"
      :entry="confEntry"
      :label="displayLabel"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <!-- folder on one of the server's storage locations -->
    <FolderPickerField
      v-else-if="kind === 'folder'"
      :entry="confEntry"
      :label="displayLabel"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <!-- one button per option -->
    <RadioGroupField
      v-else-if="kind === 'expanded_options'"
      :label="displayLabel"
      :options="displayOptions"
      :value="confEntry.value"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <SelectField
      v-else-if="kind === 'select'"
      :label="displayLabel"
      :options="displayOptions"
      :value="confEntry.value"
      :multiple="!!confEntry.multi_value"
      :clearable="clearable"
      :disabled="isFieldDisabled"
      :required="confEntry.required"
      :error="validation.error.value"
      @update:value="onUpdateValue($event)"
      @clear="onClear"
      @blur="validation.touch"
    />

    <TextField
      v-else-if="kind === 'number'"
      type="number"
      :step="confEntry.type === ConfigEntryType.FLOAT ? 'any' : undefined"
      :label="displayLabel"
      :value="confEntry.value"
      :placeholder="confEntry.default_value?.toString()"
      :disabled="isFieldDisabled"
      :required="confEntry.required"
      :clearable="!confEntry.required"
      :error="validation.error.value"
      @update:value="onUpdateValue($event)"
      @clear="onClear"
      @blur="validation.touch"
    />

    <IconPicker
      v-else-if="kind === 'icon'"
      :model-value="confEntry.value as string"
      :placeholder="confEntry.default_value?.toString()"
      :disabled="isFieldDisabled"
      :label="displayLabel"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
    />

    <StringListField
      v-else-if="kind === 'string_list'"
      :label="displayLabel"
      :value="confEntry.value"
      :disabled="isFieldDisabled"
      :required="confEntry.required"
      :error="validation.error.value"
      @update:value="onUpdateValue($event)"
      @clear="onClear"
      @blur="validation.touch"
    />

    <TextField
      v-else
      type="text"
      :label="displayLabel"
      :value="confEntry.value"
      :placeholder="confEntry.default_value?.toString()"
      :readonly="!!confEntry.action"
      :disabled="isFieldDisabled"
      :required="confEntry.required"
      :error="validation.error.value"
      clearable
      @update:value="onUpdateValue($event)"
      @clear="onClear"
      @blur="validation.touch"
    />
  </div>
</template>

<script setup lang="ts">
import IconPicker from "@/components/IconPicker.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useConfigFieldValidation } from "@/composables/useConfigFormValidation";
import {
  ConfigEntryUI,
  isHassControlPickerEntry,
} from "@/helpers/config_entry_ui";
import {
  configFieldKind,
  configFieldOptions,
  isRequiredValueMissing,
} from "@/helpers/config_field";
import { isEmbeddedImage } from "@/helpers/utils";
import {
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import AlertField from "./fields/AlertField.vue";
import FolderPickerField from "./fields/FolderPickerField.vue";
import HassControlPickerField from "./fields/HassControlPickerField.vue";
import HassControlsField from "./fields/HassControlsField.vue";
import LabelField from "./fields/LabelField.vue";
import PairingCodeField from "./fields/PairingCodeField.vue";
import RadioGroupField from "./fields/RadioGroupField.vue";
import SelectField from "./fields/SelectField.vue";
import SliderField from "./fields/SliderField.vue";
import StringListField from "./fields/StringListField.vue";
import TextField from "./fields/TextField.vue";

const props = withDefaults(
  defineProps<{
    confEntry: ConfigEntryUI;
    showPasswordValues: boolean;
    disabled?: boolean;
    // domain of the provider this config belongs to; absent for player and core configs
    providerDomain?: string;
    // false leaves out the clear button of a dropdown, for a value that must stay set
    clearable?: boolean;
  }>(),
  { disabled: false, providerDomain: undefined, clearable: true },
);

const emit = defineEmits<{
  (e: "togglePassword"): void;
  (e: "action"): void;
  (e: "update:value", value: ConfigValueType): void;
  // set the value of another entry on the same form
  (
    e: "setEntryValue",
    key: string,
    value: ConfigValueType,
    label?: string,
  ): void;
}>();

const kind = computed(() =>
  configFieldKind(props.confEntry, props.providerDomain),
);

const isFieldDisabled = computed(
  () => props.disabled || !!props.confEntry.read_only,
);

// a disabled field can not be filled in, so it never blocks a save, as for the
// save button
const validation = useConfigFieldValidation(
  () =>
    !isFieldDisabled.value &&
    isRequiredValueMissing(props.confEntry, kind.value),
  () => $t("settings.invalid_input"),
);

// Only surface an <img> when a source is actually available; otherwise the
// element would render as a broken image (both value and default missing).
// A provider's image is only drawn when embedded, so it loads nothing remote.
const imageSrc = computed(() => {
  const src = props.confEntry.value ?? props.confEntry.default_value;
  return typeof src === "string" && isEmbeddedImage(src) ? src : undefined;
});

// a stored secret only reads back as a placeholder, which there is no use in showing
const canRevealPassword = computed(
  () =>
    props.showPasswordValues ||
    !(
      typeof props.confEntry.value === "string" &&
      props.confEntry.value.includes(SECURE_STRING_SUBSTITUTE)
    ),
);

// Labels arrive display-ready: server-provided entries are resolved server-side for the
// connection locale, and frontend-only entries are translated where they are constructed.
// An empty label is a deliberate "no label"; only a missing one falls back to the key.
const displayLabel = computed(
  () => props.confEntry.label ?? props.confEntry.key,
);

const displayActionLabel = computed(
  () =>
    props.confEntry.action_label ||
    props.confEntry.label ||
    props.confEntry.key,
);

const displayOptions = computed(() =>
  configFieldOptions(props.confEntry, $t("settings.default")),
);

const onUpdateValue = (value: ConfigValueType) => {
  validation.touch();
  // When value is cleared (null/undefined/empty array), emit the default value instead
  // For non-required text fields, allow empty strings as a valid value
  if (
    value === null ||
    value === undefined ||
    (value === "" && props.confEntry.required) ||
    (Array.isArray(value) && value.length === 0)
  ) {
    emit("update:value", props.confEntry.default_value);
  } else if (value === "" && kind.value === "number") {
    // an emptied number field has no value, so the server falls back to the default
    emit("update:value", null);
  } else {
    emit("update:value", value);
  }
};

const onClear = () => {
  validation.touch();
  emit("update:value", null);
};
</script>
