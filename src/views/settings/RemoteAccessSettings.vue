<template>
  <Container>
    <div v-if="loading" class="loading-wrapper">
      <v-progress-circular indeterminate size="64" color="primary" />
    </div>
    <div v-else-if="remoteAccessInfo" class="remote-access-wrapper">
      <v-card class="hero-card mb-6" elevation="0" rounded="lg">
        <v-card-item class="hero-content">
          <div class="hero-icon-wrapper">
            <v-icon size="48" color="primary">mdi-cloud-lock</v-icon>
          </div>
          <v-card-title class="hero-title">
            {{ $t("settings.remote_access_title") }}
          </v-card-title>
          <p class="hero-description">
            {{ $t("settings.remote_access_explanation_intro") }}
          </p>
          <div class="feature-grid">
            <div class="feature-item">
              <v-icon size="20" color="primary">mdi-check-circle</v-icon>
              <span>{{ $t("settings.remote_access_feature_webrtc") }}</span>
            </div>
            <div class="feature-item">
              <v-icon size="20" color="primary">mdi-check-circle</v-icon>
              <span>{{ $t("settings.remote_access_feature_encrypted") }}</span>
            </div>
            <div class="feature-item">
              <v-icon size="20" color="primary">mdi-check-circle</v-icon>
              <span>
                {{ $t("settings.remote_access_feature_no_port_forwarding") }}
              </span>
            </div>
            <div class="feature-item">
              <v-icon size="20" color="primary">mdi-check-circle</v-icon>
              <span>
                {{ $t("settings.remote_access_explanation_ha_cloud") }}
              </span>
            </div>
          </div>
        </v-card-item>
      </v-card>

      <v-card class="status-card mb-6" elevation="0" rounded="lg">
        <v-card-item class="status-header">
          <div class="d-flex align-center justify-space-between w-100">
            <div>
              <v-card-title class="status-title">
                {{ $t("settings.remote_access_status") }}
              </v-card-title>
              <div class="status-text">
                {{
                  remoteAccessInfo.enabled
                    ? $t("settings.remote_access_enabled")
                    : $t("settings.remote_access_disabled")
                }}
              </div>
            </div>
            <v-switch
              :model-value="remoteAccessInfo.enabled"
              :loading="switching"
              :disabled="switching"
              color="primary"
              hide-details
              class="status-switch"
              @update:model-value="toggleRemoteAccess"
            />
          </div>
        </v-card-item>
        <v-card-text v-if="remoteAccessInfo.enabled" class="status-badges">
          <v-chip
            :color="remoteAccessInfo.connected ? 'success' : 'warning'"
            size="default"
            variant="flat"
            class="status-chip"
          >
            {{
              remoteAccessInfo.connected
                ? $t("settings.remote_access_connected")
                : $t("settings.remote_access_connecting")
            }}
          </v-chip>
          <v-chip
            :color="remoteAccessInfo.using_ha_cloud ? 'success' : 'default'"
            size="default"
            variant="outlined"
            class="status-chip"
          >
            {{
              remoteAccessInfo.using_ha_cloud
                ? $t("settings.remote_access_mode_optimized")
                : $t("settings.remote_access_mode_basic")
            }}
          </v-chip>
        </v-card-text>
      </v-card>

      <v-card
        v-if="remoteAccessInfo.enabled && !remoteAccessInfo.using_ha_cloud"
        class="upgrade-card mb-6"
        elevation="0"
        rounded="lg"
      >
        <v-card-item class="upgrade-content">
          <v-icon size="60" color="primary" class="upgrade-icon">
            mdi-cloud-alert
          </v-icon>
          <v-card-title class="upgrade-title">
            {{ $t("settings.remote_access_mode_basic") }}
          </v-card-title>
          <p class="upgrade-description">
            {{ $t("settings.remote_access_mode_basic_description") }}
          </p>
          <v-btn
            color="primary"
            variant="elevated"
            size="large"
            class="upgrade-button"
            href="https://www.nabucasa.com"
            target="_blank"
          >
            {{ $t("settings.remote_access_upgrade_to_optimized") }}
            <v-icon end>mdi-open-in-new</v-icon>
          </v-btn>
        </v-card-item>
      </v-card>

      <v-card
        v-if="remoteAccessInfo.enabled && remoteAccessInfo.remote_id"
        class="remote-id-card mb-6"
        elevation="0"
        rounded="lg"
      >
        <v-card-item class="remote-id-header">
          <v-icon size="28" color="primary" class="mr-2">mdi-identifier</v-icon>
          <v-card-title class="remote-id-title">
            {{ $t("settings.remote_access_your_id") }}
          </v-card-title>
        </v-card-item>
        <v-card-text class="remote-id-content">
          <p class="remote-id-explanation">
            {{ $t("settings.remote_access_id_explanation") }}
          </p>
          <div class="remote-id-display-wrapper">
            <div class="remote-id-display">
              <code class="remote-id-text">
                {{ remoteAccessInfo.remote_id }}
              </code>
              <v-btn
                icon="mdi-content-copy"
                variant="text"
                size="small"
                color="primary"
                class="copy-button"
                :title="$t('settings.remote_access_copy_id')"
                @click="copyRemoteId"
              />
            </div>
          </div>

          <div>
            <div class="usage-title">
              {{ $t("settings.remote_access_how_to_use") }}
            </div>
            <div class="steps-list">
              <div class="step-item">
                <div class="step-number">1</div>
                <div class="step-content">
                  {{ $t("settings.remote_access_step_1") }}
                  <v-btn
                    color="primary"
                    variant="text"
                    size="small"
                    href="https://app.music-assistant.io"
                    target="_blank"
                    class="step-link"
                  >
                    app.music-assistant.io
                    <v-icon end size="small">mdi-open-in-new</v-icon>
                  </v-btn>
                </div>
              </div>
              <div class="step-item">
                <div class="step-number">2</div>
                <div class="step-content">
                  {{ $t("settings.remote_access_step_2") }}
                </div>
              </div>
              <div class="step-item">
                <div class="step-number">3</div>
                <div class="step-content">
                  {{ $t("settings.remote_access_step_3") }}
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Technical Details -->
      <v-expansion-panels
        v-if="remoteAccessInfo.enabled"
        class="technical-panels"
      >
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-icon start>mdi-information-outline</v-icon>
            {{ $t("settings.remote_access_technical_details") }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <!-- Connection Flow Diagram -->
            <div class="diagram-section">
              <div class="diagram-title">
                {{ $t("settings.remote_access_connection_flow") }}
              </div>
              <v-card variant="outlined" class="diagram-card">
                <img
                  :src="remoteAccessDiagram"
                  alt="Remote Access Connection Flow"
                  class="diagram-image"
                />
              </v-card>
            </div>

            <!-- Technical Specifications -->
            <div class="specs-section">
              <div class="spec-item">
                <v-avatar
                  size="48"
                  color="primary"
                  variant="tonal"
                  class="spec-icon"
                >
                  <v-icon>mdi-access-point-network</v-icon>
                </v-avatar>
                <div class="spec-content">
                  <div class="spec-title">
                    {{ $t("settings.remote_access_signaling_server") }}
                  </div>
                  <div class="spec-description">
                    {{
                      $t("settings.remote_access_signaling_server_description")
                    }}
                  </div>
                </div>
              </div>
              <div class="spec-item">
                <v-avatar
                  size="48"
                  color="primary"
                  variant="tonal"
                  class="spec-icon"
                >
                  <v-icon>mdi-lan-connect</v-icon>
                </v-avatar>
                <div class="spec-content">
                  <div class="spec-title">
                    {{ $t("settings.remote_access_protocol") }}
                  </div>
                  <div class="spec-description">
                    <span v-if="remoteAccessInfo.using_ha_cloud">
                      {{ $t("settings.remote_access_protocol_optimized") }}
                    </span>
                    <span v-else>
                      {{ $t("settings.remote_access_protocol_basic") }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="spec-item">
                <v-avatar
                  size="48"
                  color="primary"
                  variant="tonal"
                  class="spec-icon"
                >
                  <v-icon>mdi-lock</v-icon>
                </v-avatar>
                <div class="spec-content">
                  <div class="spec-title">
                    {{ $t("settings.remote_access_encryption") }}
                  </div>
                  <div class="spec-description">
                    {{ $t("settings.remote_access_encryption_description") }}
                  </div>
                </div>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>

    <!-- Error state -->
    <v-alert v-else type="error" variant="tonal" class="error-alert">
      {{ $t("settings.remote_access_error_loading") }}
    </v-alert>
  </Container>
</template>

<script setup lang="ts">
import remoteAccessDiagram from "@/assets/remote-access-diagram.svg";
import Container from "@/components/Container.vue";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { RemoteAccessInfo } from "@/plugins/api/interfaces";
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const loading = ref(true);
const switching = ref(false);
const remoteAccessInfo = ref<RemoteAccessInfo | null>(null);
let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await loadRemoteAccessInfo();
  pollInterval = setInterval(async () => {
    await loadRemoteAccessInfo(true);
  }, 5000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});

const loadRemoteAccessInfo = async (silent = false) => {
  if (!silent) {
    loading.value = true;
  }
  try {
    remoteAccessInfo.value = await api.getRemoteAccessInfo();
  } catch (error) {
    console.error("Error loading remote access info:", error);
    if (!silent) {
      toast.error(t("settings.remote_access_error_loading"));
    }
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
};

const toggleRemoteAccess = async (enabled: boolean | null) => {
  if (!remoteAccessInfo.value || enabled === null) return;

  switching.value = true;
  try {
    remoteAccessInfo.value = await api.configureRemoteAccess(enabled);
    toast.success(
      enabled
        ? t("settings.remote_access_enabled_success")
        : t("settings.remote_access_disabled_success"),
    );
  } catch (error) {
    console.error("Error toggling remote access:", error);
    toast.error(t("settings.remote_access_error_toggle"));
  } finally {
    switching.value = false;
  }
};

const copyRemoteId = async () => {
  if (!remoteAccessInfo.value?.remote_id) return;

  const success = await copyToClipboard(remoteAccessInfo.value.remote_id);
  if (success) {
    toast.success(t("settings.remote_access_id_copied"));
  } else {
    toast.error(t("settings.remote_access_error_copy"));
  }
};
</script>

<style scoped>
.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.remote-access-wrapper {
  padding: 24px 0;
}

.hero-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.hero-content {
  padding: 32px;
  position: relative;
  z-index: 1;
}

.hero-icon-wrapper {
  margin-bottom: 16px;
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: rgb(var(--v-theme-on-surface));
}

.hero-description {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 24px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.feature-item .v-icon {
  color: rgb(var(--v-theme-primary));
}

.status-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.status-header {
  padding: 24px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.status-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.status-text {
  font-size: 1rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.status-switch {
  flex-shrink: 0;
}

.status-badges {
  padding: 20px 24px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.status-chip {
  font-weight: 500;
}

.upgrade-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.upgrade-content {
  padding: 32px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.upgrade-icon {
  margin-bottom: 16px;
  color: rgb(var(--v-theme-primary));
}

.upgrade-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.upgrade-description {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.8);
  margin-bottom: 24px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.upgrade-button {
  margin-top: 8px;
}

.remote-id-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.remote-id-header {
  padding: 20px 20px 0 20px;
  display: flex;
  align-items: center;
}

.remote-id-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.remote-id-content {
  padding: 20px;
}

.remote-id-explanation {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 16px;
  line-height: 1.5;
}

.remote-id-display-wrapper {
  margin-bottom: 24px;
}

.remote-id-display {
  background: rgba(var(--v-theme-surface), 0.8);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: all 0.2s ease;
}

.remote-id-display:hover {
  border-color: rgba(var(--v-theme-primary), 0.3);
  background: rgba(var(--v-theme-surface), 1);
}

.remote-id-text {
  font-family: "JetBrains Mono", "Courier New", monospace;
  font-size: 1.1rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-all;
  flex: 1;
}

.copy-button {
  flex-shrink: 0;
}

.usage-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: rgb(var(--v-theme-on-surface));
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.8);
  padding-top: 6px;
}

.step-link {
  margin-left: 4px;
}

.technical-panels {
  margin-bottom: 24px;
}

.diagram-section {
  margin: 24px 0;
}

.diagram-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: rgb(var(--v-theme-on-surface));
}

.diagram-card {
  border-radius: 8px;
  padding: 24px;
}

.diagram-image {
  width: 100%;
  height: auto;
  max-width: 800px;
  display: block;
  margin: 0 auto;
  border-radius: 4px;
}

.specs-section {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.spec-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.3);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: all 0.2s ease;
}

.spec-item:hover {
  background: rgba(var(--v-theme-surface), 0.5);
  border-color: rgba(var(--v-theme-primary), 0.2);
}

.spec-icon {
  flex-shrink: 0;
}

.spec-content {
  flex: 1;
}

.spec-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
  color: rgb(var(--v-theme-on-surface));
}

.spec-description {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.5;
}

.error-alert {
  margin: 24px;
}

@media (max-width: 960px) {
  .hero-content {
    padding: 24px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .status-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .status-switch {
    width: 100%;
    justify-content: flex-start;
  }

  .remote-id-text {
    font-size: 1.1rem;
  }

  .step-item {
    gap: 12px;
  }

  .step-number {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }
}
</style>
