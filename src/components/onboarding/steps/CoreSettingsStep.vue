<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.core_settings.description") }}
    </p>

    <!-- fixed minimum height so the step does not jump once the settings load -->
    <div class="min-h-24">
      <!-- the form carries its own save button, and the wizard's Next saves
           through it too, so neither way out of the step loses what was typed.
           Advanced settings are shown outright: these three are the whole step,
           so there is nothing here worth hiding behind a toggle. -->
      <EditConfig
        v-if="entries.length > 0"
        ref="editConfig"
        :config-entries="entries"
        :disabled="false"
        :show-advanced-settings="true"
        @submit="onSubmit"
      />

      <div
        v-else-if="!loaded"
        class="flex min-h-24 items-center justify-center"
      >
        <Spinner class="size-6" />
      </div>

      <Empty v-else class="border-border rounded-md border border-dashed py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Globe />
          </EmptyMedia>
          <EmptyTitle>
            {{ $t("onboarding.steps.core_settings.load_failed") }}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { api } from "@/plugins/api";
import type { ConfigValueType, CoreConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import { Globe } from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/** The core module the server's own name and addresses belong to. */
const DOMAIN = "webserver";
/**
 * The settings this step is about. The form groups its entries by category, so
 * this is the order they are handed over in rather than the order on screen.
 */
const KEYS = ["server_name", "base_url", "external_url"] as const;

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const config = ref<CoreConfig>();
// whether the settings have been asked for and answered, however that turned
// out: until then the step reserves the room rather than claiming anything
const loaded = ref(false);
const editConfig = ref<InstanceType<typeof EditConfig>>();

// Only the settings of this step, and only the ones the server knows: an older
// or newer server that does not carry one of them leaves it out rather than
// having the form make one up.
const entries = computed<ConfigEntryUI[]>(() =>
  KEYS.map((key) => config.value?.values[key]).filter((entry) => entry != null),
);

// the save in flight, so the form's own Save button and the wizard's Next share
// one path: whichever started it, both wait on the same answer and neither
// sends the same settings a second time
let pendingSave: Promise<boolean> | undefined;

const onSubmit = function (values: Record<string, ConfigValueType>) {
  // the server merges what it is handed into the stored configuration, so the
  // settings this step leaves out keep the values they had
  const save = api
    .saveCoreConfig(DOMAIN, values)
    .then(() => {
      // the form stays on screen here, so it is told which values are stored
      // now: otherwise it keeps offering to save what it already saved
      editConfig.value?.saveSucceeded(values);
      toast.success($t("settings.settings_saved"));
      return true;
    })
    .catch(() => {
      // the api tells the user what went wrong itself; the form takes its
      // pending edits back under guard, so nothing typed here is lost
      editConfig.value?.saveFailed();
      return false;
    })
    .finally(() => {
      if (pendingSave === save) pendingSave = undefined;
    });
  pendingSave = save;
};

const loadConfig = async function (): Promise<void> {
  try {
    config.value = await api.getCoreConfig(DOMAIN);
  } catch (error) {
    // the api already told the user; the step then says so rather than showing
    // a form filled in with values nobody stands behind
    console.warn("Failed to load the webserver configuration:", error);
  } finally {
    loaded.value = true;
  }
};

// the load in flight: the wizard waits for it before it moves on, so a Next
// that lands while the settings are still coming in does not walk past them
const loading = loadConfig();

/**
 * The wizard asking whether it may move on. Anything the user typed is saved
 * first — the form validates it and shows what it will not accept — and a save
 * that did not land keeps the wizard here rather than leaving the edit behind.
 */
const beforeLeave = async function (): Promise<boolean> {
  await loading;
  // the Save button got there first: its answer is this one too
  if (pendingSave) return await pendingSave;
  const form = editConfig.value;
  if (!form?.hasUnsavedChanges) return true;
  await form.submit();
  // nothing under way afterwards means the form held its values back and is
  // showing what is wrong with them — unless the save was already through, in
  // which case it has taken the edits over and there is nothing left to keep
  return pendingSave ? await pendingSave : !form.hasUnsavedChanges;
};

defineExpose({ beforeLeave });
</script>
