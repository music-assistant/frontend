<template>
  <Alert
    variant="warning"
    role="note"
    class="rounded-(--radius-xl)"
    data-testid="community-unavailable"
  >
    <CircleAlert />
    <AlertTitle class="line-clamp-none">
      {{ reason || $t("settings.catalog.community.unavailable_title") }}
    </AlertTitle>
    <AlertDescription>
      {{ $t("settings.catalog.community.unavailable_message") }}
    </AlertDescription>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { $t } from "@/plugins/i18n";
import { CircleAlert } from "@lucide/vue";

interface Props {
  // why it is not available, in the server's words; the general text without it
  reason?: string | null;
}

defineProps<Props>();
</script>
