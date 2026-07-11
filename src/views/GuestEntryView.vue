<template>
  <main class="grid min-h-dvh place-items-center p-4">
    <Card class="w-full max-w-md">
      <CardHeader class="items-center text-center">
        <CircleHelp class="text-muted-foreground size-10" />
        <CardTitle>{{ copy.title }}</CardTitle>
        <CardDescription>{{ copy.description }}</CardDescription>
      </CardHeader>
    </Card>
  </main>
</template>

<script setup lang="ts">
import { guestEntryStateKey } from "@/composables/useGuestEntryResolver";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { $t } from "@/plugins/i18n";
import { CircleHelp } from "@lucide/vue";
import { computed, inject, ref } from "vue";

const state = inject(guestEntryStateKey, ref("loading"));
const copy = computed(() => {
  if (state.value === "loading") {
    return {
      title: $t("guest.loading_title"),
      description: $t("guest.loading_description"),
    };
  }
  if (state.value === "quiz-inactive") {
    return {
      title: $t("guest.no_quiz_title"),
      description: $t("guest.no_quiz_description"),
    };
  }
  return {
    title: $t("guest.nothing_active_title"),
    description: $t("guest.nothing_active_description"),
  };
});
</script>
