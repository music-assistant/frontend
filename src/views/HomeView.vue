<template>
  <div>
    <Toolbar
      :is-discover-page="true"
      :icon="Compass"
      color="background"
      :title="$t('discover')"
    />

    <!-- Provider error warning banner -->
    <Alert
      v-if="hasProviderErrors && showProviderWarning"
      variant="destructive"
      class="mx-5 mt-4"
    >
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>
        <div class="provider-warning-content">
          <span>{{ $t("settings.provider_requires_attention_detail") }}</span>
          <div class="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              @click="navigateToProviders"
            >
              {{ $t("settings.fix_now") }}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="showProviderWarning = false"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </AlertTitle>
    </Alert>

    <Container variant="comfortable" class="!pr-0">
      <Suspense>
        <div>
          <HomeWidgetRows :edit-mode="editMode" />
        </div>
        <template #fallback><Spinner class="mx-auto block" /> </template>
      </Suspense>
    </Container>
  </div>
</template>

<script setup lang="ts">
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Container from "@/components/Container.vue";
import HomeWidgetRows from "@/components/HomeWidgetRows.vue";
import Toolbar from "@/components/Toolbar.vue";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { AlertCircle, Compass, X } from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);
const hasProviderErrors = ref(false);
const showProviderWarning = ref(true);
const erroredProviderType = ref<string | null>(null);

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

const handleHomescreenEditToggle = () => {
  editMode.value = !editMode.value;
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
});
</script>

<style scoped>
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
  border: 1px solid hsl(var(--border));
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

@media (max-width: 575px) {
  .container-comfortable {
    padding: 12px;
  }
}
</style>
