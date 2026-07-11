<template>
  <div class="h-dvh overflow-y-auto">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import {
  guestEntryStateKey,
  useGuestEntryResolver,
} from "@/composables/useGuestEntryResolver";
import { provide } from "vue";

const { state } = useGuestEntryResolver();
provide(guestEntryStateKey, state);
</script>
