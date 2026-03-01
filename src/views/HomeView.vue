<template>
  <div>
    <Toolbar
      :is-discover-page="true"
      :icon="House"
      color="background"
      :title="$t('discover')"
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
import { House } from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);
const hasProviderErrors = ref(false);
const showProviderWarning = ref(true);

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

@media (max-width: 600px) {
  .provider-warning-content {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
