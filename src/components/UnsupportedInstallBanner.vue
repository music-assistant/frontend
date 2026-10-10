<template>
  <Alert
    v-if="api.serverInfo.value?.unsupported_install"
    variant="destructive"
    role="alert"
  >
    <TriangleAlert />
    <AlertTitle>{{ $t("settings.unsupported_install_title") }}</AlertTitle>
    <AlertDescription>
      {{ $t("settings.unsupported_install_description") }}
    </AlertDescription>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { TriangleAlert } from "@lucide/vue";
</script>
