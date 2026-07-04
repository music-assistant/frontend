<template>
  <v-form v-if="entries" ref="form" v-model="valid" :disabled="disabled">
    <!-- Generic settings section -->
    <div
      v-for="panel of regularPanels.filter(
        (p) => p === 'generic' && entriesForCategory(p).length > 0,
      )"
      :key="panel"
      class="category-section"
    >
      <div class="category-header">
        <span class="category-icon">
          <component :is="getCategoryIcon(panel)" :size="16" />
        </span>
        <span class="category-title">
          {{ getCategoryTranslation(panel) }}
        </span>
      </div>
      <div class="category-content">
        <ConfigEntryRow
          v-for="conf_entry of entriesForCategory(panel)"
          :key="conf_entry.key"
          :conf-entry="conf_entry"
          :show-password-values="showPasswordValues"
          :disabled="isDisabled(conf_entry)"
          @update:value="onValueUpdate(conf_entry, $event)"
          @toggle-password="showPasswordValues = !showPasswordValues"
          @action="onEntryAction(conf_entry)"
          @open-dsp="openDspConfig"
          @open-options="openPlayerOptions"
          @help="onEntryHelp(conf_entry)"
        />
      </div>
    </div>

    <!-- Protocol Configuration Section -->
    <div
      v-if="protocolGeneralEntries.length > 0 || protocolPanels.length > 0"
      class="category-section"
    >
      <div class="category-header">
        <span class="category-icon">
          <Antenna :size="16" />
        </span>
        <span class="category-title">
          {{ $t("settings.category.protocol_settings") }}
        </span>
      </div>
      <div class="category-content">
        <!-- Explain the multi-protocol setup when more than one is available -->
        <div
          v-if="protocolPanels.length > 1"
          class="text-muted-foreground mb-4 rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed"
        >
          {{ $t("settings.protocol_multi_info") }}
        </div>
        <!-- General protocol settings, shown before the protocol list -->
        <ConfigEntryRow
          v-for="conf_entry of protocolGeneralEntries"
          :key="conf_entry.key"
          :conf-entry="conf_entry"
          :show-password-values="showPasswordValues"
          :disabled="isDisabled(conf_entry)"
          @update:value="onValueUpdate(conf_entry, $event)"
          @toggle-password="showPasswordValues = !showPasswordValues"
          @action="onEntryAction(conf_entry)"
          @open-dsp="openDspConfig"
          @open-options="openPlayerOptions"
          @help="onEntryHelp(conf_entry)"
        />

        <!-- Enable/disable toggles for the optional output protocols -->
        <template v-if="optionalProtocolPanels.length > 0">
          <p class="text-muted-foreground mt-4 mb-2 border-b pb-1 text-xs">
            {{ $t("settings.protocol_enable_label") }}
          </p>
          <div
            v-for="panel of optionalProtocolPanels"
            :key="'toggle-' + panel"
            class="flex items-center gap-3 py-2.5"
          >
            <ProviderIcon
              v-if="getProtocolDomain(panel)"
              :domain="getProtocolDomain(panel)!"
              :size="22"
              class="shrink-0"
            />
            <span class="min-w-0 flex-1 text-sm">
              {{ getCategoryTranslation(panel) }}
            </span>
            <Switch
              :model-value="!!getProtocolEnabledEntry(panel)?.value"
              :disabled="!isProtocolProviderAvailable(panel)"
              class="shrink-0"
              @update:model-value="
                onValueUpdate(getProtocolEnabledEntry(panel)!, $event)
              "
            />
          </div>
        </template>

        <!-- Per-protocol configuration: native (always on) + enabled optional -->
        <template v-if="configurableProtocolPanels.length > 0">
          <p class="text-muted-foreground mt-4 mb-2 border-b pb-1 text-xs">
            {{ $t("settings.protocol_configure_label") }}
          </p>
          <Accordion
            type="multiple"
            :model-value="openConfigPanels"
            @update:model-value="openConfigPanels = $event as string[]"
          >
            <AccordionItem
              v-for="panel of configurableProtocolPanels"
              :key="panel"
              :value="panel"
              class="border-b-0"
            >
              <AccordionTrigger class="hover:no-underline">
                <span class="flex items-center gap-2">
                  <ProviderIcon
                    v-if="getProtocolDomain(panel)"
                    :domain="getProtocolDomain(panel)!"
                    :size="22"
                  />
                  <span>{{
                    $t("settings.protocol_configure_title", {
                      name: getProtocolName(panel),
                    })
                  }}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent class="pt-3">
                <div
                  v-if="entriesForCategory(panel).length === 0"
                  class="protocol-empty-message"
                >
                  {{ getProtocolEmptyMessage(panel) }}
                </div>
                <ConfigEntryRow
                  v-for="conf_entry of entriesForCategory(panel)"
                  :key="conf_entry.key"
                  :conf-entry="conf_entry"
                  :show-password-values="showPasswordValues"
                  :disabled="isDisabled(conf_entry)"
                  @update:value="onValueUpdate(conf_entry, $event)"
                  @toggle-password="showPasswordValues = !showPasswordValues"
                  @action="onEntryAction(conf_entry)"
                  @open-dsp="openDspConfig"
                  @open-options="openPlayerOptions"
                  @help="onEntryHelp(conf_entry)"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </template>
      </div>
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
        <span class="category-icon">
          <component :is="getCategoryIcon(panel)" :size="16" />
        </span>
        <span class="category-title">
          {{ getCategoryTranslation(panel) }}
        </span>
      </div>
      <div class="category-content">
        <ConfigEntryRow
          v-for="conf_entry of entriesForCategory(panel)"
          :key="conf_entry.key"
          :conf-entry="conf_entry"
          :show-password-values="showPasswordValues"
          :disabled="isDisabled(conf_entry)"
          @update:value="onValueUpdate(conf_entry, $event)"
          @toggle-password="showPasswordValues = !showPasswordValues"
          @action="onEntryAction(conf_entry)"
          @open-dsp="openDspConfig"
          @open-options="openPlayerOptions"
          @help="onEntryHelp(conf_entry)"
        />
      </div>
    </div>

    <div v-if="!disabled" class="config-actions">
      <!-- Show advanced settings toggle -->
      <div class="advanced-toggle-wrapper">
        <v-switch
          v-model="showAdvancedSettings"
          color="primary"
          hide-details
          density="comfortable"
          :label="$t('settings.show_advanced_settings')"
          class="advanced-settings-switch"
        />
      </div>
      <v-btn
        block
        color="primary"
        size="large"
        :disabled="!requiredValuesPresent || !hasUnsavedChanges"
        @click="submit"
      >
        {{ $t("settings.save") }}
      </v-btn>
      <v-btn block variant="outlined" size="large" @click="handleClose">
        {{ $t("close") }}
      </v-btn>
      <v-btn block variant="text" size="large" @click="resetToDefaults">
        {{ $t("settings.reset_to_defaults") }}
      </v-btn>
    </div>
  </v-form>
  <v-dialog
    :model-value="showHelpInfo !== undefined"
    width="auto"
    @update:model-value="showHelpInfo = undefined"
  >
    <v-card>
      <v-card-text>
        <h2>
          {{ showHelpInfo?.label || "" }}
        </h2>
      </v-card-text>
      <!-- eslint-disable vue/no-v-html -->
      <!-- eslint-disable vue/no-v-text-v-html-on-component -->
      <v-card-text v-html="markdownToHtml(showHelpInfo?.description || '')" />
      <!-- eslint-enable vue/no-v-html -->
      <!-- eslint-enable vue/no-v-text-v-html-on-component -->
      <v-card-actions>
        <v-btn
          v-if="showHelpInfo?.help_link"
          @click="openLink(showHelpInfo!.help_link!)"
        >
          {{ $t("read_more") }}
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="showHelpInfo = undefined">
          {{ $t("close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <!-- Unsaved changes confirmation dialog -->
  <v-dialog v-model="showUnsavedDialog" max-width="400" persistent>
    <v-card>
      <v-card-title>{{ $t("settings.unsaved_changes") }}</v-card-title>
      <v-card-text>{{ $t("settings.unsaved_changes_message") }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancelDiscard">
          {{ $t("settings.stay") }}
        </v-btn>
        <v-btn color="warning" variant="flat" @click="confirmDiscard">
          {{ $t("settings.discard") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { ConfigEntryUI, isInjected } from "@/helpers/config_entry_ui";
import { markdownToHtml } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  Airplay,
  Antenna,
  Cast,
  Lock,
  Megaphone,
  MonitorPlay,
  Network,
  PlayCircle,
  RadioTower,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Speaker,
  Volume2,
} from "@lucide/vue";
import { type Component, computed, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import ConfigEntryRow from "./ConfigEntryRow.vue";

const router = useRouter();
const showUnsavedDialog = ref(false);
const allowNavigation = ref(false);

export interface Props {
  configEntries: ConfigEntryUI[];
  disabled: boolean;
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
const form = ref<InstanceType<typeof import("vuetify/components").VForm>>();
const activePanel = ref<string[]>([]);
const openConfigPanels = ref<string[]>([]);
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
      .filter(
        (x) =>
          ![
            "preferences",
            "display_settings",
            "generic",
            "advanced",
            "protocol_general",
          ].includes(x),
      ),
  );
  // ensure preferences, display_settings, and generic are always first
  // advanced category is deprecated - advanced settings are now distributed across categories
  // protocol_general is handled separately in the protocol section
  return ["preferences", "display_settings", "generic", ...allCategories];
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

// Optional protocols (those with an enable/disable entry) go in the collapsible
// accordion. The native protocol has no separate toggleable provider, so its
// settings live directly in the main form alongside the general protocol entries.
const optionalProtocolPanels = computed(() =>
  protocolPanels.value.filter((p) => getProtocolEnabledEntry(p)),
);

const nativeProtocolPanels = computed(() =>
  protocolPanels.value.filter((p) => !getProtocolEnabledEntry(p)),
);

// Only enabled optional protocols get a configuration section.
const enabledOptionalProtocolPanels = computed(() =>
  optionalProtocolPanels.value.filter(
    (p) => getProtocolEnabledEntry(p)?.value !== false,
  ),
);

// The native protocol (always on) plus any enabled optional protocols each get a
// "Configure" section.
const configurableProtocolPanels = computed(() => [
  ...nativeProtocolPanels.value,
  ...enabledOptionalProtocolPanels.value,
]);

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

// A protocol's backing provider can be disabled/unavailable independently. Only
// optional protocols (those with an enabled entry) are served by a separate,
// toggleable provider; native protocols have no separate provider.
const isProtocolProviderAvailable = function (category: string): boolean {
  const domain = getProtocolDomain(category);
  if (!domain) return true;
  const provider = api.getProvider(domain);
  // Only treat as unavailable when we resolve a provider that reports unavailable.
  return provider ? provider.available : true;
};

// Display name for a protocol — the provider's own name, falling back to the
// category label with the "Enable … support" scaffolding stripped.
const getProtocolName = function (category: string): string {
  const domain = getProtocolDomain(category);
  const provider = domain ? api.getProvider(domain) : undefined;
  if (provider?.name) return provider.name;
  return getCategoryTranslation(category)
    .replace(/^Enable\s+/i, "")
    .replace(/\s+support$/i, "");
};

const getProtocolEmptyMessage = function (category: string): string {
  const enabledEntry = getProtocolEnabledEntry(category);

  // Optional protocol whose backing provider is unavailable
  if (enabledEntry && !isProtocolProviderAvailable(category)) {
    return $t("settings.protocol_provider_unavailable");
  }

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
    // Protocol config sections stay collapsed by default; the user opens the one
    // they want to configure.
  },
  { immediate: true },
);

// methods
const validate = async function () {
  const { valid } = await form.value!.validate();
  return valid;
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

const onEntryAction = function (entry: ConfigEntryUI) {
  action(entry.action || entry.key, !!entry.immediate_apply);
  entry.value = entry.action ? null : entry.key;
};

const onEntryHelp = function (entry: ConfigEntryUI) {
  if (entry.description) showHelpInfo.value = entry;
  else openLink(entry.help_link!);
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
  // The display name comes from `category_label`: resolved server-side for server entries, and
  // set at construction for frontend-only entries. Read it from any entry in this category.
  const entriesInCategory = entriesForCategory(category);
  let entryWithTranslation: ConfigEntryUI | undefined = entriesInCategory[0];
  if (!entryWithTranslation && isProtocolCategory(category) && entries.value) {
    entryWithTranslation = entries.value.find((e) => e.category === category);
  }
  return entryWithTranslation?.category_label || category;
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
const getCategoryIcon = function (category: string): Component {
  const iconMap: Record<string, Component> = {
    generic: Settings2,
    audio: Volume2,
    advanced: SlidersHorizontal,
    network: Network,
    playback: PlayCircle,
    announcements: Megaphone,
    airplay: Airplay,
    chromecast: Cast,
    slimproto: RadioTower,
    snapcast: Speaker,
    ugp: Speaker,
    authentication: Lock,
    sync: RefreshCw,
    web_player: MonitorPlay,
    player_controls: SlidersHorizontal,
    // Protocol-specific categories
    protocol_sonos: Speaker,
    protocol_airplay: Airplay,
    protocol_dlna: Cast,
    protocol_chromecast: Cast,
    protocol_slimproto: RadioTower,
    protocol_snapcast: Speaker,
  };
  return iconMap[category] || Settings2;
};
</script>

<style scoped>
/* Category sections (modern card, header aligned with fields) */
.category-section {
  margin-bottom: 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.category-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.category-content {
  padding: 14px 16px;
}

/* Action buttons */
.config-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
}

.config-actions .v-btn--disabled {
  background-color: rgba(var(--v-theme-on-surface), 0.12) !important;
  color: rgba(var(--v-theme-on-surface), 0.38) !important;
}

/* Advanced settings toggle */
.advanced-toggle-wrapper {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.advanced-settings-switch {
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.advanced-settings-switch:hover {
  opacity: 1;
}

.protocol-empty-message {
  padding: 2px 0 6px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-style: italic;
  font-size: 0.875rem;
}
</style>
