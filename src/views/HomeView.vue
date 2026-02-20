<template>
  <div>
    <Toolbar
      :show-loading="true"
      :home="true"
      :icon="House"
      color="background"
      :title="$t('home')"
    />

    <!-- Provider error warning banner -->
    <v-alert
      v-if="hasProviderErrors && showProviderWarning"
      variant="outlined"
      type="error"
      icon="mdi-alert-circle"
      prominent
      class="mx-5 mt-4"
      closable
      @click:close="showProviderWarning = false"
    >
      <div class="provider-warning-content">
        <span>{{ $t("settings.provider_requires_attention_detail") }}</span>
        <v-btn
          size="small"
          color="error"
          variant="flat"
          @click="navigateToProviders"
        >
          {{ $t("settings.fix_now") }}
        </v-btn>
      </div>
    </v-alert>

    <Container variant="comfortable">
      <Suspense>
        <div>
          <HomeWidgetRows :edit-mode="editMode" />
        </div>
        <template #fallback><v-progress-circular indeterminate /> </template>
      </Suspense>

      <!-- Debug panel to understand HA ingress, kiosk mode and mobile layout behaviour -->
      <div class="debug-panel">
        <h3>Environment debug</h3>
        <p><strong>store.deviceType</strong>: {{ store.deviceType }}</p>
        <p><strong>store.mobileLayout</strong>: {{ store.mobileLayout }}</p>
        <p>
          <strong>store.isIngressSession</strong>: {{ store.isIngressSession }}
        </p>
        <p>
          <strong>window.externalApp in window</strong>: {{ hasExternalApp }}
        </p>
        <p><strong>HA properties.narrow</strong>: {{ haNarrow }}</p>
        <p><strong>HA properties.route</strong>: {{ haRoute }}</p>
        <p>
          <strong>last "mobile-sidebar-open" event</strong>:
          {{ lastMobileSidebarEvent || "never" }}
        </p>
        <p><strong>navigator.userAgent</strong>:</p>
        <pre class="debug-ua">{{ userAgent }}</pre>
      </div>
    </Container>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import HomeWidgetRows from "@/components/HomeWidgetRows.vue";
import Toolbar from "@/components/Toolbar.vue";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { haState } from "@/plugins/homeassistant";
import { store } from "@/plugins/store";
import { House } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);
const hasProviderErrors = ref(false);
const showProviderWarning = ref(true);

// Simple environment + HA diagnostics to compare Chrome vs HA companion app
const userAgent = computed(() =>
  typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
);
const hasExternalApp = computed(
  () => typeof window !== "undefined" && "externalApp" in window,
);

const haNarrow = computed(() => haState.properties.narrow);
const haRoute = computed(() =>
  haState.properties.route ? JSON.stringify(haState.properties.route) : "null",
);

// When the bottom navigation emits "mobile-sidebar-open", track it here so it's
// visible on the home page even without devtools.
const lastMobileSidebarEvent = ref<string | null>(null);

const handleLogout = () => {
  authManager.logout();
};

const navigateToProviders = () => {
  router.push("/settings/providers");
};

const handleHomescreenEditToggle = () => {
  editMode.value = !editMode.value;
};

onMounted(async () => {
  eventbus.on("homescreen-edit-toggle", handleHomescreenEditToggle);
  eventbus.on("mobile-sidebar-open", () => {
    lastMobileSidebarEvent.value = new Date().toISOString();
  });

  if (authManager.isAdmin()) {
    try {
      const configs = await api.getProviderConfigs();
      hasProviderErrors.value = configs.some(
        (config) => config.enabled && config.last_error,
      );
    } catch {
      // Ignore errors - this is a best-effort feature
    }
  }
});

onUnmounted(() => {
  eventbus.off("homescreen-edit-toggle", handleHomescreenEditToggle);
  eventbus.off("mobile-sidebar-open", () => {
    lastMobileSidebarEvent.value = new Date().toISOString();
  });
});
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}

.editButton {
  float: right;
  margin-bottom: 10px;
}

.avatar-trigger {
  cursor: pointer;
  margin-right: 8px;
}

.avatar-trigger:hover {
  opacity: 0.9;
}

.user-avatar {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.provider-warning-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.user-header-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px;
  background-color: hsl(var(--muted) / 0.3);
  border-radius: calc(var(--radius) - 2px);
  margin-bottom: 4px;
}

.debug-panel {
  margin-top: 2rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--muted) / 0.4);
  font-size: 0.85rem;
  line-height: 1.4;
  word-break: break-all;
}

.debug-panel h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.debug-ua {
  white-space: pre-wrap;
  margin: 0.25rem 0 0;
}

@media (max-width: 600px) {
  .provider-warning-content {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
