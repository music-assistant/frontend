<template>
  <div class="flex items-center gap-2">
    <Switch
      :model-value="enabled"
      :disabled="busy"
      :aria-label="label"
      data-testid="home-assistant-remote-access-switch"
      @update:model-value="emit('update:enabled', $event)"
    />
    <!-- the id and QR code to connect with exist only while it is on -->
    <Button
      v-if="enabled"
      as-child
      variant="ghost"
      size="icon-sm"
      class="text-muted-foreground no-underline"
      :title="$t('settings.home_assistant.remote_access_details')"
    >
      <RouterLink
        :to="{ name: 'remoteaccesssettings' }"
        :aria-label="$t('settings.home_assistant.remote_access_details')"
        data-testid="home-assistant-remote-access-details"
      >
        <ChevronRight class="size-4" />
      </RouterLink>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { $t } from "@/plugins/i18n";
import { ChevronRight } from "@lucide/vue";
import { RouterLink } from "vue-router";

/**
 * The switch of Music Assistant's remote access, and while it is on, the way to
 * the id and QR code to connect with.
 */
defineProps<{
  enabled: boolean;
  // remote access is being switched
  busy?: boolean;
  // names the switch for assistive technology
  label: string;
}>();

const emit = defineEmits<{
  "update:enabled": [enabled: boolean];
}>();
</script>
