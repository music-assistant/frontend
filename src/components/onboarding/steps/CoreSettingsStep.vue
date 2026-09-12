<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.core_settings.description") }}
    </p>

    <!-- fixed minimum height so the step does not jump once the settings load -->
    <div class="min-h-24">
      <!-- the form carries its own save button; the wizard's Next only moves on.
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
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { api } from "@/plugins/api";
import type {
  ConfigEntry,
  ConfigValueType,
  CoreConfig,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

/** The core module the server's own name and addresses belong to. */
const DOMAIN = "webserver";
/** The settings this step is about, in the order it shows them. */
const KEYS = ["server_name", "base_url", "external_url"];

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const config = ref<CoreConfig>();
const editConfig = ref<InstanceType<typeof EditConfig>>();

// Only the settings of this step, and only the ones the server knows: an older
// or newer server that does not carry one of them leaves it out rather than
// having the form make one up.
const entries = computed<ConfigEntryUI[]>(() => {
  const values = Object.values(config.value?.values ?? {});
  return KEYS.map((key) => values.find((entry) => entry.key === key)).filter(
    (entry): entry is ConfigEntry => entry != null,
  );
});

const onSubmit = function (values: Record<string, ConfigValueType>) {
  // the server merges what it is handed into the stored configuration, so the
  // settings this step leaves out keep the values they had
  api
    .saveCoreConfig(DOMAIN, values)
    .then(() => {
      toast.success($t("settings.settings_saved"));
    })
    .catch((err) => {
      toast.error(err.message || err);
      editConfig.value?.saveFailed();
    });
};

onMounted(async () => {
  try {
    config.value = await api.getCoreConfig(DOMAIN);
  } catch (error) {
    // the api already told the user; the step then shows no form rather than
    // one filled in with values nobody stands behind
    console.warn("Failed to load the webserver configuration:", error);
  }
});
</script>
