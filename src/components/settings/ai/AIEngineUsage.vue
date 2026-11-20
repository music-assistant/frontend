<template>
  <section v-if="rows.length" class="space-y-3" data-testid="ai-usage">
    <h2 class="text-muted-foreground text-sm font-medium">
      {{ $t("settings.ai.usage") }}
    </h2>
    <SettingsLinkRows :rows="rows" test-id-prefix="ai-usage">
      <template #control="{ row }">
        <AIEngineSettingControl
          v-if="pickers.has(row.key)"
          v-bind="pickers.get(row.key)!"
          @saved="onSaved"
        />
      </template>
    </SettingsLinkRows>
  </section>
</template>

<script setup lang="ts">
import AIEngineSettingControl from "@/components/settings/ai/AIEngineSettingControl.vue";
import SettingsLinkRows from "@/components/settings/SettingsLinkRows.vue";
import {
  engineSettingKey,
  engineSettingState,
  engineUsageRows,
  hasEnginePicker,
  selectsAvailableEngine,
  withRestartingSettings,
} from "@/helpers/ai_settings";
import { api } from "@/plugins/api";
import type { AIEngine, AIEngineUsage } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch } from "vue";

/**
 * What uses AI: each engine setting of the core modules and providers, with
 * the engine it uses picked on the spot, or, for a setting stored in the setup
 * of its provider, a way into that setup.
 */
const props = defineProps<{
  // the engine settings, as the server lists them
  usage: readonly AIEngineUsage[];
  engines: readonly AIEngine[];
}>();

const emit = defineEmits<{
  // a setting changed in a way the server sends no event for
  changed: [];
}>();

// A provider restarts to apply a saved engine, and the server leaves its
// settings out until it is loaded again, so its rows stay meanwhile. Each
// provider saved here maps to whether it went away to restart yet.
const restarting = new Map<string, boolean>();
const settings = ref<AIEngineUsage[]>([]);

watch(
  () => Object.keys(api.providers),
  (loaded) => {
    for (const owner of restarting.keys()) {
      if (!loaded.includes(owner)) restarting.set(owner, true);
    }
  },
);

watch(
  () => props.usage,
  (current) => {
    const listed = new Set(current.map(({ owner }) => owner));
    for (const [owner, wentAway] of restarting) {
      if (!listed.has(owner)) restarting.set(owner, true);
      else if (wentAway) restarting.delete(owner);
    }
    settings.value = withRestartingSettings(
      current,
      settings.value,
      new Set(restarting.keys()),
    );
  },
  { immediate: true },
);

const rows = computed(() =>
  engineUsageRows(settings.value, props.engines, reconfigure),
);

// the pickers of the settings whose engine is picked on their row, by the key
// of the row
const pickers = computed(
  () =>
    new Map(
      settings.value
        .filter((setting) => hasEnginePicker(setting, props.engines))
        .map((setting) => [
          engineSettingKey(setting),
          {
            setting,
            state: engineSettingState(setting, props.engines),
            unavailable: !selectsAvailableEngine(setting, props.engines),
          },
        ]),
    ),
);

const onSaved = function (setting: AIEngineUsage) {
  if (setting.owner_type === "provider") {
    restarting.set(setting.owner, false);
  } else {
    // a core module applies it in place, without an event
    emit("changed");
  }
};

// the setting is changed through the setup flow of its provider
function reconfigure(setting: AIEngineUsage) {
  eventbus.emit("setupFlowDialog", {
    kind: "reconfigure",
    instanceId: setting.owner,
    name: setting.name,
    onFlowEnded: () => emit("changed"),
  });
}
</script>
