<template>
  <Button
    :variant="action === 'enable' ? 'default' : 'outline'"
    size="sm"
    :disabled="busy"
    data-testid="home-assistant-connection-action"
    @click="emit('run')"
  >
    <Spinner v-if="busy" class="size-4" />
    <component :is="ACTION_ICONS[action]" v-else class="size-4" />
    {{ $t(ACTION_LABELS[action]) }}
  </Button>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { HassConnectionAction } from "@/composables/settings/useHassConnectionActions";
import { $t } from "@/plugins/i18n";
import { Power, Wrench } from "@lucide/vue";
import type { Component } from "vue";

/**
 * The button of the action the connection with Home Assistant offers on the
 * spot: reconfiguring it, or enabling it while it is disabled.
 */
defineProps<{
  action: HassConnectionAction;
  // the action is running
  busy?: boolean;
}>();

const emit = defineEmits<{
  run: [];
}>();

const ACTION_LABELS: Readonly<Record<HassConnectionAction, string>> = {
  reconfigure: "settings.reconfigure",
  enable: "settings.enable",
};
const ACTION_ICONS: Readonly<Record<HassConnectionAction, Component>> = {
  reconfigure: Wrench,
  enable: Power,
};
</script>
