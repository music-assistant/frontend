<template>
  <v-form v-if="entries" ref="form" v-model="valid" :disabled="disabled">
    <!-- Category entries - use expansion panels -->
    <v-expansion-panels v-model="activePanel" multiple class="config-panels">
      <v-expansion-panel
        v-for="panel of panels.filter((p) => entriesForCategory(p).length > 0)"
        :key="panel"
        :value="panel"
        class="config-panel"
      >
        <v-expansion-panel-title class="config-panel-title">
          <v-icon :icon="getCategoryIcon(panel)" class="mr-3" size="20" />
          <span class="panel-title-text">
            {{ $t("settings.category." + panel, panel) }}
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="config-panel-content">
            <div
              v-for="conf_entry of entriesForCategory(panel)"
              :key="conf_entry.key"
              class="config-entry"
            >
              <ConfigEntryField
                :conf-entry="conf_entry"
                :show-password-values="showPasswordValues"
                :disabled="isDisabled(conf_entry)"
                @toggle-password="showPasswordValues = !showPasswordValues"
                @update:value="onValueUpdate(conf_entry, $event)"
                @action="
                  action(conf_entry.action || conf_entry.key);
                  conf_entry.value = conf_entry.action ? null : conf_entry.key;
                "
                @open-dsp="openDspConfig"
              />
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
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <div class="config-actions">
      <v-btn
        block
        color="primary"
        size="large"
        :disabled="!requiredValuesPresent"
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
          {{
            $t(`settings.${showHelpInfo?.key}.label`, showHelpInfo?.label || "")
          }}
        </h2>
      </v-card-text>
      <!-- eslint-disable vue/no-v-html -->
      <!-- eslint-disable vue/no-v-text-v-html-on-component -->
      <v-card-text
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
import { Button } from "@/components/ui/button";
import { markdownToHtml } from "@/helpers/utils";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { HelpCircle } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, VNodeRef, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { ConfigEntryUI, isInjected } from "@/helpers/config_entry_ui";
import ConfigEntryField from "./ConfigEntryField.vue";

const router = useRouter();
const showUnsavedDialog = ref(false);
const allowNavigation = ref(false);

export interface Props {
  configEntries: ConfigEntryUI[];
  disabled: boolean;
}

const emit = defineEmits<{
  (e: "submit", values: Record<string, ConfigValueType>): void;
  (e: "action", action: string, values: Record<string, ConfigValueType>): void;
  (e: "immediateApply", values: Record<string, ConfigValueType>): void;
}>();

// global refs
const entries = ref<ConfigEntryUI[]>();
const valid = ref(false);
const form = ref<VNodeRef>();
const activePanel = ref<string[]>([]);
const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntryUI>();
const oldValues = ref<Record<string, ConfigValueType>>({});

// props
const props = defineProps<Props>();

// computed props
const panels = computed(() => {
  // determine all unique categories from the config entries
  const allCategories = new Set(
    entries
      .value!.map((x) => x.category)
      .filter((x) => !["generic", "advanced"].includes(x)),
  );
  // ensure generic is always first and advanced always last
  return ["generic", ...allCategories, "advanced"];
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
      entry.type == ConfigEntryType.ACTION
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

// watchers
watch(
  () => props.configEntries,
  (val) => {
    entries.value = [];
    oldValues.value = {}; // Reset old values when config entries change
    for (const entry of val || []) {
      // handle missing values (undefined or null)
      if (entry.value == undefined || entry.value == null)
        entry.value = entry.default_value;
      // Store the initial value AFTER applying defaults (deep clone for arrays/objects)
      oldValues.value[entry.key] =
        typeof entry.value === "object" && entry.value !== null
          ? JSON.parse(JSON.stringify(entry.value))
          : entry.value;
      entries.value.push(entry);
    }
    // Set active panels after entries are populated
    // Expand all panels by default, except "advanced" which stays collapsed
    const expandedPanels = panels.value.filter((p) => p !== "advanced");
    activePanel.value = expandedPanels;
  },
  { immediate: true },
);

// methods
const validate = async function () {
  const { valid } = await (form.value as any).validate();
  return valid;
};
const submit = async function () {
  // submit button is pressed
  if (await validate()) {
    allowNavigation.value = true;
    emit("submit", getCurrentValues());
  }
};
const action = async function (action: string) {
  // call config entries action
  emit("action", action, getCurrentValues());
};

const onValueUpdate = function (entry: ConfigEntryUI, value: ConfigValueType) {
  entry.value = value;
  // If immediate_apply is set, emit the value change immediately
  if (entry.immediate_apply) {
    emit("immediateApply", { [entry.key]: value });
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
    group_settings: "mdi-speaker-multiple",
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
/* Config sections */
.config-section {
  margin-bottom: 16px;
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

/* Add extra top margin for entries that follow a checkbox (which is shorter) */
.config-entry:has(.v-checkbox) + .config-entry:has(.v-text-field),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-select),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-slider),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-combobox) {
  margin-top: 16px;
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

@media (min-width: 601px) {
  .config-entry:has(.config-slider-wrapper) .help-btn {
    margin-top: 0;
    align-self: center;
  }
}

@media (max-width: 600px) {
  .config-entry:has(.config-slider-wrapper) .help-btn {
    align-self: flex-start;
    margin-top: 0;
  }
}

/* Expansion panels */
.config-panels {
  margin-top: 16px;
}

.config-panel {
  margin-bottom: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px !important;
  overflow: hidden;
}

.config-panel::before {
  display: none;
}

.config-panel-title {
  min-height: 52px;
  padding: 14px 20px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.config-panel-title .v-icon {
  color: rgb(var(--v-theme-primary));
}

.panel-title-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.config-panel :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}

.config-panel-content {
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

/* Action buttons */
.config-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
}
</style>
