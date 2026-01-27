<template>
  <div class="config-field">
    <!-- divider value -->
    <div
      v-if="confEntry.type == ConfigEntryType.DIVIDER"
      class="config-divider"
    >
      <v-divider />
      <v-label v-if="confEntry.label" class="divider-label">
        {{ confEntry.label }}
      </v-label>
    </div>

    <!-- label / alert value -->
    <v-alert
      v-else-if="
        confEntry.type == ConfigEntryType.LABEL ||
        confEntry.type == ConfigEntryType.ALERT
      "
      variant="tonal"
      :type="confEntry.type === ConfigEntryType.ALERT ? 'warning' : 'info'"
      density="comfortable"
      class="config-alert"
    >
      <template v-if="confEntry.action && linkParts.hasLinkToken">
        {{ linkParts.before }}
        <v-btn
          variant="text"
          density="compact"
          class="label-link"
          type="button"
          :ripple="false"
          @click="emit('action')"
        >
          {{ confEntry.action_label }}
        </v-btn>
        {{ linkParts.after }}
      </template>
      <template v-else>
        {{ resolvedLabel }}
      </template>
    </v-alert>

    <!-- action type -->
    <v-btn
      v-else-if="
        confEntry.type == ConfigEntryType.ACTION ||
        (confEntry.action && !confEntry.value)
      "
      variant="outlined"
      class="action-btn"
      :disabled="isFieldDisabled"
      @click="$emit('action')"
    >
      {{
        $t(
          `settings.${confEntry.action || confEntry.key}.label`,
          confEntry.action_label || confEntry.label,
        )
      }}
    </v-btn>

    <!-- DSP Config Button -->
    <div v-else-if="isDspLinkEntry(confEntry)" class="dsp-config">
      <span class="dsp-status">
        {{
          confEntry.value
            ? $t("settings.dsp_enabled")
            : $t("settings.dsp_disabled")
        }}
      </span>
      <v-btn
        variant="outlined"
        class="action-btn"
        :disabled="isFieldDisabled"
        @click="$emit('openDsp')"
      >
        {{ $t("open_dsp_settings") }}
      </v-btn>
      <span v-if="confEntry.note_key" class="dsp-forbidden-reason">
        {{ $t(`settings.${confEntry.note_key}.label`, "") }}
      </span>
    </div>

    <!-- boolean value: checkbox -->
    <v-checkbox
      v-else-if="confEntry.type == ConfigEntryType.BOOLEAN"
      :model-value="confEntry.value"
      :label="$t(`settings.${confEntry.key}.label`, confEntry.label)"
      color="primary"
      :disabled="isFieldDisabled"
      hide-details
      density="comfortable"
      @update:model-value="$emit('update:value', $event)"
    />

    <!-- int/float value in range: slider control -->
    <div
      v-else-if="
        (confEntry.type == ConfigEntryType.INTEGER ||
          confEntry.type == ConfigEntryType.FLOAT) &&
        confEntry.range &&
        confEntry.range.length == 2
      "
      class="config-slider-wrapper"
    >
      <v-label class="config-slider-label">
        {{ $t(`settings.${confEntry.key}.label`, confEntry.label) }}
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
            :min="confEntry.range[0]"
            :max="confEntry.range[1]"
            :step="confEntry.type == ConfigEntryType.FLOAT ? 0.5 : 1"
            :format-options="{
              maximumFractionDigits:
                confEntry.type == ConfigEntryType.FLOAT ? 1 : 0,
            }"
            class="w-[100px]"
            @update:model-value="$emit('update:value', $event)"
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

    <!-- password value -->
    <v-text-field
      v-else-if="confEntry.type == ConfigEntryType.SECURE_STRING"
      :model-value="confEntry.value"
      :label="$t(`settings.${confEntry.key}.label`, confEntry.label)"
      :required="confEntry.required"
      :disabled="isFieldDisabled"
      :rules="[
        (v) => !(!v && confEntry.required) || $t('settings.invalid_input'),
      ]"
      :type="showPasswordValues ? 'text' : 'password'"
      :append-inner-icon="
        showPasswordValues
          ? 'mdi-eye'
          : typeof confEntry.value == 'string' &&
              confEntry.value.includes(SECURE_STRING_SUBSTITUTE)
            ? ''
            : 'mdi-eye-off'
      "
      variant="outlined"
      density="comfortable"
      clearable
      :readonly="!!confEntry.action"
      @update:model-value="onUpdateValue($event)"
      @click:append-inner="emit('togglePassword')"
      @click:clear="onClear"
    />

    <!-- value with dropdown -->
    <v-select
      v-else-if="confEntry.options && confEntry.options.length > 0"
      :model-value="confEntry.value"
      :chips="confEntry.multi_value"
      :clearable="true"
      :multiple="confEntry.multi_value"
      :items="translatedOptions"
      :disabled="isFieldDisabled"
      :label="$t(`settings.${confEntry.key}.label`, confEntry.label)"
      :required="confEntry.required"
      :rules="[
        (v) =>
          !((v === null || v === undefined) && confEntry.required) ||
          $t('settings.invalid_input'),
      ]"
      variant="outlined"
      density="comfortable"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
    />

    <!-- int value without range -->
    <v-text-field
      v-else-if="
        confEntry.type == ConfigEntryType.INTEGER ||
        confEntry.type == ConfigEntryType.FLOAT
      "
      :model-value="confEntry.value"
      :placeholder="confEntry.default_value?.toString()"
      :disabled="isFieldDisabled"
      :label="$t(`settings.${confEntry.key}.label`, confEntry.label)"
      :required="confEntry.required"
      :rules="[
        (v) => !(!v && confEntry.required) || $t('settings.invalid_input'),
      ]"
      variant="outlined"
      density="comfortable"
      :clearable="!confEntry.required"
      type="number"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
    />

    <!-- icon 'picker' -->
    <v-text-field
      v-else-if="confEntry.type == ConfigEntryType.ICON"
      :model-value="confEntry.value"
      :placeholder="confEntry.default_value?.toString()"
      clearable
      :disabled="isFieldDisabled"
      :label="$t(`settings.${confEntry.key}.label`, confEntry.label)"
      :prepend-inner-icon="confEntry.value as string"
      variant="outlined"
      density="comfortable"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
    />

    <!-- multi-value string combobox -->
    <v-combobox
      v-else-if="
        confEntry.type == ConfigEntryType.STRING && confEntry.multi_value
      "
      :model-value="confEntry.value as string[]"
      multiple
      chips
      :clearable="true"
      :disabled="isFieldDisabled"
      :label="$t(`settings.${confEntry.key}.label`, confEntry.label)"
      :required="confEntry.required"
      :rules="[
        (v) => !(!v && confEntry.required) || $t('settings.invalid_input'),
      ]"
      variant="outlined"
      density="comfortable"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
    />

    <!-- all other: textbox with single value -->
    <v-text-field
      v-else
      :model-value="confEntry.value"
      :placeholder="confEntry.default_value?.toString()"
      clearable
      :disabled="isFieldDisabled"
      :label="$t(`settings.${confEntry.key}.label`, confEntry.label)"
      :required="confEntry.required"
      :rules="[
        (v) => !(!v && confEntry.required) || $t('settings.invalid_input'),
      ]"
      variant="outlined"
      density="comfortable"
      :readonly="!!confEntry.action"
      @update:model-value="onUpdateValue($event)"
      @click:clear="onClear"
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
  ConfigValueOption,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { ConfigEntryUI, isDspLinkEntry } from "@/helpers/config_entry_ui";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  confEntry: ConfigEntryUI;
  showPasswordValues: boolean;
  disabled?: boolean;
}>();

const isFieldDisabled = computed(() => {
  return props.disabled || props.confEntry.read_only;
});

const isDspEntry = computed(() => {
  return isDspLinkEntry(props.confEntry);
});

const labelKey = computed(() => `settings.${props.confEntry.key}.label`);

const resolvedLabel = computed(() =>
  $t(labelKey.value, { link: "{link}" }, {
    default: props.confEntry.label,
  } as any),
);

const linkParts = computed(() => {
  const text = String(resolvedLabel.value ?? "");
  const parts = text.split("{link}");
  return {
    hasLinkToken: parts.length > 1,
    before: parts[0] ?? "",
    after: parts.slice(1).join("{link}") ?? "",
  };
});

const emit = defineEmits<{
  (e: "togglePassword"): void;
  (e: "action"): void;
  (e: "openDsp"): void;
  (e: "update:value", value: ConfigValueType): void;
}>();

const onUpdateValue = (value: ConfigValueType) => {
  // When value is cleared (null/undefined/empty string/empty array), emit the default value instead
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    emit("update:value", props.confEntry.default_value);
  } else {
    emit("update:value", value);
  }
};

const onClear = () => {
  emit("update:value", null);
};

const translatedOptions = computed(() => {
  if (!props.confEntry.options) return [];
  const options: ConfigValueOption[] = [];
  for (const orgOption of props.confEntry.options) {
    let cleanVal = orgOption.value?.toString() || "";
    let cleanTitle = orgOption.title?.toString() || "";
    for (const specialChar of ["@", "$", "|"]) {
      if (cleanVal.includes(specialChar)) {
        cleanVal = cleanVal.replaceAll(specialChar, "");
      }
      if (cleanTitle.includes(specialChar)) {
        cleanTitle = cleanTitle.toString().replaceAll(specialChar, "");
      }
    }
    let title = $t(
      `settings.${props.confEntry.key}.options.${cleanVal}`,
      cleanTitle,
    );
    const option: ConfigValueOption = {
      title: title,
      value: orgOption.value,
    };
    if (option.value == props.confEntry.default_value) {
      option.title += ` [${$t("settings.default")}]`;
    }
    options.push(option);
  }
  return options;
});
</script>

<style scoped>
.config-field {
  flex: 1;
  min-width: 0;
}

.config-divider {
  padding: 8px 0;
}

.divider-label {
  display: block;
  margin-top: 12px;
  font-weight: 600;
  font-size: 0.875rem;
}

.config-alert {
  margin: 8px 0;
}

.action-btn {
  margin: 8px 0;
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

.dsp-config {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.dsp-status {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.dsp-forbidden-reason {
}

.label-link {
  text-transform: none;
  display: inline;
  text-decoration: underline;
  padding: 0;
  min-width: 0;
  height: auto;
  color: inherit;
}
</style>
