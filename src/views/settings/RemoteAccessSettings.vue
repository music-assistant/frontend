<template>
  <section>
    <v-card-text>
      <!-- Loading state -->
      <div v-if="loading" class="text-center pa-8">
        <v-progress-circular indeterminate size="64" color="primary" />
      </div>

      <!-- Main content -->
      <div v-else-if="remoteAccessInfo">
        <!-- Header explanation -->
        <v-alert type="info" variant="tonal" class="mb-6">
          <div class="text-h6 mb-3">
            {{ $t("settings.remote_access_title") }}
          </div>
          <p class="text-body-2 mb-2">
            {{ $t("settings.remote_access_explanation_intro") }}
          </p>
          <ul class="text-body-2 ml-4">
            <li>{{ $t("settings.remote_access_feature_webrtc") }}</li>
            <li>{{ $t("settings.remote_access_feature_encrypted") }}</li>
            <li>
              {{ $t("settings.remote_access_feature_no_port_forwarding") }}
            </li>
            <li>
              {{ $t("settings.remote_access_explanation_ha_cloud") }}
            </li>
          </ul>
        </v-alert>

        <!-- Enable/Disable control -->
        <v-card class="mb-6">
          <v-card-title>
            {{ $t("settings.remote_access_status") }}
          </v-card-title>
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" sm="8">
                <div class="text-body-1 mb-2">
                  {{
                    remoteAccessInfo.enabled
                      ? $t("settings.remote_access_enabled")
                      : $t("settings.remote_access_disabled")
                  }}
                </div>
                <div
                  v-if="remoteAccessInfo.enabled"
                  class="text-body-2 text-medium-emphasis"
                >
                  <v-chip
                    :color="remoteAccessInfo.connected ? 'success' : 'warning'"
                    size="small"
                    class="mr-2"
                  >
                    {{
                      remoteAccessInfo.connected
                        ? $t("settings.remote_access_connected")
                        : $t("settings.remote_access_connecting")
                    }}
                  </v-chip>
                  <v-chip
                    :color="
                      remoteAccessInfo.using_ha_cloud ? 'success' : 'default'
                    "
                    size="small"
                    variant="outlined"
                  >
                    {{
                      remoteAccessInfo.using_ha_cloud
                        ? $t("settings.remote_access_mode_optimized")
                        : $t("settings.remote_access_mode_basic")
                    }}
                  </v-chip>
                </div>
              </v-col>
              <v-col cols="12" sm="4" class="text-right">
                <v-switch
                  :model-value="remoteAccessInfo.enabled"
                  :loading="switching"
                  :disabled="switching"
                  color="primary"
                  hide-details
                  @update:model-value="toggleRemoteAccess"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Connection Mode Info - Only show when not using HA Cloud -->
        <v-alert
          v-if="remoteAccessInfo.enabled && !remoteAccessInfo.using_ha_cloud"
          type="warning"
          variant="tonal"
          class="mb-6"
        >
          <div class="text-subtitle-1 font-weight-medium mb-2">
            {{ $t("settings.remote_access_mode_basic") }}
          </div>
          <p class="text-body-2">
            {{ $t("settings.remote_access_mode_basic_description") }}
          </p>
          <v-btn
            color="primary"
            variant="outlined"
            class="mt-3"
            href="https://www.nabucasa.com"
            target="_blank"
          >
            {{ $t("settings.remote_access_upgrade_to_optimized") }}
            <v-icon end>mdi-open-in-new</v-icon>
          </v-btn>
        </v-alert>

        <!-- Remote ID Display -->
        <v-card
          v-if="remoteAccessInfo.enabled && remoteAccessInfo.remote_id"
          class="mb-6"
        >
          <v-card-title>
            {{ $t("settings.remote_access_your_id") }}
          </v-card-title>
          <v-card-text>
            <v-alert type="success" variant="outlined" class="mb-4">
              <div class="text-body-2 mb-3">
                {{ $t("settings.remote_access_id_explanation") }}
              </div>
              <v-text-field
                :model-value="remoteAccessInfo.remote_id"
                readonly
                variant="outlined"
                density="comfortable"
                class="font-weight-bold text-h6 mb-3"
                hide-details
              >
                <template #append-inner>
                  <v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    size="small"
                    :title="$t('settings.remote_access_copy_id')"
                    @click="copyRemoteId"
                  />
                </template>
              </v-text-field>
            </v-alert>

            <!-- Usage instructions -->
            <div class="text-body-2">
              <div class="text-h6 mb-2">
                {{ $t("settings.remote_access_how_to_use") }}
              </div>
              <ol class="ml-4">
                <li>
                  {{ $t("settings.remote_access_step_1") }}
                  <v-btn
                    color="primary"
                    variant="text"
                    size="small"
                    href="https://app.music-assistant.io"
                    target="_blank"
                    class="ml-1"
                  >
                    app.music-assistant.io
                    <v-icon end size="small">mdi-open-in-new</v-icon>
                  </v-btn>
                </li>
                <li class="mt-2">
                  {{ $t("settings.remote_access_step_2") }}
                </li>
                <li class="mt-2">
                  {{ $t("settings.remote_access_step_3") }}
                </li>
              </ol>
            </div>
          </v-card-text>
        </v-card>

        <!-- Technical details -->
        <v-expansion-panels v-if="remoteAccessInfo.enabled">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon start>mdi-information-outline</v-icon>
              {{ $t("settings.remote_access_technical_details") }}
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <!-- Connection Flow Diagram -->
              <div class="my-4">
                <div class="text-subtitle-2 mb-3">
                  {{ $t("settings.remote_access_connection_flow") }}
                </div>
                <v-card variant="outlined" class="pa-4">
                  <img
                    :src="remoteAccessDiagram"
                    alt="Remote Access Connection Flow"
                    style="width: 100%; height: auto; max-width: 800px"
                  />
                </v-card>
              </div>

              <!-- Technical specifications -->
              <v-list density="compact" class="mt-4">
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-access-point-network</v-icon>
                  </template>
                  <v-list-item-title>
                    {{ $t("settings.remote_access_signaling_server") }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{
                      $t("settings.remote_access_signaling_server_description")
                    }}
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-lan-connect</v-icon>
                  </template>
                  <v-list-item-title>
                    {{ $t("settings.remote_access_protocol") }}
                  </v-list-item-title>
                  <v-list-item-subtitle v-if="remoteAccessInfo.using_ha_cloud">
                    {{ $t("settings.remote_access_protocol_optimized") }}
                  </v-list-item-subtitle>
                  <v-list-item-subtitle v-else>
                    {{ $t("settings.remote_access_protocol_basic") }}
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon>mdi-lock</v-icon>
                  </template>
                  <v-list-item-title>
                    {{ $t("settings.remote_access_encryption") }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ $t("settings.remote_access_encryption_description") }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>

      <!-- Error state -->
      <v-alert v-else type="error" variant="tonal">
        {{ $t("settings.remote_access_error_loading") }}
      </v-alert>
    </v-card-text>

    <!-- Snackbar for copy confirmation -->
    <v-snackbar v-model="showCopySnackbar" :timeout="2000" color="success">
      {{ $t("settings.remote_access_id_copied") }}
    </v-snackbar>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { api } from "@/plugins/api";
import type { RemoteAccessInfo } from "@/plugins/api/interfaces";
import { toast } from "vuetify-sonner";
import { useI18n } from "vue-i18n";
import remoteAccessDiagram from "@/assets/remote-access-diagram.svg";

const { t } = useI18n();

const loading = ref(true);
const switching = ref(false);
const remoteAccessInfo = ref<RemoteAccessInfo | null>(null);
const showCopySnackbar = ref(false);
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

  try {
    await navigator.clipboard.writeText(remoteAccessInfo.value.remote_id);
    showCopySnackbar.value = true;
  } catch (error) {
    console.error("Error copying remote ID:", error);
    toast.error(t("settings.remote_access_error_copy"));
  }
};
</script>

<style scoped>
.font-weight-bold {
  font-weight: 600;
}
</style>
