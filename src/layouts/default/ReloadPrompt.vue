<script setup lang="ts">
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { useRegisterSW } from "virtual:pwa-register/vue";
import { watch } from "vue";

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW();

// A dashboard display (cast TV, kiosk) has no one to press "reload", so a
// waiting update would leave it running the previous build forever: apply
// updates immediately there instead of prompting. Immediate, in case the
// flag was already set before this watcher registered.
const isDashboardViewer = authManager.isDashboardViewer();
watch(
  needRefresh,
  (refresh) => {
    if (refresh && isDashboardViewer) void updateServiceWorker(true);
  },
  { immediate: true },
);

const close = async () => {
  offlineReady.value = false;
  needRefresh.value = false;
};
</script>

<template>
  <div
    v-if="(offlineReady || needRefresh) && !isDashboardViewer"
    :class="['pwa-toast', { 'pwa-toast--frameless': store.frameless }]"
    role="alert"
  >
    <div class="message">
      <span v-if="offlineReady">{{ $t("offline_ready") }}</span>
      <span v-else>{{ $t("update_available") }}</span>
    </div>
    <button v-if="needRefresh" @click="updateServiceWorker()">
      {{ $t("reload") }}
    </button>
    <button @click="close">{{ $t("close") }}</button>
  </div>
</template>

<style>
.pwa-toast {
  position: fixed;
  /* The margin below sets the gap, so these only have to clear the bars pinned
     to the bottom of the screen and a side cutout. */
  right: var(--device-inset-right);
  bottom: var(--bottom-bars-height);
  margin: 16px;
  padding: 12px;
  border: 1px solid #8885;
  border-radius: 4px;
  /* Renders outside v-app, so this competes with the player bar directly. Just
     enough to clear the bars, leaving everything above them covering it. */
  z-index: 2002;
  text-align: left;
  box-shadow: 3px 4px 5px 0 #8885;
  /* The same tokens the app's other toasts take, so it follows the theme. The
     buttons below inherit the text colour from here. */
  background-color: var(--popover);
  color: var(--popover-foreground);
}

/* Without the app frame there are no bars to clear, only the screen's own
   bottom edge. */
.pwa-toast--frameless {
  bottom: var(--device-inset-bottom);
}

.pwa-toast .message {
  margin-bottom: 8px;
}
.pwa-toast button {
  border: 1px solid #8885;
  outline: none;
  margin-right: 5px;
  border-radius: 2px;
  padding: 3px 10px;
}
</style>
