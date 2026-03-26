<template>
  <div class="flex-1 min-w-0">
    <!-- divider value -->
    <div
      v-if="confEntry.type == ConfigEntryType.DIVIDER"
      class="py-2"
    >
      <Separator />
      <span
        v-if="confEntry.label"
        class="block mt-3 font-semibold text-sm"
      >
        {{ confEntry.label }}
      </span>
    </div>

    <!-- label value -->
    <Alert
      v-else-if="confEntry.type == ConfigEntryType.LABEL"
      variant="info"
      class="my-2"
    >
      <Info class="h-4 w-4" />
      <AlertDescription>
        {{ getTranslatedLabel() }}
      </AlertDescription>
    </Alert>

    <!-- alert value -->
    <Alert
      v-else-if="confEntry.type == ConfigEntryType.ALERT"
      variant="warning"
      class="my-2"
    >
      <AlertTriangle class="h-4 w-4" />
      <AlertDescription>
        {{ getTranslatedLabel() }}
      </AlertDescription>
    </Alert>

    <!-- action type -->
    <Button
      v-else-if="
        confEntry.type == ConfigEntryType.ACTION ||
        (confEntry.action && !confEntry.value)
      "
      class="my-2 mb-5 w-full h-[50px]"
      :disabled="isFieldDisabled"
      @click="$emit('action')"
    >
      {{ getTranslatedActionLabel() }}
    </Button>

    <!-- DSP Config Button -->
    <div v-else-if="isDspLinkEntry(confEntry)" class="flex items-center gap-4 py-2">
      <span class="text-sm text-muted-foreground">
        {{
          confEntry.value
            ? $t("settings.dsp_enabled")
            : $t("settings.dsp_disabled")
        }}
      </span>
      <Button
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
      <Button variant="outline" @click="$emit('openOptions')">
        {{ $t("player_options.open") }}
      </Button>
    </div>

    <!-- boolean value: checkbox -->
    <div
      v-else-if="confEntry.type == ConfigEntryType.BOOLEAN"
      class="flex items-center gap-2 py-1"
    >
      <Checkbox
        :checked="confEntry.value as boolean"
        :disabled="isFieldDisabled"
        @update:checked="$emit('update:value', $event)"
      />
      <Label class="cursor-pointer" @click="!isFieldDisabled && $emit('update:value', !confEntry.value)">
        {{ getTranslatedLabel() }}
      </Label>
    </div>

    <!-- int/float value in range: slider control -->
    <div
      v-else-if="
        (confEntry.type == ConfigEntryType.INTEGER ||
          confEntry.type == ConfigEntryType.FLOAT) &&
        confEntry.range &&
        confEntry.range.length == 2
      "
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
    >
      <span class="text-sm text-muted-foreground shrink-0">
        {{ getTranslatedLabel() }}
      </span>
      <div class="flex flex-row items-center gap-2 sm:flex-1">
        <Slider
          :model-value="[confEntry.value as number]"
          :disabled="isFieldDisabled"
          :min="confEntry.range[0]"
          :max="confEntry.range[1]"
          :step="confEntry.type == ConfigEntryType.FLOAT ? 0.5 : 1"
          class="flex-1"
          @update:model-value="(val: number[] | undefined) => { if (val) $emit('update:value', val[0]) }"
        />

        <div class="shrink-0">
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
    <div
      v-else-if="confEntry.type == ConfigEntryType.SECURE_STRING"
      class="space-y-1.5"
    >
      <Label>{{ getTranslatedLabel() }}</Label>
      <div class="relative">
        <Input
          :model-value="confEntry.value as string"
          :required="confEntry.required"
          :disabled="isFieldDisabled"
          :type="showPasswordValues ? 'text' : 'password'"
          :readonly="!!confEntry.action"
          class="pr-16"
          @update:model-value="onUpdateValue($event)"
        />
        <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <Button
            v-if="
              showPasswordValues ||
              !(
                typeof confEntry.value == 'string' &&
                confEntry.value.includes(SECURE_STRING_SUBSTITUTE)
              )
            "
            variant="ghost"
            size="icon-sm"
            @click="emit('togglePassword')"
          >
            <Eye v-if="showPasswordValues" class="h-4 w-4" />
            <EyeOff v-else class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            @click="onClear"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- value with dropdown (multi-value) -->
    <div
      v-else-if="confEntry.options && confEntry.options.length > 0 && confEntry.multi_value"
      class="space-y-1.5"
    >
      <Label>{{ getTranslatedLabel() }}</Label>
      <Select
        :model-value="undefined"
        @update:model-value="(val: unknown) => onMultiSelectAdd(String(val))"
      >
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="$t('settings.select_option', 'Select...')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in translatedOptions"
            :key="String(opt.value)"
            :value="String(opt.value)"
          >
            {{ opt.title }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div v-if="Array.isArray(confEntry.value) && confEntry.value.length > 0" class="flex flex-wrap gap-1 mt-1">
        <Badge
          v-for="(val, idx) in (confEntry.value as ConfigValueType[])"
          :key="idx"
          variant="secondary"
          class="gap-1"
        >
          {{ getOptionTitle(val) }}
          <button
            class="ml-0.5 rounded-full hover:bg-muted p-0.5"
            @click="onMultiSelectRemove(idx)"
          >
            <X class="h-3 w-3" />
          </button>
        </Badge>
      </div>
    </div>

    <!-- value with dropdown (single value) -->
    <div
      v-else-if="confEntry.options && confEntry.options.length > 0"
      class="space-y-1.5"
    >
      <Label>{{ getTranslatedLabel() }}</Label>
      <Select
        :model-value="confEntry.value != null ? String(confEntry.value) : undefined"
        @update:model-value="(val: unknown) => onSelectUpdate(String(val))"
      >
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="$t('settings.select_option', 'Select...')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in translatedOptions"
            :key="String(opt.value)"
            :value="String(opt.value)"
          >
            {{ opt.title }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- int value without range -->
    <div
      v-else-if="
        confEntry.type == ConfigEntryType.INTEGER ||
        confEntry.type == ConfigEntryType.FLOAT
      "
      class="space-y-1.5"
    >
      <Label>{{ getTranslatedLabel() }}</Label>
      <div class="relative">
        <Input
          :model-value="confEntry.value as string | number"
          :placeholder="confEntry.default_value?.toString()"
          :disabled="isFieldDisabled"
          :required="confEntry.required"
          type="number"
          @update:model-value="onUpdateValue($event)"
        />
        <Button
          v-if="!confEntry.required"
          variant="ghost"
          size="icon-sm"
          class="absolute right-1 top-1/2 -translate-y-1/2"
          @click="onClear"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- icon 'picker' -->
    <div
      v-else-if="confEntry.type == ConfigEntryType.ICON"
      class="space-y-1.5"
    >
      <Label>{{ getTranslatedLabel() }}</Label>
      <div class="relative">
        <Input
          :model-value="confEntry.value as string"
          :placeholder="confEntry.default_value?.toString()"
          :disabled="isFieldDisabled"
          class="pl-9"
          @update:model-value="onUpdateValue($event)"
        />
        <span
          v-if="confEntry.value"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <component
            :is="resolveIcon(confEntry.value as string)"
            v-if="resolveIcon(confEntry.value as string)"
            class="h-4 w-4"
          />
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          class="absolute right-1 top-1/2 -translate-y-1/2"
          @click="onClear"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- multi-value string combobox -->
    <div
      v-else-if="
        confEntry.type == ConfigEntryType.STRING && confEntry.multi_value
      "
      class="space-y-1.5"
    >
      <Label>{{ getTranslatedLabel() }}</Label>
      <TagsInput
        :model-value="(confEntry.value as string[]) || []"
        :disabled="isFieldDisabled"
        @update:model-value="(val: unknown) => onUpdateValue(val as string[])"
      >
        <TagsInputItem
          v-for="tag in ((confEntry.value as string[]) || [])"
          :key="tag"
          :value="tag"
        >
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput
          :placeholder="$t('settings.type_and_enter', 'Type and press Enter')"
        />
      </TagsInput>
    </div>

    <!-- all other: textbox with single value -->
    <div v-else class="space-y-1.5">
      <Label>{{ getTranslatedLabel() }}</Label>
      <div class="relative">
        <Input
          :model-value="confEntry.value as string | number"
          :placeholder="confEntry.default_value?.toString()"
          :disabled="isFieldDisabled"
          :required="confEntry.required"
          :readonly="!!confEntry.action"
          @update:model-value="onUpdateValue($event)"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          class="absolute right-1 top-1/2 -translate-y-1/2"
          @click="onClear"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ConfigEntryType,
  SECURE_STRING_SUBSTITUTE,
  type ConfigValueOption,
  type ConfigValueType,
} from "@/plugins/api/interfaces";
import { type ConfigEntryUI, isDspLinkEntry } from "@/helpers/config_entry_ui";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  X,
} from "lucide-vue-next";

const props = defineProps<{
  confEntry: ConfigEntryUI;
  showPasswordValues: boolean;
  disabled?: boolean;
}>();

const isFieldDisabled = computed(() => {
  return props.disabled || props.confEntry.read_only;
});

const emit = defineEmits<{
  (e: "togglePassword"): void;
  (e: "action"): void;
  (e: "openDsp"): void;
  (e: "openOptions"): void;
  (e: "update:value", value: ConfigValueType): void;
}>();

// Helper function to get the translated label for a config entry
const getTranslatedLabel = () => {
  // prefer translation_key over key (using key for translations is deprecated)
  const key = props.confEntry.translation_key || props.confEntry.key;
  const translationKey = `settings.${key}.label`;
  const fallback = props.confEntry.label;

  // If translation_params are provided, pass them directly
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

  // If translation_params are provided, pass them directly
  if (
    props.confEntry.translation_params &&
    props.confEntry.translation_params.length > 0
  ) {
    return $t(translationKey, props.confEntry.translation_params) || fallback;
  }

  return $t(translationKey, fallback);
};

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

// Handle single-value select updates - find the original value type
const onSelectUpdate = (stringValue: string) => {
  const option = props.confEntry.options?.find(
    (opt) => String(opt.value) === stringValue,
  );
  if (option) {
    onUpdateValue(option.value);
  } else {
    onUpdateValue(stringValue);
  }
};

// Handle multi-select add
const onMultiSelectAdd = (stringValue: string) => {
  const option = props.confEntry.options?.find(
    (opt) => String(opt.value) === stringValue,
  );
  const actualValue = option ? option.value : stringValue;
  const currentValues = Array.isArray(props.confEntry.value)
    ? [...(props.confEntry.value as ConfigValueType[])]
    : [];
  if (!currentValues.includes(actualValue)) {
    currentValues.push(actualValue);
  }
  onUpdateValue(currentValues as ConfigValueType);
};

// Handle multi-select remove
const onMultiSelectRemove = (index: number) => {
  const currentValues = Array.isArray(props.confEntry.value)
    ? [...(props.confEntry.value as ConfigValueType[])]
    : [];
  currentValues.splice(index, 1);
  onUpdateValue(currentValues as ConfigValueType);
};

// Get display title for a multi-select value
const getOptionTitle = (value: ConfigValueType): string => {
  const option = translatedOptions.value.find(
    (opt) => opt.value === value || String(opt.value) === String(value),
  );
  return option?.title || String(value);
};

// Simple icon resolver stub - returns null for MDI icons
const resolveIcon = (_iconName: string) => {
  return null;
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
