<template>
  <Ban
    v-if="!enabled"
    class="shrink-0 text-muted-foreground"
    :aria-label="$t('settings.player_disabled')"
    :title="$t('settings.player_disabled')"
  />
  <CircleAlert
    v-else-if="needsSetup"
    class="shrink-0 text-warning"
    :aria-label="reason ?? $t('settings.player_needs_setup')"
    :title="reason ?? $t('settings.player_needs_setup')"
  />
  <Hourglass
    v-else-if="unavailable"
    class="shrink-0 text-muted-foreground"
    :aria-label="reason ?? $t('settings.player_not_available')"
    :title="reason ?? $t('settings.player_not_available')"
  />
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { Ban, CircleAlert, Hourglass } from "@lucide/vue";

interface Props {
  enabled: boolean;
  unavailable: boolean;
  // the card shows its own setup warning, so only the list asks for the icon
  needsSetup?: boolean;
  // why the player needs setup or is unavailable, in words
  reason?: string;
}

defineProps<Props>();
</script>
