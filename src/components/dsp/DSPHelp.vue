<template>
  <div class="px-4 pb-4">
    <!-- role="note": these are static explanations, not announcements. -->
    <Alert variant="info" role="note">
      <Info />
      <AlertDescription>{{ text }}</AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { Info } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";

defineProps<{ text: string }>();
</script>
