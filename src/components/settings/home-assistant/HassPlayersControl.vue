<template>
  <Button
    variant="outline"
    size="sm"
    data-testid="home-assistant-players-choose"
    @click="open = true"
  >
    <ListChecks class="size-4" />
    {{ $t("settings.home_assistant.players_choose") }}
  </Button>
  <ProviderSettingsDialog v-model:open="open" :instance-id="instanceId" />
</template>

<script setup lang="ts">
import ProviderSettingsDialog from "@/components/settings/providers/ProviderSettingsDialog.vue";
import { Button } from "@/components/ui/button";
import { $t } from "@/plugins/i18n";
import { ListChecks } from "@lucide/vue";

/**
 * The way to choose which media players of Home Assistant play in Music
 * Assistant: the settings of their provider, in a dialog over the page.
 */
defineProps<{
  // the provider of the Home Assistant players
  instanceId: string;
}>();

// whether the players are being chosen
const open = defineModel<boolean>("open", { required: true });
</script>
