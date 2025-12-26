<template>
  <div>
    <Container variant="comfortable">
      <!-- Header -->
      <v-toolbar color="transparent" class="header mb-4" height="auto">
        <template #title>
          <div class="flex flex-col justify-center py-2">
            <span class="text-h5 font-weight-bold">
              Welcome back,
              {{
                store.currentUser?.display_name?.split(" ")[0] ||
                store.currentUser?.username
              }}
            </span>
            <span class="text-subtitle-1 text-medium-emphasis mt-1">
              {{ subTitle }}
            </span>
          </div>
        </template>
        <template #append>
          <v-btn
            :icon="editMode ? 'mdi-check' : 'mdi-pencil'"
            variant="text"
            @click="editMode = !editMode"
          />
        </template>
      </v-toolbar>

      <!-- Provider error warning banner -->
      <v-alert
        v-if="hasProviderErrors && showProviderWarning"
        variant="outlined"
        type="error"
        icon="mdi-alert-circle"
        prominent
        class="mb-4"
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
import { api } from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);
const hasProviderErrors = ref(false);
const showProviderWarning = ref(true);

const timeGreeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
});

const subTitle = computed(() => {
  const parts = [];
  if (
    store.activePlayer?.display_name &&
    store.activePlayer?.playback_state === PlaybackState.PLAYING
  ) {
    parts.push(`Listening on ${store.activePlayer.display_name}`);
  }
  parts.push(timeGreeting.value);
  return parts.join(" • ");
});

const navigateToProviders = () => {
  router.push("/settings/providers");
};

onMounted(async () => {
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
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
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

.header.v-toolbar :deep(.v-toolbar-title) {
  margin-inline-start: 0px;
  font-size: x-large;
  font-weight: bold;
}
</style>
