<template>
  <div class="config-field" :data-field-kind="kind">
    <!-- divider value -->
    <div v-if="kind === 'divider'" class="config-divider">
      <v-divider />
      <v-label v-if="confEntry.label" class="divider-label">
        {{ confEntry.label }}
      </v-label>
    </div>

    <!-- label value -->
    <LabelField v-else-if="kind === 'label'" :text="displayLabel()" />

    <!-- alert value -->
    <AlertField v-else-if="kind === 'alert'" :text="displayLabel()" />

    <!-- image value (presentational, e.g. a pairing QR code) -->
    <div v-else-if="kind === 'image'" class="config-image">
      <img
        v-if="imageSrc"
        :src="imageSrc"
        :alt="displayLabel()"
        loading="lazy"
      />
    </div>

    <!-- action type -->
    <v-btn
      v-else-if="kind === 'action'"
      color="primary"
      class="action-btn"
      :disabled="isFieldDisabled"
      @click="$emit('action')"
    >
      {{ displayActionLabel() }}
    </v-btn>

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
      :label="displayLabel()"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <!-- boolean value: checkbox -->
    <v-checkbox
      v-else-if="kind === 'boolean'"
      :model-value="confEntry.value"
      :label="displayLabel()"
      color="primary"
      :disabled="isFieldDisabled"
      hide-details
      density="comfortable"
      @update:model-value="$emit('update:value', $event)"
    />

    <!-- int/float value in range: slider control -->
    <div
      v-else-if="kind === 'slider' && confEntry.range"
      class="config-slider-wrapper"
    >
      <v-label class="config-slider-label">
        {{ displayLabel() }}
      </v-label>
      <div class="config-slider-block">
        <v-slider
          :model-value="confEntry.value as number"
          :disabled="isFieldDisabled"
          :required="confEntry.required"
          :min="confEntry.range[0]"
          :max="confEntry.range[1]"
          :step="confEntry.type == ConfigEntryType.FLOAT ? 0.5 : 1"
          hide-details
          color="primary"
          class="config-slider"
          @update:model-value="$emit('update:value', $event)"
        />

        <div class="config-slider-input">
          <NumberField
            :model-value="confEntry.value as number"
            :disabled="isFieldDisabled"
            :min="confEntry.range[0]"
            :max="confEntry.range[1]"
            :step="confEntry.type == ConfigEntryType.FLOAT ? 0.5 : 1"
            :format-options="{
              maximumFractionDigits:
                confEntry.type == ConfigEntryType.FLOAT ? 1 : 0,
            }"
            class="w-[100px]"
            @update:model-value="$emit('update:value', $event ?? null)"
          >
            <NumberFieldContent>
              <NumberFieldInput />
              <NumberFieldDecrement />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>
      </div>
    </div>

    <TextField
      v-else-if="kind === 'secret'"
      type="password"
      :label="displayLabel()"
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

    <!-- pairing code: one box per code character -->
    <PairingCodeField
      v-else-if="kind === 'pairing_code'"
      :entry="confEntry"
      :label="displayLabel()"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <!-- folder on one of the server's storage locations -->
    <FolderPickerField
      v-else-if="kind === 'folder'"
      :entry="confEntry"
      :label="displayLabel()"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <!-- value with all options expanded: one button per option -->
    <RadioGroupField
      v-else-if="kind === 'expanded_options'"
      :label="displayLabel()"
      :options="displayOptions"
      :value="confEntry.value"
      :disabled="isFieldDisabled"
      @update:value="onUpdateValue($event)"
    />

    <SelectField
      v-else-if="kind === 'select'"
      :label="displayLabel()"
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
      :label="displayLabel()"
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

    <!-- icon picker -->
    <IconPicker
      v-else-if="kind === 'icon'"
      :model-value="confEntry.value as string"
      :placeholder="confEntry.default_value?.toString()"
      :disabled="isFieldDisabled"
      :label="displayLabel()"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
    />

    <!-- multi-value string combobox -->
    <v-combobox
      v-else-if="kind === 'string_list'"
      :model-value="confEntry.value as string[]"
      :menu-props="{ zIndex: 10000 }"
      multiple
      chips
      :clearable="true"
      :disabled="isFieldDisabled"
      :label="displayLabel()"
      :required="confEntry.required"
      :rules="[
        (v) => !(!v && confEntry.required) || $t('settings.invalid_input'),
      ]"
      variant="outlined"
      density="comfortable"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
    />

    <TextField
      v-else
      type="text"
      :label="displayLabel()"
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
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import IconPicker from "@/components/IconPicker.vue";
import AlertField from "./fields/AlertField.vue";
import FolderPickerField from "./fields/FolderPickerField.vue";
import HassControlPickerField from "./fields/HassControlPickerField.vue";
import HassControlsField from "./fields/HassControlsField.vue";
import LabelField from "./fields/LabelField.vue";
import PairingCodeField from "./fields/PairingCodeField.vue";
import RadioGroupField from "./fields/RadioGroupField.vue";
import SelectField from "./fields/SelectField.vue";
import TextField from "./fields/TextField.vue";
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
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

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

const kind = computed(() =>
  configFieldKind(props.confEntry, props.providerDomain),
);

const isFieldDisabled = computed(() => {
  return props.disabled || props.confEntry.read_only;
});

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

// Labels arrive display-ready: server-provided entries are resolved server-side for the
// connection locale, and frontend-only entries are translated where they are constructed.
// This field just surfaces them, so there is no translation lookup here.
// An empty label is a deliberate "no label"; only a missing one falls back to the key.
const displayLabel = () => props.confEntry.label ?? props.confEntry.key;

const displayActionLabel = () =>
  props.confEntry.action_label || props.confEntry.label || props.confEntry.key;

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

// a stored secret only reads back as a placeholder, which there is no use in showing
const canRevealPassword = computed(
  () =>
    props.showPasswordValues ||
    !(
      typeof props.confEntry.value === "string" &&
      props.confEntry.value.includes(SECURE_STRING_SUBSTITUTE)
    ),
);

const displayOptions = computed(() =>
  configFieldOptions(props.confEntry, $t("settings.default")),
);
</script>

<style scoped>
.config-field {
  flex: 1;
  min-width: 0;
}

.config-divider {
  padding: 8px 0;
}

.config-image {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.config-image img {
  max-width: 100%;
  max-height: 260px;
  border-radius: 8px;
}

.divider-label {
  display: block;
  margin-top: 12px;
  font-weight: 600;
  font-size: 0.875rem;
}

.action-btn {
  margin: 8px 0;
  margin-bottom: 20px;
  width: 100%;
  height: 50px;
}

.config-slider-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-slider-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 0;
}

.config-slider-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.config-slider-input {
  flex-shrink: 0;
}

@media (min-width: 601px) {
  .config-slider-wrapper {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .config-slider-label {
    flex-shrink: 0;
    margin-bottom: 0;
  }

  .config-slider-block {
    flex: 1;
  }
}
</style>
