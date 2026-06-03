<template>
  <form
    v-if="entries"
    :class="{ 'pointer-events-none opacity-60': disabled }"
    @submit.prevent="form.handleSubmit"
  >
    <!-- Generic settings section -->
    <div
      v-for="panel of regularPanels.filter(
        (p) => p === 'generic' && entriesForCategory(p).length > 0,
      )"
      :key="panel"
      class="category-section"
    >
      <div class="category-header">
        <span
          class="mdi text-xl text-primary"
          :class="getCategoryIcon(panel)"
        ></span>
        <span class="category-title">{{ getCategoryTranslation(panel) }}</span>
      </div>
      <div class="category-content">
        <form.Field
          v-for="conf_entry of entriesForCategory(panel)"
          :key="conf_entry.key"
          :name="conf_entry.key"
          :listeners="listenersFor(conf_entry)"
        >
          <template #default="{ field }">
            <ConfigEntryRow
              :entry="conf_entry"
              :field="field"
              :field-value="field.state.value"
              :invalid="field.state.meta.isTouched && !field.state.meta.isValid"
              :errors="field.state.meta.errors"
              :show-password-values="showPasswordValues"
              :disabled="isDisabledNow(conf_entry)"
              @action="onEntryAction"
              @toggle-password="showPasswordValues = !showPasswordValues"
              @open-dsp="openDspConfig"
              @open-options="openPlayerOptions"
            />
          </template>
        </form.Field>
      </div>
    </div>

    <!-- Protocol Configuration Section -->
    <div
      v-if="
        protocolGeneralEntries.length > 0 ||
        protocolPanels.filter(
          (p) => entriesForCategory(p).length > 0 || isProtocolCategory(p),
        ).length > 0
      "
      class="protocol-section"
    >
      <div class="protocol-section-header">
        <span class="mdi mdi-swap-horizontal text-2xl text-primary"></span>
        <span class="protocol-section-title">
          {{ $t("settings.category.protocol_settings") }}
        </span>
      </div>
      <!-- General protocol settings (shown before accordion) -->
      <div
        v-if="protocolGeneralEntries.length > 0"
        class="protocol-general-settings"
      >
        <form.Field
          v-for="conf_entry of protocolGeneralEntries"
          :key="conf_entry.key"
          :name="conf_entry.key"
          :listeners="listenersFor(conf_entry)"
        >
          <template #default="{ field }">
            <ConfigEntryRow
              :entry="conf_entry"
              :field="field"
              :field-value="field.state.value"
              :invalid="field.state.meta.isTouched && !field.state.meta.isValid"
              :errors="field.state.meta.errors"
              :show-password-values="showPasswordValues"
              :disabled="isDisabledNow(conf_entry)"
              @action="onEntryAction"
              @toggle-password="showPasswordValues = !showPasswordValues"
              @open-dsp="openDspConfig"
              @open-options="openPlayerOptions"
            />
          </template>
        </form.Field>
      </div>
      <!-- Single protocol: show directly without expansion -->
      <div
        v-if="
          protocolPanels.filter(
            (p) => entriesForCategory(p).length > 0 || isProtocolCategory(p),
          ).length === 1
        "
        class="protocol-single-panel"
      >
        <div
          v-for="panel of protocolPanels.filter(
            (p) => entriesForCategory(p).length > 0 || isProtocolCategory(p),
          )"
          :key="panel"
        >
          <div
            v-if="entriesForCategory(panel).length === 0"
            class="protocol-disabled-message"
          >
            {{ getProtocolEmptyMessage(panel) }}
          </div>
          <form.Field
            v-for="conf_entry of entriesForCategory(panel)"
            :key="conf_entry.key"
            :name="conf_entry.key"
            :listeners="listenersFor(conf_entry)"
          >
            <template #default="{ field }">
              <ConfigEntryRow
                :entry="conf_entry"
                :field="field"
                :field-value="field.state.value"
                :invalid="
                  field.state.meta.isTouched && !field.state.meta.isValid
                "
                :errors="field.state.meta.errors"
                :show-password-values="showPasswordValues"
                :disabled="isDisabledNow(conf_entry)"
                @action="onEntryAction"
                @toggle-password="showPasswordValues = !showPasswordValues"
                @open-dsp="openDspConfig"
                @open-options="openPlayerOptions"
              />
            </template>
          </form.Field>
        </div>
      </div>
      <!-- Multiple protocols: show as accordion -->
      <Accordion
        v-else
        type="single"
        collapsible
        :model-value="activeProtocolPanel"
        class="protocol-panels"
        @update:model-value="
          (v) => (activeProtocolPanel = v as string | undefined)
        "
      >
        <AccordionItem
          v-for="panel of protocolPanels.filter(
            (p) => entriesForCategory(p).length > 0 || isProtocolCategory(p),
          )"
          :key="panel"
          :value="panel"
          class="protocol-panel"
        >
          <div class="flex items-center gap-2 pr-4 pl-5">
            <AccordionTrigger class="flex-1">
              <div class="flex items-center gap-2">
                <ProviderIcon
                  v-if="getProtocolDomain(panel)"
                  :domain="getProtocolDomain(panel)!"
                  :size="24"
                />
                <span class="text-sm">{{ getCategoryTranslation(panel) }}</span>
              </div>
            </AccordionTrigger>
            <Switch
              v-if="getProtocolEnabledEntry(panel)"
              :model-value="!!protocolEnabledValue(panel)"
              @click.stop
              @update:model-value="
                (v) => toggleProtocolEnabled(getProtocolEnabledEntry(panel)!, v)
              "
            />
            <Switch v-else :model-value="true" disabled @click.stop />
          </div>
          <AccordionContent>
            <div class="config-panel-content">
              <div
                v-if="entriesForCategory(panel).length === 0"
                class="protocol-disabled-message"
              >
                {{ getProtocolEmptyMessage(panel) }}
              </div>
              <form.Field
                v-for="conf_entry of entriesForCategory(panel)"
                :key="conf_entry.key"
                :name="conf_entry.key"
                :listeners="listenersFor(conf_entry)"
              >
                <template #default="{ field }">
                  <ConfigEntryRow
                    :entry="conf_entry"
                    :field="field"
                    :field-value="field.state.value"
                    :invalid="
                      field.state.meta.isTouched && !field.state.meta.isValid
                    "
                    :errors="field.state.meta.errors"
                    :show-password-values="showPasswordValues"
                    :disabled="isDisabledNow(conf_entry)"
                    @action="onEntryAction"
                    @toggle-password="showPasswordValues = !showPasswordValues"
                    @open-dsp="openDspConfig"
                    @open-options="openPlayerOptions"
                  />
                </template>
              </form.Field>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>

    <!-- Other regular settings sections -->
    <div
      v-for="panel of regularPanels.filter(
        (p) => p !== 'generic' && entriesForCategory(p).length > 0,
      )"
      :key="panel"
      class="category-section"
    >
      <div class="category-header">
        <span
          class="mdi text-xl text-primary"
          :class="getCategoryIcon(panel)"
        ></span>
        <span class="category-title">{{ getCategoryTranslation(panel) }}</span>
      </div>
      <div class="category-content">
        <form.Field
          v-for="conf_entry of entriesForCategory(panel)"
          :key="conf_entry.key"
          :name="conf_entry.key"
          :listeners="listenersFor(conf_entry)"
        >
          <template #default="{ field }">
            <ConfigEntryRow
              :entry="conf_entry"
              :field="field"
              :field-value="field.state.value"
              :invalid="field.state.meta.isTouched && !field.state.meta.isValid"
              :errors="field.state.meta.errors"
              :show-password-values="showPasswordValues"
              :disabled="isDisabledNow(conf_entry)"
              @action="onEntryAction"
              @toggle-password="showPasswordValues = !showPasswordValues"
              @open-dsp="openDspConfig"
              @open-options="openPlayerOptions"
            />
          </template>
        </form.Field>
      </div>
    </div>

    <div v-if="!disabled" class="config-actions">
      <!-- Show advanced settings toggle -->
      <div class="advanced-toggle-wrapper">
        <Switch id="advanced-toggle" v-model="showAdvancedSettings" />
        <Label for="advanced-toggle" class="text-sm font-normal opacity-85">
          {{ $t("settings.show_advanced_settings") }}
        </Label>
      </div>
      <Button type="submit" size="lg" class="w-full" :disabled="!canSave">
        {{ $t("settings.save") }}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        class="w-full"
        @click="handleClose"
      >
        {{ $t("close") }}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        class="w-full"
        @click="resetToDefaults"
      >
        {{ $t("settings.reset_to_defaults") }}
      </Button>
    </div>
  </form>

  <!-- Unsaved changes confirmation dialog -->
  <AlertDialog
    :open="showUnsavedDialog"
    @update:open="(o) => (showUnsavedDialog = o)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("settings.unsaved_changes")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("settings.unsaved_changes_message") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="sm:items-center">
        <AlertDialogCancel class="mt-0" @click="cancelDiscard">
          {{ $t("settings.stay") }}
        </AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-white hover:bg-destructive/90"
          @click="confirmDiscard"
        >
          {{ $t("settings.discard") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave, useRouter } from "vue-router";

import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfigEntryUI, isInjected } from "@/helpers/config_entry_ui";
import {
  buildConfigDefaults,
  buildConfigSchema,
  isEntryDisabled,
  isFormValueEntry,
} from "@/lib/forms/config-entry";
import {
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import ConfigEntryRow from "./ConfigEntryRow.vue";

const router = useRouter();
const { t } = useI18n();

export interface Props {
  configEntries: ConfigEntryUI[];
  disabled: boolean;
  defaultExpandedProtocol?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "submit", values: Record<string, ConfigValueType>): void;
  (
    e: "action",
    action: string,
    values: Record<string, ConfigValueType>,
    immediateApply: boolean,
  ): void;
  (e: "immediateApply", values: Record<string, ConfigValueType>): void;
}>();

type FormValues = Record<string, ConfigValueType>;

const clone = <T,>(v: T): T =>
  typeof v === "object" && v !== null ? JSON.parse(JSON.stringify(v)) : v;

// global refs
const entries = ref<ConfigEntryUI[]>();
const activeProtocolPanel = ref<string | undefined>(undefined);
const showPasswordValues = ref(false);
const showAdvancedSettings = ref(false);
const showUnsavedDialog = ref(false);
const allowNavigation = ref(false);
const oldValues = ref<FormValues>({});
const oldValuesInitialized = ref(false);

const schema = ref(buildConfigSchema(props.configEntries, t));

const form = useForm({
  defaultValues: buildConfigDefaults(props.configEntries) as FormValues,
  validators: {
    onChange: ({ value }: { value: FormValues }) => validate(value),
    onSubmit: ({ value }: { value: FormValues }) => validate(value),
  },
  onSubmit: () => {
    allowNavigation.value = true;
    emit("submit", getCurrentValues());
  },
});

const validate = (value: FormValues) => {
  const result = schema.value.safeParse(value);
  if (result.success) return undefined;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in fields)) fields[key] = issue.message;
  }
  return { fields };
};

const formValues = form.useStore((s) => s.values as FormValues);

// computed props
const panels = computed(() => {
  const allCategories = new Set(
    entries
      .value!.map((x) => x.category)
      .filter((x) => !["generic", "advanced", "protocol_general"].includes(x)),
  );
  return ["generic", ...allCategories];
});

const regularPanels = computed(() =>
  panels.value.filter((p) => !isProtocolRelated(p)),
);

const protocolPanels = computed(() =>
  panels.value.filter((p) => isProtocolCategory(p)),
);

const protocolGeneralEntries = computed(() =>
  entriesForCategory("protocol_general"),
);

const isValid = computed(
  () => schema.value.safeParse(formValues.value).success,
);

const hasUnsavedChanges = computed(() => {
  if (!entries.value) return false;
  for (const entry of entries.value) {
    if (!isFormValueEntry(entry)) continue;
    const currentValue = formValues.value[entry.key];
    if (
      entry.type == ConfigEntryType.SECURE_STRING &&
      currentValue == SECURE_STRING_SUBSTITUTE
    ) {
      continue;
    }
    if (
      JSON.stringify(oldValues.value[entry.key]) !==
      JSON.stringify(currentValue)
    ) {
      return true;
    }
  }
  return false;
});

const canSave = computed(() => isValid.value && hasUnsavedChanges.value);

const listenersFor = (entry: ConfigEntryUI) =>
  entry.immediate_apply
    ? {
        onChange: ({ value }: { value: ConfigValueType }) =>
          onFieldChange(entry, value),
      }
    : undefined;

// Helper functions for protocol categories
const isProtocolCategory = (category: string): boolean =>
  category.startsWith("protocol_");

const isProtocolRelated = (category: string): boolean =>
  category === "protocol_general" || isProtocolCategory(category);

const getProtocolDomain = (category: string): string | undefined => {
  if (!isProtocolCategory(category)) return undefined;
  return category.replace("protocol_", "");
};

const getProtocolEnabledEntry = (
  category: string,
): ConfigEntryUI | undefined => {
  if (!isProtocolCategory(category) || !entries.value) return undefined;
  return entries.value.find(
    (entry) =>
      entry.category === category && entry.key.endsWith("||protocol||enabled"),
  );
};

const protocolEnabledValue = (category: string): boolean => {
  const entry = getProtocolEnabledEntry(category);
  if (!entry) return true;
  return !!formValues.value[entry.key];
};

const toggleProtocolEnabled = (entry: ConfigEntryUI, value: boolean) => {
  form.setFieldValue(entry.key, value);
  onFieldChange(entry, value);
};

const hasHiddenAdvancedSettings = (category: string): boolean => {
  if (!entries.value) return false;
  return entries.value.some(
    (entry) =>
      entry.category === category &&
      entry.advanced &&
      !entry.key.includes("||protocol||enabled") &&
      isVisible(entry),
  );
};

const getProtocolEmptyMessage = (category: string): string => {
  const isEnabled = protocolEnabledValue(category);
  if (!isEnabled) return $t("settings.protocol_disabled_message");
  if (hasHiddenAdvancedSettings(category)) {
    return $t("settings.protocol_no_settings_with_advanced");
  }
  return $t("settings.protocol_no_settings");
};

const syncFromProps = (val: ConfigEntryUI[] | undefined) => {
  entries.value = [...(val || [])];
  schema.value = buildConfigSchema(entries.value, t);

  const incoming = buildConfigDefaults(entries.value);
  const captureAll = !oldValuesInitialized.value;
  for (const [key, newVal] of Object.entries(incoming)) {
    const isNew = !(key in oldValues.value);
    const entry = entries.value.find((e) => e.key === key);
    const rebaseline = captureAll || isNew || !!entry?.immediate_apply;
    if (
      rebaseline ||
      JSON.stringify(oldValues.value[key]) !== JSON.stringify(newVal)
    ) {
      form.setFieldValue(key, newVal);
    }
    if (rebaseline) {
      oldValues.value[key] = clone(newVal);
    }
  }
  oldValuesInitialized.value = true;

  if (
    props.defaultExpandedProtocol &&
    protocolPanels.value.includes(props.defaultExpandedProtocol)
  ) {
    activeProtocolPanel.value = props.defaultExpandedProtocol;
  }
};

watch(() => props.configEntries, syncFromProps, { immediate: true });

// methods
const onFieldChange = (entry: ConfigEntryUI, value: ConfigValueType) => {
  if (!entry.immediate_apply) return;
  if (JSON.stringify(oldValues.value[entry.key]) === JSON.stringify(value)) {
    return;
  }
  oldValues.value[entry.key] = clone(value);
  emit("immediateApply", { [entry.key]: value });
};

const onEntryAction = (entry: ConfigEntryUI) => {
  emit(
    "action",
    entry.action || entry.key,
    getCurrentValues(),
    !!entry.immediate_apply,
  );
  form.setFieldValue(entry.key, entry.action ? null : entry.key);
};

const openDspConfig = () => {
  router.push(`${router.currentRoute.value.path}/dsp`);
};

const openPlayerOptions = () => {
  router.push(`${router.currentRoute.value.path}/options`);
};

const resetToDefaults = () => {
  if (!entries.value) return;
  for (const entry of entries.value) {
    if (!isFormValueEntry(entry)) continue;
    form.setFieldValue(entry.key, entry.default_value ?? null);
  }
};

const handleClose = () => {
  if (hasUnsavedChanges.value) {
    showUnsavedDialog.value = true;
  } else {
    router.back();
  }
};

const confirmDiscard = () => {
  showUnsavedDialog.value = false;
  allowNavigation.value = true;
  router.back();
};

const cancelDiscard = () => {
  showUnsavedDialog.value = false;
};

// Navigation guard for route changes
onBeforeRouteLeave((_to, _from, next) => {
  if (allowNavigation.value || !hasUnsavedChanges.value) {
    next();
  } else {
    showUnsavedDialog.value = true;
    next(false);
  }
});

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = "";
  }
};

window.addEventListener("beforeunload", handleBeforeUnload);
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});

const isNullOrUndefined = (value: unknown) =>
  value === null || value === undefined;

const isVisible = (entry: ConfigEntryUI) => !entry.hidden;

const isDisabledNow = (entry: ConfigEntryUI) =>
  isEntryDisabled(entry, formValues.value, entries.value || []);

const visibleEntriesByCategory = computed(() => {
  const result: Record<string, ConfigEntryUI[]> = {};
  if (!entries.value) return result;
  for (const entry of entries.value) {
    if (!isVisible(entry)) continue;
    if (entry.key === "enabled" || entry.key === "name") continue;
    if (entry.key.includes("||protocol||enabled")) continue;
    if (entry.advanced && !showAdvancedSettings.value) continue;
    const category = entry.category || "generic";
    if (!result[category]) result[category] = [];
    result[category].push(entry);
  }
  return result;
});

const entriesForCategory = (category: string) =>
  visibleEntriesByCategory.value[category] || [];

const getCategoryTranslation = (category: string) => {
  const entriesInCategory = entriesForCategory(category);
  let entryWithTranslation: ConfigEntryUI | undefined = entriesInCategory[0];
  if (!entryWithTranslation && isProtocolCategory(category) && entries.value) {
    entryWithTranslation = entries.value.find((e) => e.category === category);
  }
  if (entryWithTranslation?.category_translation_key) {
    const translationKey = entryWithTranslation.category_translation_key;
    if (
      entryWithTranslation.category_translation_params &&
      entryWithTranslation.category_translation_params.length > 0
    ) {
      return $t(
        translationKey,
        entryWithTranslation.category_translation_params,
      );
    }
    return $t(translationKey, category);
  }
  return $t(`settings.category.${category}`, category);
};

const getCurrentValues = () => {
  const values: Record<string, ConfigValueType> = {};
  const vals = form.state.values as FormValues;
  for (const entry of props.configEntries!) {
    if (isInjected(entry)) continue;
    let value = entry.key in vals ? vals[entry.key] : entry.value;
    if (isNullOrUndefined(value)) value = null;
    if (
      entry.type == ConfigEntryType.SECURE_STRING &&
      value == SECURE_STRING_SUBSTITUTE
    ) {
      continue;
    }
    values[entry.key] = value;
  }
  return values;
};

const getCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    generic: "mdi-cog",
    audio: "mdi-volume-high",
    advanced: "mdi-tune",
    network: "mdi-lan",
    playback: "mdi-play-circle",
    announcements: "mdi-bullhorn",
    airplay: "mdi-apple",
    chromecast: "mdi-cast",
    slimproto: "mdi-speaker-wireless",
    snapcast: "mdi-speaker-multiple",
    ugp: "mdi-speaker-multiple",
    authentication: "mdi-lock",
    sync: "mdi-sync",
    web_player: "mdi-play-network",
    player_controls: "mdi-tune-variant",
    protocol_sonos: "mdi-speaker",
    protocol_airplay: "mdi-apple",
    protocol_dlna: "mdi-cast-variant",
    protocol_chromecast: "mdi-cast",
    protocol_slimproto: "mdi-speaker-wireless",
    protocol_snapcast: "mdi-speaker-multiple",
  };
  return iconMap[category] || "mdi-cog-outline";
};
</script>

<style scoped>
/* Category sections (non-collapsible) */
.category-section {
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.category-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primary);
}

.category-content {
  padding: 20px;
  background: var(--card);
}

/* Action buttons */
.config-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
}

/* Protocol disabled message */
.protocol-disabled-message {
  padding: 16px;
  text-align: center;
  color: var(--muted-foreground);
  font-style: italic;
}

/* Advanced settings toggle */
.advanced-toggle-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 0 16px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

/* Protocol section */
.protocol-section {
  margin-top: 16px;
  margin-bottom: 24px;
}

.protocol-section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  border-radius: 8px 8px 0 0;
  border: 1px solid var(--border);
  border-bottom: none;
}

.protocol-section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primary);
}

.protocol-general-settings {
  padding: 20px;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: var(--card);
}

.protocol-single-panel {
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  background: var(--card);
  padding: 20px;
}

.protocol-panels {
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  background: var(--card);
}

.protocol-panel {
  border-bottom: 1px solid var(--border);
}

.protocol-panel:last-child {
  border-bottom: none;
}

.config-panel-content {
  padding: 0 20px 20px;
}
</style>
