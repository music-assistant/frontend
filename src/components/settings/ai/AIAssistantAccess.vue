<template>
  <section v-if="config" class="space-y-3" data-testid="ai-assistant-access">
    <h2 class="text-muted-foreground text-sm font-medium">
      {{ $t("settings.ai.assistant_access") }}
    </h2>
    <div
      class="bg-card flex items-center gap-4 rounded-xl border px-6 py-4 shadow-sm"
    >
      <Bot class="text-primary size-5 shrink-0" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <Label :for="switchId" class="text-foreground text-sm font-medium">
          {{ $t("settings.ai.mcp_server") }}
        </Label>
        <p class="text-muted-foreground m-0 text-sm">
          {{ $t("settings.ai.mcp_server_description") }}
        </p>
      </div>
      <Switch
        :id="switchId"
        :model-value="config.enabled"
        :disabled="busy"
        data-testid="ai-assistant-access-switch"
        @update:model-value="setEnabled"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MCP_SERVER_DOMAIN } from "@/helpers/ai_engines";
import { api } from "@/plugins/api";
import { type ProviderConfig, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Bot } from "@lucide/vue";
import { onMounted, ref, useId } from "vue";
import { toast } from "vue-sonner";

/**
 * The switch that lets AI assistants search the music and control playback,
 * through the MCP server built into Music Assistant. Renders nothing for a user
 * who may not change it.
 */

const switchId = useId();
const config = ref<ProviderConfig>();
const busy = ref(false);

const setEnabled = async function (enabled: boolean) {
  const current = config.value;
  if (!current) return;
  busy.value = true;
  try {
    config.value = await api.saveProviderConfig(
      current.domain,
      { enabled },
      current.instance_id,
    );
    toast.success(
      $t(
        enabled
          ? "settings.ai.assistant_access_enabled"
          : "settings.ai.assistant_access_disabled",
      ),
    );
  } catch {
    // the api reports the failure itself; the switch keeps what the server has
  } finally {
    busy.value = false;
  }
};

onMounted(async () => {
  if (!authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE)) return;
  try {
    [config.value] = await api.getProviderConfigs(undefined, MCP_SERVER_DOMAIN);
  } catch {
    // the api reports the failure itself
  }
});
</script>
