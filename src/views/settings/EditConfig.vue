<template>
  <form v-if="entries" ref="form" :class="{ 'pointer-events-none opacity-50': disabled }">
    <!-- Generic settings section -->
    <div
      v-for="panel of regularPanels.filter(
        (p) => p === 'generic' && entriesForCategory(p).length > 0,
      )"
      :key="panel"
      class="category-section"
    >
      <div class="category-header">
        <Icon :icon="getCategoryIcon(panel)" :size="20" class="mr-3 text-primary" />
        <span class="category-title">
          {{ getCategoryTranslation(panel) }}
        </span>
      </div>
      <div class="category-content">
        <div
          v-for="conf_entry of entriesForCategory(panel)"
          :key="conf_entry.key"
          class="config-entry"
          :class="{ 'config-entry-advanced': conf_entry.advanced }"
        >
          <ConfigEntryField
            :conf-entry="conf_entry"
            :show-password-values="showPasswordValues"
            :disabled="isDisabled(conf_entry)"
            @toggle-password="showPasswordValues = !showPasswordValues"
            @update:value="onValueUpdate(conf_entry, $event)"
            @action="
              action(
                conf_entry.action || conf_entry.key,
                !!conf_entry.immediate_apply,
              );
              conf_entry.value = conf_entry.action ? null : conf_entry.key;
            "
            @open-dsp="openDspConfig"
            @open-options="openPlayerOptions"
          />
          <Badge
            v-if="conf_entry.advanced"
            variant="outline"
            class="advanced-badge"
          >
            {{ $t("settings.advanced") }}
          </Badge>
          <Button
            v-if="hasDescriptionOrHelpLink(conf_entry)"
            type="button"
            variant="ghost"
            size="icon"
            class="help-btn"
            @click="
              $t(
                `settings.${conf_entry?.key}.description`,
                conf_entry.description || '',
              )
                ? (showHelpInfo = conf_entry)
                : openLink(conf_entry.help_link!)
            "
          >
            <HelpCircle :size="20" />
          </Button>
        </div>
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
        <Icon icon="mdi-swap-horizontal" :size="24" class="mr-3 text-primary" />
        <span class="protocol-section-title">
          {{ $t("settings.category.protocol_settings") }}
        </span>
      </div>
      <!-- General protocol settings (shown before accordion) -->
      <div
        v-if="protocolGeneralEntries.length > 0"
        class="protocol-general-settings"
      >
        <div
          v-for="conf_entry of protocolGeneralEntries"
          :key="conf_entry.key"
          class="config-entry"
          :class="{ 'config-entry-advanced': conf_entry.advanced }"
        >
          <ConfigEntryField
            :conf-entry="conf_entry"
            :show-password-values="showPasswordValues"
            :disabled="isDisabled(conf_entry)"
            @toggle-password="showPasswordValues = !showPasswordValues"
            @update:value="onValueUpdate(conf_entry, $event)"
            @action="
              action(
                conf_entry.action || conf_entry.key,
                !!conf_entry.immediate_apply,
              );
              conf_entry.value = conf_entry.action ? null : conf_entry.key;
            "
            @open-dsp="openDspConfig"
            @open-options="openPlayerOptions"
          />
          <Badge
            v-if="conf_entry.advanced"
            variant="outline"
            class="advanced-badge"
          >
            {{ $t("settings.advanced") }}
          </Badge>
          <Button
            v-if="hasDescriptionOrHelpLink(conf_entry)"
            type="button"
            variant="ghost"
            size="icon"
            class="help-btn"
            @click="
              $t(
                `settings.${conf_entry?.key}.description`,
                conf_entry.description || '',
              )
                ? (showHelpInfo = conf_entry)
                : openLink(conf_entry.help_link!)
            "
          >
            <HelpCircle :size="20" />
          </Button>
        </div>
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
          <div
            v-for="conf_entry of entriesForCategory(panel)"
            :key="conf_entry.key"
            class="config-entry"
            :class="{ 'config-entry-advanced': conf_entry.advanced }"
          >
            <ConfigEntryField
              :conf-entry="conf_entry"
              :show-password-values="showPasswordValues"
              :disabled="isDisabled(conf_entry)"
              @toggle-password="showPasswordValues = !showPasswordValues"
              @update:value="onValueUpdate(conf_entry, $event)"
              @action="
                action(
                  conf_entry.action || conf_entry.key,
                  !!conf_entry.immediate_apply,
                );
                conf_entry.value = conf_entry.action ? null : conf_entry.key;
              "
              @open-dsp="openDspConfig"
              @open-options="openPlayerOptions"
            />
            <Badge
              v-if="conf_entry.advanced"
              variant="outline"
              class="advanced-badge"
            >
              {{ $t("settings.advanced") }}
            </Badge>
            <Button
              v-if="hasDescriptionOrHelpLink(conf_entry)"
              type="button"
              variant="ghost"
              size="icon"
              class="help-btn"
              @click="
                $t(
                  `settings.${conf_entry?.key}.description`,
                  conf_entry.description || '',
                )
                  ? (showHelpInfo = conf_entry)
                  : openLink(conf_entry.help_link!)
              "
            >
              <HelpCircle :size="20" />
            </Button>
          </div>
        </div>
      </div>
      <!-- Multiple protocols: show as accordion -->
      <Accordion
        v-else
        type="single"
        collapsible
        :model-value="activeProtocolPanel"
        class="protocol-panels"
        @update:model-value="activeProtocolPanel = $event as string | undefined"
      >
        <AccordionItem
          v-for="panel of protocolPanels.filter(
            (p) => entriesForCategory(p).length > 0 || isProtocolCategory(p),
          )"
          :key="panel"
          :value="panel"
          class="protocol-panel"
        >
          <AccordionTrigger class="protocol-panel-title">
            <div class="protocol-title-content">
              <ProviderIcon
                v-if="getProtocolDomain(panel)"
                :domain="getProtocolDomain(panel)!"
                :size="24"
              />
              <span class="panel-title-text">
                {{ getCategoryTranslation(panel) }}
              </span>
            </div>
            <div class="protocol-actions" @click.stop>
              <Switch
                v-if="getProtocolEnabledEntry(panel)"
                :checked="getProtocolEnabledEntry(panel)?.value as boolean"
                @update:checked="
                  onValueUpdate(getProtocolEnabledEntry(panel)!, $event)
                "
              />
              <Switch
                v-else
                :checked="true"
                disabled
              />
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div class="config-panel-content">
              <div
                v-if="entriesForCategory(panel).length === 0"
                class="protocol-disabled-message"
              >
                {{ getProtocolEmptyMessage(panel) }}
              </div>
              <div
                v-for="conf_entry of entriesForCategory(panel)"
                :key="conf_entry.key"
                class="config-entry"
                :class="{ 'config-entry-advanced': conf_entry.advanced }"
              >
                <ConfigEntryField
                  :conf-entry="conf_entry"
                  :show-password-values="showPasswordValues"
                  :disabled="isDisabled(conf_entry)"
                  @toggle-password="showPasswordValues = !showPasswordValues"
                  @update:value="onValueUpdate(conf_entry, $event)"
                  @action="
                    action(
                      conf_entry.action || conf_entry.key,
                      !!conf_entry.immediate_apply,
                    );
                    conf_entry.value = conf_entry.action
                      ? null
                      : conf_entry.key;
                  "
                  @open-dsp="openDspConfig"
                  @open-options="openPlayerOptions"
                />
                <Badge
                  v-if="conf_entry.advanced"
                  variant="outline"
                  class="advanced-badge"
                >
                  {{ $t("settings.advanced") }}
                </Badge>
                <Button
                  v-if="hasDescriptionOrHelpLink(conf_entry)"
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="help-btn"
                  @click="
                    $t(
                      `settings.${conf_entry?.key}.description`,
                      conf_entry.description || '',
                    )
                      ? (showHelpInfo = conf_entry)
                      : openLink(conf_entry.help_link!)
                  "
                >
                  <HelpCircle :size="20" />
                </Button>
              </div>
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
        <Icon :icon="getCategoryIcon(panel)" :size="20" class="mr-3 text-primary" />
        <span class="category-title">
          {{ getCategoryTranslation(panel) }}
        </span>
      </div>
      <div class="category-content">
        <div
          v-for="conf_entry of entriesForCategory(panel)"
          :key="conf_entry.key"
          class="config-entry"
          :class="{ 'config-entry-advanced': conf_entry.advanced }"
        >
          <ConfigEntryField
            :conf-entry="conf_entry"
            :show-password-values="showPasswordValues"
            :disabled="isDisabled(conf_entry)"
            @toggle-password="showPasswordValues = !showPasswordValues"
            @update:value="onValueUpdate(conf_entry, $event)"
            @action="
              action(
                conf_entry.action || conf_entry.key,
                !!conf_entry.immediate_apply,
              );
              conf_entry.value = conf_entry.action ? null : conf_entry.key;
            "
            @open-dsp="openDspConfig"
            @open-options="openPlayerOptions"
          />
          <Badge
            v-if="conf_entry.advanced"
            variant="outline"
            class="advanced-badge"
          >
            {{ $t("settings.advanced") }}
          </Badge>
          <Button
            v-if="hasDescriptionOrHelpLink(conf_entry)"
            type="button"
            variant="ghost"
            size="icon"
            class="help-btn"
            @click="
              $t(
                `settings.${conf_entry?.key}.description`,
                conf_entry.description || '',
              )
                ? (showHelpInfo = conf_entry)
                : openLink(conf_entry.help_link!)
            "
          >
            <HelpCircle :size="20" />
          </Button>
        </div>
      </div>
    </div>

    <div v-if="!disabled" class="config-actions">
      <!-- Show advanced settings toggle -->
      <div class="advanced-toggle-wrapper">
        <div class="flex items-center gap-3">
          <Switch
            :checked="showAdvancedSettings"
            @update:checked="showAdvancedSettings = $event"
          />
          <Label>{{ $t('settings.show_advanced_settings') }}</Label>
        </div>
      </div>
      <Button
        class="w-full"
        size="lg"
        :disabled="!requiredValuesPresent || !hasUnsavedChanges"
        @click="submit"
      >
        {{ $t("settings.save") }}
      </Button>
      <Button class="w-full" variant="outline" size="lg" @click="handleClose">
        {{ $t("close") }}
      </Button>
      <Button class="w-full" variant="ghost" size="lg" @click="resetToDefaults">
        {{ $t("settings.reset_to_defaults") }}
      </Button>
    </div>
  </form>
  <Dialog
    :open="showHelpInfo !== undefined"
    @update:open="(val) => { if (!val) showHelpInfo = undefined }"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {{
            $t(`settings.${showHelpInfo?.key}.label`, showHelpInfo?.label || "")
          }}
        </DialogTitle>
      </DialogHeader>
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-html="
          markdownToHtml(
            $t(
              `settings.${showHelpInfo?.key}.description`,
              showHelpInfo?.description || '',
            ),
          )
        "
      />
      <!-- eslint-enable vue/no-v-html -->
      <DialogFooter>
        <Button
          v-if="showHelpInfo?.help_link"
          variant="outline"
          @click="openLink(showHelpInfo!.help_link!)"
        >
          {{ $t("read_more") }}
        </Button>
        <Button @click="showHelpInfo = undefined">
          {{ $t("close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <!-- Unsaved changes confirmation dialog -->
  <Dialog :open="showUnsavedDialog" @update:open="(val) => { if (!val) cancelDiscard() }">
    <DialogContent class="max-w-[400px]">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.unsaved_changes") }}</DialogTitle>
        <DialogDescription>{{ $t("settings.unsaved_changes_message") }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="cancelDiscard">
          {{ $t("settings.stay") }}
        </Button>
        <Button variant="destructive" @click="confirmDiscard">
          {{ $t("settings.discard") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfigEntryUI, isInjected } from "@/helpers/config_entry_ui";
import { markdownToHtml } from "@/helpers/utils";
import {
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { HelpCircle } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import ConfigEntryField from "./ConfigEntryField.vue";

const router = useRouter();
const showUnsavedDialog = ref(false);
const allowNavigation = ref(false);

export interface Props {
  configEntries: ConfigEntryUI[];
  disabled: boolean;
  defaultExpandedProtocol?: string;
}

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

// global refs
const entries = ref<ConfigEntryUI[]>();
const valid = ref(false);
const form = ref<HTMLFormElement>();
const activePanel = ref<string[]>([]);
const activeProtocolPanel = ref<string | undefined>(undefined);
const showPasswordValues = ref(false);
const showAdvancedSettings = ref(false);
const showHelpInfo = ref<ConfigEntryUI>();
const oldValues = ref<Record<string, ConfigValueType>>({});
const oldValuesInitialized = ref(false);

// props
const props = defineProps<Props>();

// computed props
const panels = computed(() => {
  // determine all unique categories from the config entries
  const allCategories = new Set(
    entries
      .value!.map((x) => x.category)
      .filter((x) => !["generic", "advanced", "protocol_general"].includes(x)),
  );
  // ensure generic is always first
  // advanced category is deprecated - advanced settings are now distributed across categories
  // protocol_general is handled separately in the protocol section
  return ["generic", ...allCategories];
});

const regularPanels = computed(() => {
  return panels.value.filter((p) => !isProtocolRelated(p));
});

const protocolPanels = computed(() => {
  return panels.value.filter((p) => isProtocolCategory(p));
});

const protocolGeneralEntries = computed(() => {
  return entriesForCategory("protocol_general");
});

const requiredValuesPresent = computed(() => {
  if (entries.value) {
    for (const entry of entries.value) {
      if (
        entry.required &&
        !(
          !isNullOrUndefined(entry.value) ||
          !isNullOrUndefined(entry.default_value) ||
          entry.type == ConfigEntryType.DIVIDER ||
          entry.type == ConfigEntryType.LABEL ||
          entry.type == ConfigEntryType.ALERT ||
          entry.type == ConfigEntryType.ACTION
        )
      )
        return false;
    }
    return true;
  }
  return false;
});

const hasUnsavedChanges = computed(() => {
  if (!entries.value) return false;
  for (const entry of entries.value) {
    // Skip non-value entry types
    if (
      entry.type == ConfigEntryType.DIVIDER ||
      entry.type == ConfigEntryType.LABEL ||
      entry.type == ConfigEntryType.ALERT ||
      entry.type == ConfigEntryType.ACTION ||
      isInjected(entry)
    ) {
      continue;
    }
    // Skip secure strings that haven't been modified (still showing substitute)
    if (
      entry.type == ConfigEntryType.SECURE_STRING &&
      entry.value == SECURE_STRING_SUBSTITUTE
    ) {
      continue;
    }
    const oldValue = oldValues.value[entry.key];
    const currentValue = entry.value;
    // Compare values (handle arrays and objects)
    if (JSON.stringify(oldValue) !== JSON.stringify(currentValue)) {
      return true;
    }
  }
  return false;
});

// Helper functions for protocol categories
const isProtocolCategory = function (category: string): boolean {
  return category.startsWith("protocol_");
};

const isProtocolRelated = function (category: string): boolean {
  return category === "protocol_general" || isProtocolCategory(category);
};

const getProtocolDomain = function (category: string): string | undefined {
  if (!isProtocolCategory(category)) return undefined;
  // Extract domain from "protocol_{domain}" format
  return category.replace("protocol_", "");
};

const getProtocolEnabledEntry = function (
  category: string,
): ConfigEntryUI | undefined {
  if (!isProtocolCategory(category) || !entries.value) return undefined;

  // Look for an entry in this category with a key ending in "||protocol||enabled"
  return entries.value.find(
    (entry) =>
      entry.category === category && entry.key.endsWith("||protocol||enabled"),
  );
};

const hasHiddenAdvancedSettings = function (category: string): boolean {
  if (!entries.value) return false;
  // Check if there are any advanced settings in this category that are currently hidden
  return entries.value.some(
    (entry) =>
      entry.category === category &&
      entry.advanced &&
      !entry.key.includes("||protocol||enabled") &&
      isVisible(entry),
  );
};

const getProtocolEmptyMessage = function (category: string): string {
  const enabledEntry = getProtocolEnabledEntry(category);
  const isEnabled = enabledEntry?.value !== false;

  if (!isEnabled) {
    return $t("settings.protocol_disabled_message");
  }

  // Protocol is enabled but no settings visible
  if (hasHiddenAdvancedSettings(category)) {
    return $t("settings.protocol_no_settings_with_advanced");
  }

  return $t("settings.protocol_no_settings");
};

// watchers
watch(
  () => props.configEntries,
  (val) => {
    entries.value = [];
    // Only capture oldValues on the FIRST load, not on subsequent updates from actions.
    // This ensures that action-triggered changes (like OAuth tokens being set) are
    // still detected as unsaved changes that need to be saved.
    const shouldCaptureOldValues = !oldValuesInitialized.value;
    if (shouldCaptureOldValues) {
      oldValues.value = {};
    }
    for (const entry of val || []) {
      // handle missing values (undefined or null)
      if (entry.value == undefined || entry.value == null)
        entry.value = entry.default_value;
      // Store the initial value AFTER applying defaults (deep clone for arrays/objects)
      // Also update oldValues for immediate_apply entries on subsequent updates,
      // since their values are already saved to the backend.
      if (shouldCaptureOldValues || entry.immediate_apply) {
        oldValues.value[entry.key] =
          typeof entry.value === "object" && entry.value !== null
            ? JSON.parse(JSON.stringify(entry.value))
            : entry.value;
      }
      entries.value.push(entry);
    }
    oldValuesInitialized.value = true;
    // Set active panels after entries are populated
    // Expand all panels by default, except protocol categories which stay collapsed
    const expandedPanels = panels.value.filter((p) => !isProtocolCategory(p));
    activePanel.value = expandedPanels;
    // Auto-expand the native protocol panel if specified
    if (
      props.defaultExpandedProtocol &&
      protocolPanels.value.includes(props.defaultExpandedProtocol)
    ) {
      activeProtocolPanel.value = props.defaultExpandedProtocol;
    }
  },
  { immediate: true },
);

// methods
const validate = async function () {
  // With native form, check validity
  if (form.value) {
    return form.value.checkValidity();
  }
  return true;
};
const submit = async function () {
  // submit button is pressed
  if (await validate()) {
    allowNavigation.value = true;
    emit("submit", getCurrentValues());
  }
};
const action = async function (action: string, immediateApply: boolean) {
  // call config entries action
  emit("action", action, getCurrentValues(), immediateApply);
};

const onValueUpdate = function (entry: ConfigEntryUI, value: ConfigValueType) {
  entry.value = value;
  // If immediate_apply is set, emit the value change immediately
  // and update oldValues so the form doesn't show as "unsaved"
  if (entry.immediate_apply) {
    emit("immediateApply", { [entry.key]: value });
    oldValues.value[entry.key] =
      typeof value === "object" && value !== null
        ? JSON.parse(JSON.stringify(value))
        : value;
  }
};
const openLink = function (url: string) {
  // window.open(url, "_blank");
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.click();
};

const openDspConfig = function () {
  router.push(`${router.currentRoute.value.path}/dsp`);
};

const openPlayerOptions = function () {
  router.push(`${router.currentRoute.value.path}/options`);
};

const resetToDefaults = function () {
  if (!entries.value) return;
  for (const entry of entries.value) {
    entry.value = entry.default_value;
  }
};

const handleClose = function () {
  if (hasUnsavedChanges.value) {
    showUnsavedDialog.value = true;
  } else {
    router.back();
  }
};

const confirmDiscard = function () {
  showUnsavedDialog.value = false;
  allowNavigation.value = true;
  // Navigate back after setting the flag
  router.back();
};

const cancelDiscard = function () {
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

// Handle browser back/refresh
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = "";
  }
};

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});

// Add listener when component mounts
window.addEventListener("beforeunload", handleBeforeUnload);
const isNullOrUndefined = function (value: unknown) {
  return value === null || value === undefined;
};

const isVisible = function (entry: ConfigEntryUI) {
  return !entry.hidden;
};

const isDisabled = function (entry: ConfigEntryUI) {
  if (!isNullOrUndefined(entry.depends_on)) {
    const dependentEntry = entries.value?.find(
      (x) => x.key == entry.depends_on,
    );
    if (!dependentEntry) return false;

    const dependentValue = dependentEntry.value;

    if (!isNullOrUndefined(entry.depends_on_value)) {
      return dependentValue != entry.depends_on_value;
    }

    if (!isNullOrUndefined(entry.depends_on_value_not)) {
      return dependentValue == entry.depends_on_value_not;
    }

    return !dependentValue;
  }
  return false;
};

const visibleEntriesByCategory = computed(() => {
  const result: Record<string, ConfigEntryUI[]> = {};
  if (!entries.value) return result;

  for (const entry of entries.value) {
    if (!isVisible(entry)) continue;
    // Always skip 'enabled' and 'name' entries - they're either handled via dedicated props
    // or shouldn't be shown (e.g., when adding a new provider)
    if (entry.key === "enabled" || entry.key === "name") continue;
    // Skip protocol-specific enabled entries (they're shown in the header)
    if (entry.key.includes("||protocol||enabled")) continue;
    // Skip advanced entries if advanced settings are not shown
    if (entry.advanced && !showAdvancedSettings.value) continue;
    const category = entry.category || "generic";
    if (!result[category]) {
      result[category] = [];
    }
    result[category].push(entry);
  }
  return result;
});

const entriesForCategory = function (category: string) {
  return visibleEntriesByCategory.value[category] || [];
};

const getCategoryTranslation = function (category: string) {
  // Find the first entry in this category that has a category_translation_key
  // prefer translation_key over key (using key for translations is deprecated)
  const entriesInCategory = entriesForCategory(category);

  // For protocol categories with no visible entries, check all entries (including enabled entry)
  let entryWithTranslation: ConfigEntryUI | undefined = entriesInCategory[0];
  if (!entryWithTranslation && isProtocolCategory(category) && entries.value) {
    entryWithTranslation = entries.value.find((e) => e.category === category);
  }

  if (entryWithTranslation?.category_translation_key) {
    const translationKey = entryWithTranslation.category_translation_key;
    // If category_translation_params are provided, pass them directly
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
  // Fallback to the old/deprecated pattern of using the category directly
  return $t(`settings.category.${category}`, category);
};

const getCurrentValues = function () {
  const values: Record<string, ConfigValueType> = {};
  // Iterate over props.configEntries to include all entries
  // Note: entries.value contains the same object references as props.configEntries
  // (pushed in the watch), so user modifications via the form update both
  for (const entry of props.configEntries!) {
    if (isInjected(entry)) continue;
    let value = entry.value;
    // filter out undefined values
    if (value == undefined) value = null;
    // filter out obfuscated strings (only skip if it's the substitute placeholder)
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
const getCategoryIcon = function (category: string): string {
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
    // Protocol-specific categories
    protocol_sonos: "mdi-speaker",
    protocol_airplay: "mdi-apple",
    protocol_dlna: "mdi-cast-variant",
    protocol_chromecast: "mdi-cast",
    protocol_slimproto: "mdi-speaker-wireless",
    protocol_snapcast: "mdi-speaker-multiple",
  };
  return iconMap[category] || "mdi-cog-outline";
};

const hasDescriptionOrHelpLink = function (conf_entry: ConfigEntryUI) {
  // overly complicated way to determine we have a description for the entry
  // in either the translations (by entry key), on the entry itself as fallback
  // OR it has a help link
  return (
    (
      $t(
        `settings.${conf_entry?.key}.description`,
        conf_entry.description || " ",
      ) ||
      conf_entry.help_link ||
      " "
    )?.length > 1
  );
};
</script>

<style scoped>
/* Category sections (non-collapsible) */
.category-section {
  margin-bottom: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: hsl(var(--primary) / 0.08);
}

.category-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: hsl(var(--primary));
}

.category-content {
  padding: 20px;
  background: hsl(var(--card));
}

/* Config entry row */
.config-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.config-entry:last-child {
  margin-bottom: 0;
}

/* Help button */
.help-btn {
  flex-shrink: 0;
  margin-top: 8px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  height: 36px;
}

.help-btn:hover {
  opacity: 1;
}

/* Action buttons */
.config-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
}

/* Protocol panel actions (toggle + chevron) */
.protocol-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Protocol toggle switch styling */
.protocol-toggle {
  flex-shrink: 0;
}

/* Protocol disabled message */
.protocol-disabled-message {
  padding: 16px;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}

/* Advanced settings toggle */
.advanced-toggle-wrapper {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid hsl(var(--border));
}

/* Advanced badge */
.advanced-badge {
  margin-left: 8px;
  margin-top: 8px;
  flex-shrink: 0;
  height: 20px;
}

/* Advanced entry styling */
.config-entry-advanced {
  opacity: 0.9;
}

/* Protocol section */
.protocol-section {
  margin-top: 16px;
  margin-bottom: 24px;
}

.protocol-section-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: hsl(var(--primary) / 0.08);
  border-radius: 8px 8px 0 0;
  border: 1px solid hsl(var(--border));
  border-bottom: none;
}

/* Protocol general settings (before accordion) */
.protocol-general-settings {
  padding: 20px;
  border-left: 1px solid hsl(var(--border));
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.protocol-section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: hsl(var(--primary));
}

/* Single protocol (non-collapsible) */
.protocol-single-panel {
  border-left: 1px solid hsl(var(--border));
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  border-radius: 0 0 8px 8px;
  background: hsl(var(--card));
  padding: 20px;
}

.protocol-panels {
  border-left: 1px solid hsl(var(--border));
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  border-radius: 0 0 8px 8px;
}

.protocol-panel {
  border: none !important;
  background: hsl(var(--card));
  box-shadow: none !important;
}

.protocol-panel-title {
  min-height: 56px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
}

.protocol-title-content {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 4px;
}

.panel-title-text {
  font-size: 1rem;
  font-weight: 400;
  color: hsl(var(--foreground) / 0.87);
  line-height: 1.5;
}

.config-panel-content {
  padding: 16px 20px 20px;
  border-top: 1px solid hsl(var(--border));
}
</style>
