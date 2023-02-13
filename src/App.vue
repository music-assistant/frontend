<template>
  <router-view />
</template>

<script setup lang="ts">
import { api } from "./plugins/api";
import { onMounted } from "vue";
import { useTheme } from "vuetify";

const theme = useTheme();

onMounted(() => {
  
  // enable dark mode based on OS/browser config
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (event) => {
      const newColorScheme = event.matches ? "dark" : "light";
      theme.global.name.value = newColorScheme;
    });

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    // dark mode is enabled
    theme.global.name.value = "dark";
  }

  // Initialize API Connection
  // TODO: retrieve serveraddress through discovery and/or user settings ?
  let serverAddress = "";
  if (process.env.NODE_ENV === "production") {
    const loc = window.location;
    serverAddress = loc.origin + loc.pathname;
  } else {
    serverAddress = window.location.origin.replace('3000','8095');
  }
  api.initialize(serverAddress);
});
</script>

<style></style>
