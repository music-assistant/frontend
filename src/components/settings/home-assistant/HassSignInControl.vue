<template>
  <Switch
    :model-value="checked"
    :disabled="busy || !entry"
    :aria-label="label"
    data-testid="home-assistant-sign-in-switch"
    @update:model-value="save"
  />
</template>

<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import { useConfigValue } from "@/composables/useConfigValue";
import { SELF_REGISTRATION_KEY } from "@/helpers/home_assistant";
import { WEBSERVER_DOMAIN } from "@/helpers/settings_pages";
import { computed } from "vue";

/**
 * The switch that gives Home Assistant users without an account one when they
 * first sign in with Home Assistant, saving a change right away.
 */
defineProps<{
  // names the switch for assistive technology
  label: string;
}>();

const { entry, busy, save } = useConfigValue(
  { kind: "core", domain: WEBSERVER_DOMAIN },
  SELF_REGISTRATION_KEY,
);

const checked = computed(
  () => (entry.value?.value ?? entry.value?.default_value) === true,
);
</script>
