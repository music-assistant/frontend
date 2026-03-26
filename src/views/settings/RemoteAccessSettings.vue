<template>
  <Container>
    <div v-if="loading" class="loading-wrapper">
      <Spinner class="size-16 text-primary" />
    </div>
    <div v-else-if="remoteAccessInfo" class="remote-access-wrapper">
      <Card class="hero-card mb-6">
        <CardContent class="hero-content">
          <div class="hero-icon-wrapper">
            <ShieldCheck class="size-12 text-primary" />
          </div>
          <CardTitle class="hero-title">
            {{ $t("settings.remote_access_title") }}
          </CardTitle>
          <p class="hero-description">
            {{ $t("settings.remote_access_explanation_intro") }}
          </p>
          <div class="feature-grid">
            <div class="feature-item">
              <CheckCircle class="size-5 text-primary shrink-0" />
              <span>{{ $t("settings.remote_access_feature_webrtc") }}</span>
            </div>
            <div class="feature-item">
              <CheckCircle class="size-5 text-primary shrink-0" />
              <span>{{ $t("settings.remote_access_feature_encrypted") }}</span>
            </div>
            <div class="feature-item">
              <CheckCircle class="size-5 text-primary shrink-0" />
              <span>
                {{ $t("settings.remote_access_feature_no_port_forwarding") }}
              </span>
            </div>
            <div class="feature-item">
              <CheckCircle class="size-5 text-primary shrink-0" />
              <span>
                {{ $t("settings.remote_access_explanation_ha_cloud") }}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="status-card mb-6">
        <CardContent class="status-header">
          <div class="flex items-center justify-between w-full">
            <div>
              <CardTitle class="status-title">
                {{ $t("settings.remote_access_status") }}
              </CardTitle>
              <div class="status-text">
                {{
                  remoteAccessInfo.enabled
                    ? $t("settings.remote_access_enabled")
                    : $t("settings.remote_access_disabled")
                }}
              </div>
            </div>
            <Switch
              :checked="remoteAccessInfo.enabled"
              :disabled="switching"
              class="status-switch"
              @update:checked="toggleRemoteAccess"
            />
          </div>
        </CardContent>
        <CardContent v-if="remoteAccessInfo.enabled" class="status-badges">
          <Badge
            :variant="remoteAccessInfo.connected ? 'default' : 'warning'"
            class="status-chip"
          >
            {{
              remoteAccessInfo.connected
                ? $t("settings.remote_access_connected")
                : $t("settings.remote_access_connecting")
            }}
          </Badge>
          <Badge
            :variant="remoteAccessInfo.using_ha_cloud ? 'default' : 'outline'"
            class="status-chip"
          >
            {{
              remoteAccessInfo.using_ha_cloud
                ? $t("settings.remote_access_mode_optimized")
                : $t("settings.remote_access_mode_basic")
            }}
          </Badge>
        </CardContent>
      </Card>

      <Card
        v-if="remoteAccessInfo.enabled && !remoteAccessInfo.using_ha_cloud"
        class="upgrade-card mb-6"
      >
        <CardContent class="upgrade-content">
          <CloudAlert class="size-16 text-primary upgrade-icon" />
          <CardTitle class="upgrade-title">
            {{ $t("settings.remote_access_mode_basic") }}
          </CardTitle>
          <p class="upgrade-description">
            {{ $t("settings.remote_access_mode_basic_description") }}
          </p>
          <Button
            size="lg"
            class="upgrade-button"
            as="a"
            href="https://www.nabucasa.com"
            target="_blank"
          >
            {{ $t("settings.remote_access_upgrade_to_optimized") }}
            <ExternalLink class="size-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      <!-- Two-card layout for ID and QR code -->
      <div
        v-if="remoteAccessInfo.enabled && remoteAccessInfo.remote_id"
        class="remote-id-grid mb-6"
      >
        <!-- Text ID Card -->
        <Card class="remote-id-card">
          <CardContent class="remote-id-header">
            <Hash class="size-7 text-primary mr-2" />
            <CardTitle class="remote-id-title">
              {{ $t("settings.remote_access_your_id") }}
            </CardTitle>
          </CardContent>
          <CardContent class="remote-id-content">
            <p class="remote-id-explanation">
              {{ $t("settings.remote_access_id_explanation") }}
            </p>
            <div class="remote-id-display-wrapper">
              <div class="remote-id-boxes">
                <div
                  v-for="(part, index) in remoteIdParts"
                  :key="index"
                  class="remote-id-box"
                  :class="`remote-id-box-${index}`"
                >
                  <code class="remote-id-box-text">{{ part }}</code>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="$t('settings.remote_access_copy_id')"
                @click="copyRemoteId"
              >
                <Copy class="size-4 text-primary" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- QR Code Card -->
        <Card class="remote-id-card">
          <CardContent class="remote-id-header">
            <QrCode class="size-7 text-primary mr-2" />
            <CardTitle class="remote-id-title">
              {{ $t("settings.remote_access_qr_code") }}
            </CardTitle>
          </CardContent>
          <CardContent class="remote-id-content">
            <p class="remote-id-explanation">
              {{ $t("settings.remote_access_qr_code_description") }}
            </p>
            <div class="qr-code-wrapper">
              <img
                v-if="qrCodeDataUrl"
                :src="qrCodeDataUrl"
                alt="Remote ID QR Code"
                class="qr-code-image"
              />
              <Spinner v-else class="size-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        v-if="remoteAccessInfo.enabled && remoteAccessInfo.remote_id"
        class="usage-card mb-6"
      >
        <CardContent class="usage-content">
          <div>
            <div class="usage-title">
              {{ $t("settings.remote_access_how_to_use") }}
            </div>
            <div class="steps-list">
              <div class="step-item">
                <div class="step-number">1</div>
                <div class="step-content">
                  {{ $t("settings.remote_access_step_1") }}
                  <a
                    href="https://app.music-assistant.io"
                    target="_blank"
                    class="text-primary text-sm ml-1 inline-flex items-center gap-1"
                  >
                    app.music-assistant.io
                    <ExternalLink class="size-3" />
                  </a>
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
        </CardContent>
      </Card>

      <!-- Technical Details -->
      <Accordion
        v-if="remoteAccessInfo.enabled"
        type="single"
        collapsible
        class="technical-panels"
      >
        <AccordionItem value="technical">
          <AccordionTrigger>
            <div class="flex items-center gap-2">
              <Info class="size-5" />
              {{ $t("settings.remote_access_technical_details") }}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <!-- Connection Flow Diagram -->
            <div class="diagram-section">
              <div class="diagram-title">
                {{ $t("settings.remote_access_connection_flow") }}
              </div>
              <Card variant="outline" class="diagram-card">
                <img
                  :src="remoteAccessDiagram"
                  alt="Remote Access Connection Flow"
                  class="diagram-image"
                />
              </Card>
            </div>

            <!-- Technical Specifications -->
            <div class="specs-section">
              <div class="spec-item">
                <div class="spec-icon flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary shrink-0">
                  <Network class="size-6" />
                </div>
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
                <div class="spec-icon flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary shrink-0">
                  <Cable class="size-6" />
                </div>
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
                <div class="spec-icon flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary shrink-0">
                  <Lock class="size-6" />
                </div>
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>

    <!-- Error state -->
    <div v-else class="error-alert rounded-lg border border-destructive/50 bg-destructive/10 p-4 m-6 text-destructive">
      {{ $t("settings.remote_access_error_loading") }}
    </div>
  </Container>
</template>

<script setup lang="ts">
import remoteAccessDiagram from "@/assets/remote-access-diagram.svg";
import Container from "@/components/Container.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { RemoteAccessInfo } from "@/plugins/api/interfaces";
import {
  Cable,
  CheckCircle,
  ShieldCheck,
  CloudAlert,
  Copy,
  ExternalLink,
  Hash,
  Info,
  Lock,
  Network,
  QrCode,
} from "lucide-vue-next";
import QRCode from "qrcode";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t } = useI18n();

const loading = ref(true);
const switching = ref(false);
const remoteAccessInfo = ref<RemoteAccessInfo | null>(null);
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Split remote ID into 4 parts: 8-5-5-8 characters
const remoteIdLengths = [8, 5, 5, 8];
const remoteIdParts = computed(() => {
  const id = remoteAccessInfo.value?.remote_id || "";
  const parts: string[] = [];
  let offset = 0;
  for (const len of remoteIdLengths) {
    parts.push(id.slice(offset, offset + len));
    offset += len;
  }
  return parts;
});

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

const toggleRemoteAccess = async (enabled: boolean) => {
  if (!remoteAccessInfo.value) return;

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

  // Format with dashes for user-friendly sharing
  const formattedId = remoteIdParts.value.join("-");
  const success = await copyToClipboard(formattedId);
  if (success) {
    toast.success(t("settings.remote_access_id_copied"));
  } else {
    toast.error(t("settings.remote_access_error_copy"));
  }
};

// QR Code generation
const qrCodeDataUrl = ref<string | null>(null);

const generateQrCode = async (remoteId: string) => {
  if (!remoteId) {
    qrCodeDataUrl.value = null;
    return;
  }

  try {
    // Generate QR code with the remote ID
    // The QR code contains a URL that will auto-fill the remote ID on the login page
    const qrData = `https://app.music-assistant.io/?remote_id=${remoteId}`;
    qrCodeDataUrl.value = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    qrCodeDataUrl.value = null;
  }
};

// Watch for remote ID changes and regenerate QR code
watch(
  () => remoteAccessInfo.value?.remote_id,
  (newRemoteId) => {
    if (newRemoteId) {
      generateQrCode(newRemoteId);
    } else {
      qrCodeDataUrl.value = null;
    }
  },
  { immediate: true },
);
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
}

.hero-description {
  font-size: 1rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
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
  color: hsl(var(--muted-foreground));
}

.status-header {
  padding: 24px;
  border-bottom: 1px solid hsl(var(--border));
}

.status-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.status-text {
  font-size: 1rem;
  color: hsl(var(--muted-foreground));
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

.upgrade-content {
  padding: 32px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.upgrade-icon {
  margin-bottom: 16px;
}

.upgrade-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.upgrade-description {
  font-size: 1rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  margin-bottom: 24px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.upgrade-button {
  margin-top: 8px;
}

.remote-id-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
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
  color: hsl(var(--muted-foreground));
  margin-bottom: 16px;
  line-height: 1.5;
}

.usage-content {
  padding: 20px;
}

.remote-id-display-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.remote-id-boxes {
  display: flex;
  gap: 8px;
}

.remote-id-box {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  padding: 12px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
  min-width: 0;
}

.remote-id-box:hover {
  border-color: hsl(var(--primary) / 0.3);
}

/* Adjust widths proportionally based on character count (8, 5, 5, 8) */
.remote-id-box-0,
.remote-id-box-3 {
  flex: 8;
}

.remote-id-box-1,
.remote-id-box-2 {
  flex: 5;
}

.remote-id-box-text {
  font-family: "JetBrains Mono", "Courier New", monospace;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-align: center;
  white-space: nowrap;
}

.copy-button {
  flex-shrink: 0;
}

.qr-code-wrapper {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.qr-code-image {
  width: 160px;
  height: 160px;
  border-radius: 8px;
  background: white;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.usage-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 20px;
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
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
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
  color: hsl(var(--muted-foreground));
  padding-top: 6px;
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
  background: hsl(var(--muted) / 0.3);
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.spec-item:hover {
  background: hsl(var(--muted) / 0.5);
  border-color: hsl(var(--primary) / 0.2);
}

.spec-content {
  flex: 1;
}

.spec-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.spec-description {
  font-size: 0.9rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
}

@media (max-width: 1160px) {
  .remote-id-grid {
    grid-template-columns: 1fr;
  }
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

  .remote-id-boxes {
    gap: 6px;
  }

  .remote-id-box {
    padding: 10px 4px;
  }

  .remote-id-box-text {
    font-size: 0.85rem;
    letter-spacing: 0.02em;
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

@media (max-width: 500px) {
  .remote-id-display-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .remote-id-boxes {
    gap: 4px;
  }

  .remote-id-box {
    padding: 8px 2px;
  }

  .remote-id-box-text {
    font-size: 0.75rem;
    letter-spacing: 0;
  }

  .copy-button {
    align-self: flex-end;
  }
}
</style>
