<template>
  <div class="bg-background flex h-dvh flex-col overflow-hidden">
    <header
      class="flex h-12 shrink-0 items-center justify-center border-b px-4"
    >
      <img :src="logoSrc" alt="Music Assistant" class="h-6 w-auto opacity-85" />
    </header>
    <main class="min-h-0 flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  guestEntryStateKey,
  useGuestEntryResolver,
} from "@/composables/useGuestEntryResolver";
import { computed, provide } from "vue";
import { useTheme } from "vuetify";

const { state } = useGuestEntryResolver();
provide(guestEntryStateKey, state);

const theme = useTheme();
const logoSrc = computed(() =>
  theme.current.value.dark
    ? new URL("@/assets/logo/logo.svg", import.meta.url).href
    : new URL("@/assets/logo/logo-dark.svg", import.meta.url).href,
);
</script>
