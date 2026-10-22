<template>
  <Alert v-if="degraded" variant="warning" role="status">
    <!-- decorative: the Alert already carries the status role -->
    <Spinner aria-hidden="true" />
    <AlertTitle>{{ $t("providers.music_quiz.connection_lost") }}</AlertTitle>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { $t } from "@/plugins/i18n";

defineProps<{ degraded: boolean }>();
</script>
