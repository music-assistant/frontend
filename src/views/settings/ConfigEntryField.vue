<template>
  <div class="config-field">
    <!-- divider value -->
    <div
      v-if="confEntry.type == ConfigEntryType.DIVIDER"
      class="flex flex-col gap-3 py-2"
    >
      <Separator />
      <Label v-if="confEntry.label" class="text-sm font-semibold">
        {{ confEntry.label }}
      </Label>
    </div>

    <!-- label value -->
    <Alert
      v-else-if="confEntry.type == ConfigEntryType.LABEL"
      variant="info"
      class="my-2"
    >
      <Info class="size-4" />
      <AlertDescription>{{ getTranslatedLabel() }}</AlertDescription>
    </Alert>

    <!-- alert value -->
    <Alert
      v-else-if="confEntry.type == ConfigEntryType.ALERT"
      variant="warning"
      class="my-2"
    >
      <TriangleAlert class="size-4" />
      <AlertDescription>{{ getTranslatedLabel() }}</AlertDescription>
    </Alert>

    <div
      v-else-if="isStandaloneAction"
      class="flex flex-wrap items-center py-2"
    >
      <Button
        type="button"
        :variant="actionButtonVariant"
        size="sm"
        :disabled="isFieldDisabled"
        @click="$emit('action')"
      >
        {{ getTranslatedActionLabel() }}
      </Button>
    </div>

    <!-- DSP Config Button -->
    <div
      v-else-if="isDspLinkEntry(confEntry)"
      class="flex items-center gap-4 py-2"
    >
      <span class="text-muted-foreground text-sm">
        {{
          confEntry.value
            ? $t("settings.dsp_enabled")
            : $t("settings.dsp_disabled")
        }}
      </span>
      <Button
        type="button"
        variant="outline"
        :disabled="isFieldDisabled"
        @click="$emit('openDsp')"
      >
        {{ $t("open_dsp_settings") }}
      </Button>
    </div>

    <!-- Player Options Button -->
    <div
      v-else-if="confEntry.type == ConfigEntryType.OPTIONS"
      class="flex items-center gap-4 py-2"
    >
      <Button type="button" variant="outline" @click="$emit('openOptions')">
        {{ $t("player_options.open") }}
      </Button>
    </div>

    <!-- boolean value: checkbox -->
    <Field
      v-else-if="confEntry.type == ConfigEntryType.BOOLEAN"
      orientation="horizontal"
    >
      <Checkbox
        :id="fieldId"
        :model-value="(value as boolean) ?? false"
        :disabled="isFieldDisabled"
        @update:model-value="(v) => field?.handleChange(v === true)"
      />
      <FieldLabel :for="fieldId" class="font-normal">
        {{ getTranslatedLabel() }}
      </FieldLabel>
    </Field>

    <!-- int/float value in range: slider control -->
    <Field
      v-else-if="
        (confEntry.type == ConfigEntryType.INTEGER ||
          confEntry.type == ConfigEntryType.FLOAT) &&
        confEntry.range &&
        confEntry.range.length == 2
      "
    >
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <NumberField
        :model-value="(value as number) ?? undefined"
        :min="confEntry.range[0]"
        :max="confEntry.range[1]"
        :step="confEntry.type == ConfigEntryType.FLOAT ? 0.5 : 1"
        :disabled="isFieldDisabled"
        :format-options="{
          maximumFractionDigits:
            confEntry.type == ConfigEntryType.FLOAT ? 1 : 0,
        }"
        class="w-full"
        @update:model-value="(v) => field?.handleChange(v ?? null)"
      >
        <NumberFieldContent>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldContent>
      </NumberField>
      <Slider
        :id="fieldId"
        :model-value="[(value as number) ?? confEntry.range[0]]"
        :disabled="isFieldDisabled"
        :min="confEntry.range[0]"
        :max="confEntry.range[1]"
        :step="confEntry.type == ConfigEntryType.FLOAT ? 0.5 : 1"
        class="mt-1 w-full px-1"
        @update:model-value="
          (v: number[] | undefined) => field?.handleChange(v?.[0] ?? null)
        "
      />
    </Field>

    <!-- password value -->
    <Field
      v-else-if="confEntry.type == ConfigEntryType.SECURE_STRING"
      :data-invalid="isInvalid"
    >
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          :id="fieldId"
          :model-value="(value as string) ?? ''"
          :type="showPasswordValues ? 'text' : 'password'"
          :disabled="isFieldDisabled"
          :readonly="!!confEntry.action"
          :aria-invalid="isInvalid"
          @blur="field?.handleBlur"
          @input="
            (e: Event) => onUpdateValue((e.target as HTMLInputElement).value)
          "
        />
        <InputGroupAddon
          v-if="hasInlineAction || !(isSecureSubstitute && !showPasswordValues)"
          align="inline-end"
        >
          <InputGroupButton
            v-if="hasInlineAction"
            type="button"
            :variant="actionButtonVariant"
            :disabled="isFieldDisabled"
            @click="emit('action')"
          >
            {{ getTranslatedActionLabel() }}
          </InputGroupButton>
          <InputGroupButton
            v-if="!(isSecureSubstitute && !showPasswordValues)"
            type="button"
            aria-label="toggle password visibility"
            @click="emit('togglePassword')"
          >
            <Eye v-if="showPasswordValues" class="size-4" />
            <EyeOff v-else class="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldError v-if="isInvalid" :errors="errors" />
    </Field>

    <Field
      v-else-if="
        confEntry.options &&
        confEntry.options.length > 0 &&
        confEntry.multi_value
      "
      :data-invalid="isInvalid"
    >
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <MultiSelect
        :model-value="multiSelectValue"
        :options="selectOptions"
        :placeholder="getTranslatedLabel()"
        @update:model-value="onMultiSelectUpdate"
      />
      <FieldError v-if="isInvalid" :errors="errors" />
    </Field>

    <!-- value with dropdown (single value with options) -->
    <Field
      v-else-if="confEntry.options && confEntry.options.length > 0"
      :data-invalid="isInvalid"
    >
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <Select
        :model-value="selectValue"
        :disabled="isFieldDisabled"
        @update:model-value="onSelectUpdate"
      >
        <SelectTrigger :id="fieldId" class="w-full" :aria-invalid="isInvalid">
          <SelectValue :placeholder="getTranslatedLabel()" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in selectOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <FieldError v-if="isInvalid" :errors="errors" />
    </Field>

    <!-- int value without range -->
    <Field
      v-else-if="
        confEntry.type == ConfigEntryType.INTEGER ||
        confEntry.type == ConfigEntryType.FLOAT
      "
      :data-invalid="isInvalid"
    >
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <Input
        :id="fieldId"
        :model-value="(value as number) ?? ''"
        type="number"
        class="w-full"
        :placeholder="confEntry.default_value?.toString()"
        :disabled="isFieldDisabled"
        :aria-invalid="isInvalid"
        @blur="field?.handleBlur"
        @update:model-value="onNumberInput"
      />
      <FieldError v-if="isInvalid" :errors="errors" />
    </Field>

    <!-- icon 'picker' -->
    <Field v-else-if="confEntry.type == ConfigEntryType.ICON">
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <InputGroup>
        <InputGroupAddon v-if="value" align="inline-start">
          <span
            class="mdi text-base leading-none"
            :class="value as string"
          ></span>
        </InputGroupAddon>
        <InputGroupInput
          :id="fieldId"
          :model-value="(value as string) ?? ''"
          :placeholder="confEntry.default_value?.toString()"
          :disabled="isFieldDisabled"
          @blur="field?.handleBlur"
          @input="
            (e: Event) => onUpdateValue((e.target as HTMLInputElement).value)
          "
        />
      </InputGroup>
    </Field>

    <!-- multi-value string combobox -->
    <Field
      v-else-if="
        confEntry.type == ConfigEntryType.STRING && confEntry.multi_value
      "
      :data-invalid="isInvalid"
    >
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <TagsInput
        :model-value="(value as string[]) ?? []"
        :disabled="isFieldDisabled"
        :aria-invalid="isInvalid"
        @update:model-value="(v) => field?.handleChange(v as string[])"
      >
        <TagsInputItem
          v-for="item in (value as string[]) ?? []"
          :key="item"
          :value="item"
        >
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput :placeholder="getTranslatedLabel()" />
      </TagsInput>
      <FieldError v-if="isInvalid" :errors="errors" />
    </Field>

    <!-- all other: textbox with single value -->
    <Field v-else :data-invalid="isInvalid">
      <FieldLabel :for="fieldId">{{ getTranslatedLabel() }}</FieldLabel>
      <InputGroup v-if="hasInlineAction">
        <InputGroupInput
          :id="fieldId"
          :model-value="(value as string) ?? ''"
          :placeholder="confEntry.default_value?.toString()"
          :disabled="isFieldDisabled"
          readonly
          :aria-invalid="isInvalid"
          @blur="field?.handleBlur"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            :variant="actionButtonVariant"
            :disabled="isFieldDisabled"
            @click="emit('action')"
          >
            {{ getTranslatedActionLabel() }}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <Input
        v-else
        :id="fieldId"
        :model-value="(value as string) ?? ''"
        :placeholder="confEntry.default_value?.toString()"
        :disabled="isFieldDisabled"
        :aria-invalid="isInvalid"
        @blur="field?.handleBlur"
        @update:model-value="(v) => onUpdateValue(v as string)"
      />
      <FieldError v-if="isInvalid" :errors="errors" />
    </Field>
  </div>
</template>

<script setup lang="ts">
import type { AnyFieldApi } from "@tanstack/form-core";
import { Eye, EyeOff, Info, TriangleAlert } from "lucide-vue-next";
import { computed } from "vue";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, type ButtonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";
import MultiSelect from "@/components/users/MultiSelect.vue";
import { ConfigEntryUI, isDspLinkEntry } from "@/helpers/config_entry_ui";
import {
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  confEntry: ConfigEntryUI;
  showPasswordValues: boolean;
  disabled?: boolean;
  field?: AnyFieldApi;
  fieldValue?: ConfigValueType;
  invalid?: boolean;
  errors?: (string | { message: string | undefined } | undefined)[];
}>();

const emit = defineEmits<{
  (e: "togglePassword"): void;
  (e: "action"): void;
  (e: "openDsp"): void;
  (e: "openOptions"): void;
}>();

const isFieldDisabled = computed(() => {
  return props.disabled || props.confEntry.read_only;
});

const fieldId = computed(() => `cfg-${props.confEntry.key}`);

const value = computed<ConfigValueType>(() => props.fieldValue ?? null);

const isInvalid = computed(() => !!props.invalid);

const isSecureSubstitute = computed(
  () =>
    typeof value.value === "string" &&
    value.value.includes(SECURE_STRING_SUBSTITUTE),
);

const isStandaloneAction = computed(
  () =>
    props.confEntry.type === ConfigEntryType.ACTION ||
    (!!props.confEntry.action &&
      (props.confEntry.value === null ||
        props.confEntry.value === undefined ||
        props.confEntry.value === "")),
);

const hasInlineAction = computed(
  () => !!props.confEntry.action && !isStandaloneAction.value,
);

const isDestructiveAction = computed(() => {
  const hint =
    `${props.confEntry.key} ${props.confEntry.action ?? ""}`.toLowerCase();
  return /\b(reset|delete|remove|revoke|restore|wipe|purge|clear)\b/.test(hint);
});

const actionButtonVariant = computed((): ButtonVariants["variant"] =>
  isDestructiveAction.value ? "destructive" : "default",
);

// Helper function to get the translated label for a config entry
const getTranslatedLabel = () => {
  // prefer translation_key over key (using key for translations is deprecated)
  const key = props.confEntry.translation_key || props.confEntry.key;
  const translationKey = `settings.${key}.label`;
  const fallback = props.confEntry.label;

  if (
    props.confEntry.translation_params &&
    props.confEntry.translation_params.length > 0
  ) {
    return $t(translationKey, props.confEntry.translation_params) || fallback;
  }

  return $t(translationKey, fallback);
};

// Helper function to get the translated action label for a config entry
const getTranslatedActionLabel = () => {
  const key = props.confEntry.translation_key || props.confEntry.key;
  const translationKey = `settings.${key}.label`;
  const fallback = props.confEntry.action_label || props.confEntry.label;

  if (
    props.confEntry.translation_params &&
    props.confEntry.translation_params.length > 0
  ) {
    return $t(translationKey, props.confEntry.translation_params) || fallback;
  }

  return $t(translationKey, fallback);
};

const onUpdateValue = (newValue: ConfigValueType) => {
  if (
    newValue === null ||
    newValue === undefined ||
    (newValue === "" && props.confEntry.required) ||
    (Array.isArray(newValue) && newValue.length === 0)
  ) {
    props.field?.handleChange(props.confEntry.default_value);
  } else {
    props.field?.handleChange(newValue);
  }
};

const onNumberInput = (raw: string | number) => {
  if (raw === "" || raw === null || raw === undefined) {
    props.field?.handleChange(null);
    return;
  }
  const parsed =
    props.confEntry.type == ConfigEntryType.FLOAT
      ? parseFloat(String(raw))
      : parseInt(String(raw), 10);
  props.field?.handleChange(Number.isNaN(parsed) ? null : parsed);
};

const translatedOptions = computed(() => {
  if (!props.confEntry.options) return [];
  return props.confEntry.options.map((orgOption) => {
    let cleanVal = orgOption.value?.toString() || "";
    let cleanTitle = orgOption.title?.toString() || "";
    for (const specialChar of ["@", "$", "|"]) {
      cleanVal = cleanVal.replaceAll(specialChar, "");
      cleanTitle = cleanTitle.replaceAll(specialChar, "");
    }
    let title = $t(
      `settings.${props.confEntry.key}.options.${cleanVal}`,
      cleanTitle,
    );
    if (orgOption.value === props.confEntry.default_value) {
      title += ` [${$t("settings.default")}]`;
    }
    return { title, value: orgOption.value };
  });
});

const selectOptions = computed(() =>
  translatedOptions.value.map((o) => ({
    label: o.title,
    value: String(o.value),
  })),
);

const rawForString = (str: string): ConfigValueType => {
  const match = props.confEntry.options?.find((o) => String(o.value) === str);
  return match ? match.value : str;
};

const selectValue = computed(() =>
  value.value === null || value.value === undefined
    ? undefined
    : String(value.value),
);

const onSelectUpdate = (v: unknown) => {
  if (v === null || v === undefined) {
    onUpdateValue(props.confEntry.default_value);
    return;
  }
  props.field?.handleChange(rawForString(String(v)));
};

const multiSelectValue = computed(() => {
  const arr = Array.isArray(value.value) ? value.value : [];
  return arr.map((v) => String(v));
});

const onMultiSelectUpdate = (vals: string[]) => {
  if (!vals || vals.length === 0) {
    onUpdateValue(props.confEntry.default_value);
    return;
  }
  props.field?.handleChange(
    vals.map((v) => rawForString(v)) as ConfigValueType,
  );
};
</script>

<style scoped>
.config-field {
  flex: 1;
  min-width: 0;
}
</style>
