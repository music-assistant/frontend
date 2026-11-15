<template>
  <Alert
    variant="warning"
    role="note"
    class="rounded-(--radius-xl)"
    data-testid="community-unavailable"
  >
    <CircleAlert />
    <AlertTitle class="line-clamp-none">
      {{ $t("settings.catalog.community.unavailable_title") }}
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
</script>
