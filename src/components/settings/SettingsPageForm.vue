<template>
  <div v-if="showForm" :aria-busy="busy" data-testid="settings-page-form">
    <template v-if="loaded">
      <slot
        v-if="customEntries"
        name="custom"
        :entries="customEntries"
        :set-value="setCustomValue"
      ></slot>
      <EditConfig
        ref="editConfig"
        :config-entries="entries"
        :disabled="false"
        :provider-domain="settingsPageProviderDomain(page)"
        inline-save
        @submit="onSubmit"
        @action="onAction"
        @immediate-apply="onImmediateApply"
      />
    </template>

    <Empty v-else-if="loadFailed" class="rounded-xl border border-dashed py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SlidersHorizontal />
        </EmptyMedia>
        <EmptyTitle>{{ $t("settings.settings_load_failed") }}</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <div v-else class="flex min-h-24 items-center justify-center">
      <Spinner class="size-6" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useSettingsPage } from "@/composables/settings/useSettingsPage";
import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import type { SettingsField } from "@/helpers/settings_form";
import {
  settingsPageProviderDomain,
  type SettingsPageId,
} from "@/helpers/settings_pages";
import type { ConfigEntry, ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import { RotateCcw, SlidersHorizontal } from "@lucide/vue";
import { computed, markRaw, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

/**
 * The settings a settings page shows, as a form that saves them in place.
 * Renders nothing for a user who may not change them, or when there are none.
 */
const props = defineProps<{
  page: SettingsPageId;
  // settings the page edits with controls of its own, in the custom slot
  customSettings?: readonly SettingsField[];
  // the form is a part of a page about something else, so it leaves the
  // page's menu to the page and offers no reset there
  embedded?: boolean;
}>();

defineSlots<{
  // the controls of the custom settings, above the form; left out unless the
  // form holds every one of them
  custom?(props: {
    // the entries of the custom settings, in their given order
    entries: ConfigEntry[];
    // sets the value of a custom setting, by the key of its entry
    setValue: (key: string, value: ConfigValueType) => void;
  }): unknown;
}>();

const emit = defineEmits<{
  // the settings were reset to their defaults, for the page to reset the
  // controls of its custom settings
  reset: [];
  // the changes of the form were saved
  saved: [];
}>();

const editConfig = ref<InstanceType<typeof EditConfig>>();

const { entries, loaded, loadFailed, busy, canEdit, save, onAction, entryOf } =
  useSettingsPage(props.page);

const showForm = computed(
  () => canEdit && !(loaded.value && entries.value.length === 0),
);

const customEntries = computed(() => {
  const found = (props.customSettings ?? []).map(({ owner, key }) =>
    entryOf(owner, key),
  );
  return found.every((entry): entry is ConfigEntry => entry !== undefined)
    ? found
    : undefined;
});

// hidden from the form, while it still saves and guards their values; hidden
// rather than left out, so the entries depending on them still resolve
watch(
  customEntries,
  (custom) => {
    for (const entry of custom ?? []) entry.hidden = true;
  },
  { immediate: true },
);

const setCustomValue = function (key: string, value: ConfigValueType) {
  const entry = customEntries.value?.find((e) => e.key === key);
  if (entry) entry.value = value;
};

const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
  // the form's reset skips hidden entries, and these are hidden only because
  // the page shows them itself
  for (const entry of customEntries.value ?? []) {
    entry.value = entry.default_value;
  }
  emit("reset");
};

// the page's menu resets the form while it is on screen; an embedded form
// leaves the menu to the page
const pageMenu = useSettingsPageMenu();
watch(
  () => showForm.value && loaded.value,
  (resettable) => {
    if (props.embedded) return;
    pageMenu.value = resettable
      ? [
          {
            label: "settings.reset_to_defaults",
            icon: markRaw(RotateCcw),
            action: resetToDefaults,
          },
        ]
      : [];
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (!props.embedded) pageMenu.value = [];
});

// an entry that applies the moment it changes is saved on its own; the api
// reports a failed save itself
const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  if (!(await save(values))) return;
  toast.success($t("settings.settings_saved"));
  emit("saved");
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  if (!(await save(values))) {
    editConfig.value?.saveFailed();
    return;
  }
  // the form stays on screen, so it takes the saved values as its baseline
  editConfig.value?.saveSucceeded(values);
  toast.success($t("settings.settings_saved"));
  emit("saved");
};
</script>
