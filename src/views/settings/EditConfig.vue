<template>
  <!-- saving goes through the Save button, so Enter in a field does not submit -->
  <form v-if="entries" novalidate @submit.prevent>
    <slot />
    <component
      :is="flat ? 'div' : Card"
      v-if="hasOptions"
      :class="{ 'gap-0 py-0': !flat }"
    >
      <!-- a flat form keeps only the advanced toggle of its header -->
      <component
        :is="flat ? 'div' : CardHeader"
        v-if="flat ? showAdvancedToggle : !hideHeader"
        :class="
          flat
            ? 'flex'
            : [
                'flex flex-wrap items-center gap-3 px-6 py-4 [.border-b]:pb-4',
                { 'border-b': hasVisibleSections },
              ]
        "
      >
        <CardTitle v-if="!flat">{{ $t("settings.options") }}</CardTitle>
        <AdvancedSettingsToggle
          v-if="showAdvancedToggle"
          :show-advanced-settings="showAdvancedSettings"
          test-id="config-advanced-settings"
          @update:show-advanced-settings="setShowAdvancedSettings"
        />
      </component>
      <component
        :is="flat ? 'div' : CardContent"
        v-if="hasVisibleSections"
        :class="{ 'px-6 pb-5': !flat }"
      >
        <!-- Generic settings section -->
        <section
          v-for="panel of visibleRegularPanels.filter((p) => p === 'generic')"
          :key="panel"
          class="pt-7 first:pt-5"
        >
          <h4
            v-if="showSectionHeadings"
            class="mb-5 flex items-center gap-3 text-xs font-medium tracking-wider text-primary uppercase"
          >
            <span>{{ getCategoryTranslation(panel) }}</span>
            <span class="h-px flex-1 bg-border"></span>
          </h4>
          <ConfigEntryRow
            v-for="conf_entry of entriesForCategory(panel)"
            :key="conf_entry.key"
            :conf-entry="conf_entry"
            :show-password-values="showPasswordValues"
            :disabled="isRowDisabled(conf_entry)"
            :provider-domain="providerDomain"
            @update:value="onValueUpdate(conf_entry, $event)"
            @toggle-password="showPasswordValues = !showPasswordValues"
            @action="onEntryAction(conf_entry)"
            @set-entry-value="onEntryValueSet"
          />
        </section>

        <!-- No provider-domain: that is only set for a provider config, which carries no protocol
             categories. No set-entry-value handler: its only emitter is the Home Assistant entity
             picker, which sits with the player controls on the parent player. -->
        <ProtocolConfigSection
          v-if="hasProtocolSection"
          :entries="entries || []"
          :protocol-panels="protocolPanels"
          :visible-entries-by-category="visibleEntriesByCategory"
          :show-password-values="showPasswordValues"
          :is-disabled="isRowDisabled"
          :output-protocols="outputProtocols"
          :output-menu-items="outputMenuItems"
          :multi-channel="multiChannel"
          :show-heading="showSectionHeadings"
          @update:value="onValueUpdate"
          @action="onEntryAction"
          @toggle-password="showPasswordValues = !showPasswordValues"
        />

        <!-- Other regular settings sections -->
        <section
          v-for="panel of visibleRegularPanels.filter((p) => p !== 'generic')"
          :key="panel"
          class="pt-7 first:pt-5"
        >
          <h4
            v-if="showSectionHeadings"
            class="mb-5 flex items-center gap-3 text-xs font-medium tracking-wider text-primary uppercase"
          >
            <span>{{ getCategoryTranslation(panel) }}</span>
            <span class="h-px flex-1 bg-border"></span>
          </h4>
          <ConfigEntryRow
            v-for="conf_entry of entriesForCategory(panel)"
            :key="conf_entry.key"
            :conf-entry="conf_entry"
            :show-password-values="showPasswordValues"
            :disabled="isRowDisabled(conf_entry)"
            :provider-domain="providerDomain"
            @update:value="onValueUpdate(conf_entry, $event)"
            @toggle-password="showPasswordValues = !showPasswordValues"
            @action="onEntryAction(conf_entry)"
            @set-entry-value="onEntryValueSet"
          />
        </section>
      </component>
    </component>

    <SettingsSaveBar
      v-if="showSaveAction"
      :inline="inlineSave"
      :unsaved-changes="hasUnsavedChanges"
    >
      <Button
        data-testid="config-save"
        type="button"
        size="lg"
        :disabled="!requiredValuesPresent || !hasUnsavedChanges"
        @click="submit"
      >
        <Save class="size-4" />
        {{ $t("settings.save") }}
      </Button>
    </SettingsSaveBar>
  </form>
  <!-- Unsaved changes confirmation dialog -->
  <!-- any way out of this dialog has to answer the navigation it is holding -->
  <AlertDialog :open="showUnsavedDialog" @update:open="onUnsavedDialogOpen">
    <AlertDialogContent class="sm:max-w-[400px]">
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("settings.unsaved_changes")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("settings.unsaved_changes_message") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <!-- plain buttons: each answer closes the dialog itself -->
        <Button
          data-testid="config-stay"
          type="button"
          variant="ghost"
          @click="cancelDiscard"
        >
          {{ $t("settings.stay") }}
        </Button>
        <Button
          data-testid="config-discard"
          type="button"
          variant="warning"
          @click="confirmDiscard"
        >
          {{ $t("settings.discard") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import {
  allRequiredValuesPresent,
  ConfigEntryUI,
  hasAdvancedEntries,
  isEntryDisabled,
  isInjected,
  NON_INTERACTIVE_ENTRY_TYPES,
  VALUELESS_ENTRY_TYPES,
} from "@/helpers/config_entry_ui";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { provideConfigFormValidation } from "@/composables/useConfigFormValidation";
import { expertModeSetting } from "@/helpers/expert_mode";
import { isSpeakerChannelEntry } from "@/helpers/multi_channel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsSaveBar from "@/components/settings/SettingsSaveBar.vue";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  ConfigEntryType,
  ConfigValueType,
  OutputProtocol,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { setUserPreference } from "@/composables/userPreferences";
import { Save } from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import AdvancedSettingsToggle from "./AdvancedSettingsToggle.vue";
import ConfigEntryRow from "./ConfigEntryRow.vue";
import ProtocolConfigSection from "./ProtocolConfigSection.vue";

const ADVANCED_SETTINGS_PREFERENCE = "settings.showAdvancedSettings";

const router = useRouter();
const showUnsavedDialog = ref(false);
const allowNavigation = ref(false);
// answers the navigation the guard is holding; set only while one waits on the
// unsaved-changes dialog
let heldNavigation: ((discard: boolean) => void) | undefined;

export interface Props {
  configEntries: ConfigEntryUI[];
  disabled: boolean;
  // Output protocols of the player being configured; drives derived-transport labelling
  // in the protocol section. Omitted for provider/core configs.
  outputProtocols?: OutputProtocol[];
  // The menu entries of an output of the player being configured; an output without any
  // gets no menu button. Omitted for provider/core configs.
  outputMenuItems?: (output: OutputProtocol) => ContextMenuItem[];
  // The config is that of a multi-channel player, whose speakers show as rows of their own.
  multiChannel?: boolean;
  // Domain of the provider being configured; lets a field recognise the entries of the
  // provider it belongs to. Omitted for player/core configs.
  providerDomain?: string;
  // Keep the Save button in the flow of the form instead of a bar pinned to the bottom of
  // the page, for a form in a dialog or in a frame of its own.
  inlineSave?: boolean;
  // Leave out the Options header and its advanced toggle, for a host that names the form and
  // decides which of its entries show.
  hideHeader?: boolean;
  // Leave out the card and the Options title, for a host that frames and names the form.
  flat?: boolean;
  // Whether the advanced entries show, for a host that decides it; without one, the choice
  // the user made with the advanced toggle applies.
  showAdvancedSettings?: boolean;
  // The host names the sections itself, so a lone section keeps its heading too.
  keepSectionHeadings?: boolean;
}

defineSlots<{
  // controls of the host whose values the form saves, above its own fields
  default?(): unknown;
}>();

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
const { validate } = provideConfigFormValidation();
const showPasswordValues = ref(false);
const oldValues = ref<Record<string, ConfigValueType>>({});
const oldValuesInitialized = ref(false);
// entries reset to their default and not edited since: a save unsets their stored value
const resetKeys = ref(new Set<string>());

// props
const props = withDefaults(defineProps<Props>(), {
  outputProtocols: undefined,
  outputMenuItems: undefined,
  providerDomain: undefined,
  // left unset rather than cast to false, so the user's own choice can apply
  showAdvancedSettings: undefined,
});

// one choice for every settings form, kept on the user's profile; until it is
// made, the advanced entries show in expert mode
const advancedSettingsPreference = computed(() =>
  expertModeSetting(ADVANCED_SETTINGS_PREFERENCE),
);
// what was chosen here, which holds for this form even when the profile could not
// be updated
const advancedSettingsChoice = ref<boolean>();
const showAdvancedSettings = computed(
  () =>
    props.showAdvancedSettings ??
    advancedSettingsChoice.value ??
    advancedSettingsPreference.value,
);

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

const visibleRegularPanels = computed(() =>
  regularPanels.value.filter((p) => entriesForCategory(p).length > 0),
);

const hasProtocolSection = computed(
  () =>
    protocolPanels.value.length > 0 ||
    entriesForCategory("protocol_general").length > 0,
);

// a lone section is already named by the page or the card it is on
const showSectionHeadings = computed(
  () =>
    props.keepSectionHeadings ||
    visibleRegularPanels.value.length + (hasProtocolSection.value ? 1 : 0) > 1,
);

// a disabled form cannot be edited, so there is nothing to reveal; without the
// header there is no place for the toggle, and a host that decides what shows
// leaves it nothing to change
const showAdvancedToggle = computed(
  () =>
    !props.hideHeader &&
    !props.disabled &&
    props.showAdvancedSettings === undefined &&
    hasAdvancedEntries(entries.value || []),
);

const hasVisibleSections = computed(
  () =>
    protocolPanels.value.length > 0 ||
    Object.keys(visibleEntriesByCategory.value).length > 0,
);

// what the save button can store: a visible entry holding a value, or the enable
// switch of an optional protocol; actions and labels alone leave nothing to save,
// and neither do entries that are saved the moment they change
const hasEditableEntries = computed(
  () =>
    Object.values(visibleEntriesByCategory.value)
      .flat()
      .some(
        (entry) =>
          !VALUELESS_ENTRY_TYPES.includes(entry.type) &&
          !isInjected(entry) &&
          !entry.immediate_apply,
      ) ||
    (entries.value ?? []).some((entry) =>
      entry.key.endsWith("||protocol||enabled"),
    ),
);

// with nothing editable in view, only unsaved edits still need saving
const showSaveAction = computed(
  () =>
    !props.disabled && (hasEditableEntries.value || hasUnsavedChanges.value),
);

// a config with nothing to show or reveal leaves out the card altogether
const hasOptions = computed(
  () => showAdvancedToggle.value || hasVisibleSections.value,
);

// the same fields the form checks on save: hidden advanced entries leave it alone
const requiredValuesPresent = computed(() =>
  entries.value
    ? allRequiredValuesPresent(
        entries.value,
        (entry) => !entry.advanced || showAdvancedSettings.value,
      )
    : false,
);

const hasUnsavedChanges = computed(() => {
  if (!entries.value) return false;
  // a reset can leave every value as it shows, while the server still stores some
  if (resetKeys.value.size > 0) return true;
  for (const entry of entries.value) {
    // Skip non-value entry types
    if (VALUELESS_ENTRY_TYPES.includes(entry.type) || isInjected(entry)) {
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

/**
 * A value as `oldValues` keeps it: an object is copied, so editing the entry
 * afterwards does not quietly change what it is compared against.
 */
const snapshot = function (value: ConfigValueType): ConfigValueType {
  return typeof value === "object" && value !== null
    ? JSON.parse(JSON.stringify(value))
    : value;
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
        oldValues.value[entry.key] = snapshot(entry.value);
      }
      entries.value.push(entry);
    }
    oldValuesInitialized.value = true;
  },
  { immediate: true },
);

// methods
const submit = async function () {
  // submit button is pressed
  if (validate()) {
    allowNavigation.value = true;
    emit("submit", getSaveValues());
  }
};
const action = async function (action: string, immediateApply: boolean) {
  // call config entries action
  emit("action", action, getCurrentValues(), immediateApply);
};

const onValueUpdate = function (entry: ConfigEntryUI, value: ConfigValueType) {
  entry.value = value;
  resetKeys.value.delete(entry.key);
  // If immediate_apply is set, emit the value change immediately
  // and update oldValues so the form doesn't show as "unsaved"
  if (entry.immediate_apply) {
    emit("immediateApply", { [entry.key]: value });
    oldValues.value[entry.key] = snapshot(value);
  }
};
// a field can fill in another entry of the same form, e.g. the Home Assistant entity
// picker setting the player control it sits under
const onEntryValueSet = function (
  key: string,
  value: ConfigValueType,
  label?: string,
) {
  const entry = entries.value?.find((e) => e.key === key);
  if (!entry) return;
  // the server does not know of the value yet, so carry the name the field gave us or
  // the field would read back the bare id until the config is fetched again
  if (label && !entry.options.some((option) => option.value === value)) {
    entry.options = [...entry.options, { title: label, value }];
  }
  onValueUpdate(entry, value);
};

const onEntryAction = function (entry: ConfigEntryUI) {
  action(entry.action || entry.key, !!entry.immediate_apply);
};

const setShowAdvancedSettings = function (show: boolean) {
  advancedSettingsChoice.value = show;
  void setUserPreference(ADVANCED_SETTINGS_PREFERENCE, show);
};

const resetToDefaults = function () {
  if (!entries.value) return;
  for (const entry of entries.value) {
    // a hidden entry carries state the user never sees, such as housekeeping the
    // server keeps in the config, so a reset leaves it as it is
    if (entry.hidden) continue;
    entry.value = entry.default_value;
    if (unsetsOnReset(entry)) resetKeys.value.add(entry.key);
  }
};

/**
 * Reports a save that did not land, so the values stay guarded and leaving the
 * screen asks about them again.
 */
const saveFailed = function () {
  allowNavigation.value = false;
};

/**
 * Reports a save that landed, for a form that stays on screen afterwards: the
 * values that went to the server are what is stored now, so they stop counting
 * as unsaved. Only those — the form stays open while a save is on its way, so
 * anything typed in the meantime is still an edit nobody saved. Leaving guards
 * the values again as well: `submit` let the save through, and the next edit
 * has to be asked about like any other.
 */
const saveSucceeded = function (values: Record<string, ConfigValueType>) {
  for (const [key, value] of Object.entries(values)) {
    // a reset entry went out as null, while the form shows its default
    oldValues.value[key] = resetKeys.value.delete(key)
      ? snapshot(entries.value?.find((e) => e.key === key)?.value ?? null)
      : snapshot(value);
  }
  allowNavigation.value = false;
};

/**
 * Stops guarding the pending edits, for when what they belong to is gone and
 * there is nothing left to save them to.
 */
const discardChanges = function () {
  allowNavigation.value = true;
};

defineExpose({
  resetToDefaults,
  saveFailed,
  saveSucceeded,
  discardChanges,
  hasUnsavedChanges,
  submit,
});

const confirmDiscard = function () {
  showUnsavedDialog.value = false;
  // a redirect has the router run the leave guards of the resumed navigation a
  // second time, and it must not ask again
  allowNavigation.value = true;
  releaseNavigation(true);
};

// Escape is the only way the dialog closes by itself, and it means stay
const onUnsavedDialogOpen = function (open: boolean) {
  if (!open && showUnsavedDialog.value) cancelDiscard();
};

const cancelDiscard = function () {
  showUnsavedDialog.value = false;
  releaseNavigation(false);
};

// Navigation guard for route changes
onBeforeRouteLeave(() => {
  if (allowNavigation.value || !hasUnsavedChanges.value) return true;
  // one is already waiting for an answer: turn this one away rather than hold
  // both, or the history ends up out of step with the page on screen
  if (heldNavigation) return false;
  // holding it, rather than cancelling it, is what lets discarding carry on to
  // the very page the user asked for
  showUnsavedDialog.value = true;
  return new Promise<boolean>((resolve) => {
    heldNavigation = resolve;
  });
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

const releaseNavigation = function (discard: boolean) {
  heldNavigation?.(discard);
  heldNavigation = undefined;
};

const isDisabled = function (entry: ConfigEntryUI) {
  return isEntryDisabled(entry, entries.value || []);
};

// the form-wide disabled state is handed to every field
const isRowDisabled = function (entry: ConfigEntryUI) {
  return props.disabled || isDisabled(entry);
};

const isVisible = function (entry: ConfigEntryUI) {
  if (entry.hidden) return false;
  // an unmet dependency can only be expressed by hiding these types
  return !(
    NON_INTERACTIVE_ENTRY_TYPES.includes(entry.type) && isDisabled(entry)
  );
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

/**
 * The values a save sends: null for an entry reset to its default, so the server
 * stops storing a value for it and it follows its default from then on.
 */
const getSaveValues = function () {
  const values = getCurrentValues();
  for (const key of resetKeys.value) {
    if (key in values) values[key] = null;
  }
  return values;
};

/**
 * Whether a save unsets an entry that was reset, rather than send its default. The
 * name and the switches that turn a provider, an output or a plugin on keep sending
 * their value, as does an entry that is not saved as a value at all, and the channel
 * of a speaker of a multi-channel player, which always plays one.
 */
const unsetsOnReset = function (entry: ConfigEntryUI) {
  if (VALUELESS_ENTRY_TYPES.includes(entry.type) || isInjected(entry)) {
    return false;
  }
  if (props.multiChannel && isSpeakerChannelEntry(entry, entries.value ?? [])) {
    return false;
  }
  const { key } = entry;
  return key !== "enabled" && key !== "name" && !key.endsWith("||enabled");
};
</script>
