<template>
  <div class="ed-discover">
    <Toolbar
      :is-discover-page="true"
      :icon="Compass"
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

    <HomeWidgetRows :edit-mode="editMode" />

    <!-- Floating exit button while editing the home screen -->
    <Button
      v-if="editMode"
      class="ed-edit-done"
      @click="handleHomescreenEditToggle"
    >
      <Check class="size-4" />
      {{ $t("homescreen_edit_disable") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import HomeWidgetRows from "@/components/HomeWidgetRows.vue";
import Toolbar from "@/components/Toolbar.vue";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check, Compass } from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);
const hasProviderErrors = ref(false);
const showProviderWarning = ref(true);
const erroredProviderType = ref<string | null>(null);

const handleHomescreenEditToggle = () => {
  editMode.value = !editMode.value;
  store.homescreenEditMode = editMode.value;
};

const navigateToProviders = () => {
  if (erroredProviderType.value) {
    router.push({
      name: "providersettings",
      query: { types: erroredProviderType.value },
    });
  } else {
    router.push({ name: "settings" });
  }
};

onMounted(async () => {
  eventbus.on("homescreen-edit-toggle", handleHomescreenEditToggle);

  if (authManager.isAdmin()) {
    try {
      const configs = await api.getProviderConfigs();
      const firstError = configs.find(
        (config) => config.enabled && config.last_error,
      );
      hasProviderErrors.value = !!firstError;
      erroredProviderType.value = firstError?.type ?? null;
    } catch {
      // Ignore errors - this is a best-effort feature
    }
  }
});

onUnmounted(() => {
  eventbus.off("homescreen-edit-toggle", handleHomescreenEditToggle);
  store.homescreenEditMode = false;
});
</script>

<style scoped>
.ed-discover {
  background:
    radial-gradient(
      1200px 600px at 20% -10%,
      rgba(var(--v-theme-primary), 0.1),
      transparent 60%
    ),
    rgb(var(--v-theme-background));
  min-height: 100%;
}

.ed-edit-done {
  position: fixed;
  right: 24px;
  top: 24px;
  z-index: 1000;
  border-radius: 999px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.provider-warning-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

@media (max-width: 600px) {
  .provider-warning-content {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
