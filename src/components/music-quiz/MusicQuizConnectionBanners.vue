<template>
  <Alert v-if="degraded" variant="warning" role="status">
    <Loader2 class="size-4 animate-spin" />
    <AlertTitle>{{ $t("providers.music_quiz.connection_lost") }}</AlertTitle>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertTitle } from "@/components/ui/alert";
import { $t } from "@/plugins/i18n";
import { Loader2 } from "@lucide/vue";

defineProps<{ degraded: boolean }>();
</script>
