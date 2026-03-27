<template>
  <div v-show="showLoginUI" class="login-background">
    <div
      class="flex min-h-screen items-center justify-center p-3 max-[500px]:p-2"
    >
      <div class="w-full max-w-md">
        <Card class="border-border/50 p-6 shadow-xl max-[500px]:p-5">
          <!-- Logo -->
          <div class="mb-6 text-center max-[500px]:mb-4">
            <img
              :src="iconSvg"
              alt="Music Assistant"
              class="mx-auto mb-4 h-20 w-20 max-[500px]:mb-3 max-[500px]:h-15 max-[500px]:w-15"
            />
            <h1 class="text-2xl font-bold text-foreground max-[500px]:text-xl">
              Music Assistant
            </h1>
            <p
              class="mt-2 text-sm text-muted-foreground max-[500px]:mt-1 max-[500px]:text-[0.8125rem]"
            >
              Your Music, Your Way
            </p>
          </div>

          <!-- Auto-connecting State -->
          <template v-if="step === 'auto-connect'">
            <div class="py-6 text-center">
              <Spinner :size="64" class="mx-auto mb-4 text-primary" />
              <p class="text-sm text-muted-foreground">
                {{ connectionStatusMessage }}
              </p>
            </div>
          </template>

          <!-- Connection Mode Selector -->
          <template v-if="step === 'select-mode'">
            <!-- Remote-only mode -->
            <div v-if="isRemoteOnlyMode" class="mb-4 text-center">
              <Cloud class="mx-auto mb-2 h-12 w-12 text-primary" />
              <p class="mb-4 text-sm text-muted-foreground">
                {{
                  $t(
                    "login.remote_only_info",
                    "Connect to your Music Assistant server remotely",
                  )
                }}
              </p>
            </div>

            <!-- Local Server Input (only for development with vite dev server) -->
            <div v-if="showServerAddressInput" class="mb-4">
              <label class="mb-2 block text-sm font-medium text-foreground">
                {{ $t("login.server_address", "Server Address") }}
              </label>
              <Input
                v-model="serverAddress"
                :placeholder="
                  $t(
                    'login.server_address_placeholder',
                    'http://192.168.1.100:8095',
                  )
                "
                class="rounded-[10px]"
                :class="connectionError ? 'border-destructive' : ''"
                :disabled="isConnecting"
                @keyup.enter="connectToLocal"
              />
              <p v-if="connectionError" class="mt-1 text-xs text-destructive">
                {{ connectionError }}
              </p>
              <p class="mt-2 text-xs text-muted-foreground">
                {{
                  $t(
                    "login.server_address_hint",
                    "Enter the full URL of your Music Assistant server",
                  )
                }}
              </p>
            </div>

            <!-- Remote ID Input (for remote-only mode) -->
            <div v-if="isRemoteOnlyMode" class="mb-4">
              <div class="mb-2 flex items-center justify-between">
                <label class="text-sm font-medium text-foreground">
                  {{ $t("login.remote_id", "Remote ID") }}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="isConnecting"
                  @click="openQrScanner"
                >
                  <QrCode class="mr-1 h-4 w-4" />
                  {{ $t("login.scan_qr", "Scan QR") }}
                </Button>
              </div>
              <div class="remote-id-inputs">
                <Input
                  v-for="(_, index) in 4"
                  :key="index"
                  :ref="setRemoteIdRef(index)"
                  :model-value="remoteIdParts[index]"
                  :maxlength="remoteIdLengths[index]"
                  :disabled="isConnecting"
                  class="remote-id-input rounded-[10px] text-center font-mono uppercase tracking-wider"
                  :class="`remote-id-input-${index}`"
                  @input="handleRemoteIdInput(index, $event)"
                  @keydown="handleRemoteIdKeydown(index, $event)"
                  @paste="handleRemoteIdPaste(index, $event)"
                />
              </div>
              <p v-if="connectionError" class="mt-2 text-xs text-destructive">
                {{ connectionError }}
              </p>
              <p class="mt-2 text-xs text-muted-foreground">
                {{
                  $t(
                    "login.remote_id_hint",
                    'Find this in your server settings under "Remote Access"',
                  )
                }}
              </p>
            </div>

            <!-- Connect Button -->
            <Button
              size="lg"
              class="mb-4 h-12 w-full rounded-lg text-base max-[500px]:h-12 max-[500px]:text-[0.9375rem]"
              :disabled="
                (isRemoteOnlyMode &&
                  !remoteIdParts.every(
                    (p, i) => p.length === remoteIdLengths[i],
                  )) ||
                (showServerAddressInput && !serverAddress.trim()) ||
                isConnecting
              "
              @click="isRemoteOnlyMode ? connectToRemote() : connectToLocal()"
            >
              <Spinner v-if="isConnecting" class="mr-2" />
              {{ $t("login.connect", "Connect") }}
            </Button>
          </template>

          <!-- Login Form (after connection) -->
          <template v-if="step === 'login'">
            <!-- Connected server info (only show for remote connections) -->
            <div
              v-if="
                connectedServerName && (isRemoteConnection || !isHostedWithAPI)
              "
              class="mb-4 text-center"
            >
              <Badge
                variant="secondary"
                class="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
              >
                <CheckCircle class="mr-1 h-3 w-3" />
                {{ connectedServerName }}
              </Badge>
            </div>

            <!-- Username Field -->
            <div class="mb-4">
              <label class="mb-2 block text-sm font-medium text-foreground">
                {{ $t("login.username", "Username") }}
              </label>
              <Input
                v-model="username"
                :placeholder="
                  $t('login.username_placeholder', 'Enter your username')
                "
                class="rounded-[10px]"
                :disabled="isAuthenticating"
                autofocus
              />
            </div>

            <!-- Password Field -->
            <div class="mb-6">
              <label class="mb-2 block text-sm font-medium text-foreground">
                {{ $t("login.password", "Password") }}
              </label>
              <div class="relative">
                <Input
                  v-model="password"
                  :placeholder="
                    $t('login.password_placeholder', 'Enter your password')
                  "
                  :type="showPassword ? 'text' : 'password'"
                  class="rounded-[10px] pr-10"
                  :class="loginError ? 'border-destructive' : ''"
                  :disabled="isAuthenticating"
                  @keyup.enter="login"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" class="h-4 w-4" />
                  <Eye v-else class="h-4 w-4" />
                </button>
              </div>
              <p v-if="loginError" class="mt-1 text-xs text-destructive">
                {{ loginError }}
              </p>
            </div>

            <!-- Sign In Button -->
            <Button
              size="lg"
              class="mb-6 h-12 w-full rounded-lg text-base max-[500px]:h-12 max-[500px]:text-[0.9375rem]"
              :disabled="
                !username.trim() || !password.trim() || isAuthenticating
              "
              @click="login"
            >
              <Spinner v-if="isAuthenticating" class="mr-2" />
              {{ $t("login.sign_in", "Sign In") }}
            </Button>

            <!-- Home Assistant OAuth Button -->
            <Button
              v-if="hasHomeAssistantAuth"
              variant="outline"
              size="lg"
              class="mt-4 h-12 w-full rounded-lg border-border text-base hover:border-primary hover:bg-primary/5 max-[500px]:h-12 max-[500px]:text-[0.9375rem]"
              :disabled="isAuthenticating"
              @click="loginWithHomeAssistant"
            >
              <Spinner v-if="isAuthenticating" class="mr-2" />
              <img
                v-else
                src="@/assets/home-assistant-logo.svg"
                alt="Home Assistant"
                width="24"
                height="24"
                class="mr-2"
              />
              {{ $t("login.sign_in_with_ha", "Sign in with Home Assistant") }}
            </Button>

            <!-- Back button (only show for remote connections or when not hosted with API) -->
            <Button
              v-if="isRemoteConnection || !isHostedWithAPI"
              variant="ghost"
              class="mt-4 w-full"
              :disabled="isAuthenticating"
              @click="goBack"
            >
              {{ $t("login.different_server", "Use different server") }}
            </Button>
          </template>

          <!-- Connecting State -->
          <template v-if="step === 'connecting'">
            <div class="py-6 text-center">
              <Spinner :size="64" class="mx-auto mb-4 text-primary" />
              <p class="mb-2 text-lg font-semibold text-foreground">
                {{ $t("login.connecting", "Connecting...") }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ connectionStatusMessage }}
              </p>
            </div>
            <Button variant="ghost" class="w-full" @click="cancelConnection">
              {{ $t("login.cancel", "Cancel") }}
            </Button>
          </template>

          <!-- Error State -->
          <template v-if="step === 'error'">
            <div class="py-6 text-center">
              <AlertCircle class="mx-auto mb-4 h-16 w-16 text-destructive" />
              <p class="mb-2 text-lg font-semibold text-foreground">
                {{ $t("login.connection_failed", "Connection Failed") }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ connectionError }}
              </p>
            </div>
            <Button class="w-full rounded-lg" @click="retry">
              {{ $t("login.try_again", "Try Again") }}
            </Button>
          </template>

          <!-- Reconnecting State -->
          <template v-if="step === 'reconnecting'">
            <div class="py-6 text-center">
              <Spinner :size="64" class="mx-auto mb-4 text-yellow-500" />
              <p class="mb-2 text-lg font-semibold text-foreground">
                {{ $t("login.reconnecting", "Connection Lost") }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{
                  $t(
                    "login.reconnecting_message",
                    "Attempting to reconnect to the server...",
                  )
                }}
              </p>
            </div>
          </template>
        </Card>

        <!-- QR Scanner Dialog -->
        <Dialog v-model:open="showQrScanner">
          <DialogContent
            class="max-w-[400px] rounded-xl"
            @interact-outside.prevent
          >
            <DialogHeader>
              <DialogTitle>
                {{ $t("login.scan_qr_code", "Scan QR Code") }}
              </DialogTitle>
              <DialogDescription class="sr-only">{{ $t('aria.scan_qr_code') }}</DialogDescription>
            </DialogHeader>
            <div>
              <p class="mb-4 text-sm text-muted-foreground">
                {{
                  $t(
                    "login.scan_qr_hint",
                    "Point your camera at the QR code shown in your Music Assistant server settings.",
                  )
                }}
              </p>
              <div
                class="qr-scanner-wrapper aspect-square w-full overflow-hidden rounded-xl bg-black"
              >
                <QrcodeStream
                  :paused="!showQrScanner"
                  @detect="onQrCodeDetected"
                  @error="onQrScannerError"
                />
              </div>
              <Alert v-if="qrScannerError" variant="destructive" class="mt-4">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ qrScannerError }}</AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>

        <!-- Footer -->
        <div class="mt-6 text-center max-[500px]:mt-4">
          <a
            href="https://www.openhomefoundation.org/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-inherit no-underline transition-opacity hover:opacity-70"
          >
            <p
              class="flex items-center justify-center text-xs text-muted-foreground max-[500px]:flex-wrap max-[500px]:text-[0.6875rem]"
            >
              <img
                src="@/assets/open-home-foundation-icon.svg"
                alt="Open Home Foundation"
                class="h-4 w-auto shrink-0 max-[500px]:h-3.5"
              />
              <span class="ml-1 max-[500px]:ml-0.5"
                >Music Assistant is a product from the Open Home
                Foundation</span
              >
            </p>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { api, ConnectionState } from "@/plugins/api";
import type {
  AuthProvider,
  ServerInfoMessage,
  User,
} from "@/plugins/api/interfaces";
import type { ITransport } from "@/plugins/remote/transport";
import { authManager } from "@/plugins/auth";
import { remoteConnectionManager } from "@/plugins/remote";
import {
  type ComponentPublicInstance,
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { QrcodeStream } from "vue-qrcode-reader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import iconSvgRaw from "@/assets/icon.svg?raw";

const iconSvg = `data:image/svg+xml;base64,${btoa(iconSvgRaw)}`;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Cloud,
  QrCode,
  CheckCircle,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-vue-next";

const { t } = useI18n();

// Storage keys
const STORAGE_KEY_SERVER_ADDRESS = "mass_server_address";
const STORAGE_KEY_REMOTE_ID = "mass_remote_id";
const STORAGE_KEY_TOKEN = "ma_access_token";
// Session storage key for pending guest code (survives SW reload but not browser close)
const SESSION_KEY_PENDING_JOIN_CODE = "ma_pending_join_code";

// Props and emits
const emit = defineEmits<{
  (e: "connected", transport: ITransport): void;
  (
    e: "authenticated",
    credentials: {
      username?: string;
      password?: string;
      token?: string;
      user?: User;
    },
  ): void;
  (e: "local-connect", serverAddress: string): void;
}>();

// Detect hosting context
const isRemoteOnlyMode = computed(() => {
  // Check if running on app.music-assistant.io
  if (window.location.hostname === "app.music-assistant.io") {
    return true;
  }
  // Check for remote=1 query parameter (for testing/development)
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("remote") === "1";
});

// Detect if running in Home Assistant Ingress mode
const isIngressMode = computed(() => {
  return window.location.pathname.includes("/hassio_ingress/");
});

const isHostedWithAPI = ref(false);

const showServerAddressInput = computed(() => {
  // Only show server address input when:
  // 1. NOT in remote-only mode (app.music-assistant.io)
  // 2. NOT hosted with the API (development mode with vite dev server)
  return !isRemoteOnlyMode.value && !isHostedWithAPI.value;
});

/**
 * Check if the frontend is hosted on the same server as the API
 * by attempting to fetch the /info endpoint
 */
const checkIfHostedWithAPI = async (): Promise<boolean> => {
  if (isRemoteOnlyMode.value) {
    return false;
  }

  // Development mode: if running with common Vite dev server ports,
  // we're likely running the Vite dev server, not hosted with API
  const commonPorts = ["8094", "8095"];
  if (commonPorts.includes(window.location.port)) {
    // fast lane: assume hosted with API
    return true;
  }

  try {
    const baseUrl =
      window.location.origin + window.location.pathname.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/info`, {
      method: "GET",
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    if (!response.ok) {
      return false;
    }

    // Verify it's actually a Music Assistant server by checking the response
    const data = await response.json();
    // MA server info endpoint should have certain fields
    const isMusicAssistant =
      data &&
      (data.server_id ||
        data.server_version ||
        data.min_supported_server_version);

    return isMusicAssistant;
  } catch (error) {
    return false;
  }
};

// UI State
type Step =
  | "auto-connect"
  | "select-mode"
  | "login"
  | "connecting"
  | "reconnecting"
  | "error";
const step = ref<Step>("auto-connect");
const showLoginUI = ref(false);

// Connection state
const serverAddress = ref("");
// Remote ID split into 4 parts: 8-5-5-8 characters
const remoteIdParts = ref(["", "", "", ""]);
const remoteIdLengths = [8, 5, 5, 8];
const remoteIdRefs = ref<(HTMLInputElement | null)[]>([null, null, null, null]);
const remoteId = computed(() => remoteIdParts.value.join(""));

// QR Scanner state
const showQrScanner = ref(false);
const qrScannerError = ref<string | null>(null);
const isConnecting = ref(false);
const connectionError = ref<string | null>(null);
const connectionStatusMessage = ref("");
const isRemoteConnection = ref(false);
const connectedServerName = ref<string | null>(null);

// Login state
const username = ref("");
const password = ref("");
const showPassword = ref(false);
const isAuthenticating = ref(false);
const loginError = ref<string | null>(null);

// Auth providers state
const authProviders = ref<AuthProvider[]>([]);
const hasHomeAssistantAuth = computed(() =>
  authProviders.value.some((p) => p.provider_id === "homeassistant"),
);

// Computed
const getSubtitle = computed(() => {
  if (step.value === "auto-connect") {
    return t("login.auto_connecting", "Looking for your server...");
  }
  if (step.value === "login") {
    return t("login.sign_in_to_continue", "Sign in to continue");
  }
  if (step.value === "connecting") {
    return t("login.establishing_connection", "Establishing connection...");
  }
  return t("login.subtitle", "Connect to your music server");
});

/**
 * Build WebSocket URL from current page URL
 */
const getWebSocketUrlFromLocation = (): string => {
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  // Remove any trailing slash and hash
  let basePath = loc.pathname.replace(/\/$/, "").split("#")[0];
  // Don't add /ws if already present
  if (basePath.endsWith("/ws")) {
    return `${protocol}//${loc.host}${basePath}`;
  }
  return `${protocol}//${loc.host}${basePath}/ws`;
};

/**
 * Build WebSocket URL from a server address
 */
const buildWebSocketUrl = (address: string): string => {
  try {
    const url = new URL(address);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    let basePath = url.pathname.replace(/\/$/, "");
    // Don't add /ws if already present
    if (basePath.endsWith("/ws")) {
      return `${protocol}//${url.host}${basePath}`;
    }
    return `${protocol}//${url.host}${basePath}/ws`;
  } catch {
    // If it's not a valid URL, try to build one
    const cleanAddress = address.replace(/\/$/, "");
    if (cleanAddress.startsWith("ws://") || cleanAddress.startsWith("wss://")) {
      return cleanAddress.endsWith("/ws") ? cleanAddress : `${cleanAddress}/ws`;
    }
    const protocol = cleanAddress.startsWith("https://") ? "wss:" : "ws:";
    const host = cleanAddress.replace(/^https?:\/\//, "");
    // Check if host already has /ws
    if (host.endsWith("/ws")) {
      return `${protocol}//${host}`;
    }
    return `${protocol}//${host}/ws`;
  }
};

/**
 * Try to connect to a WebSocket URL with timeout
 */
const tryConnect = async (
  wsUrl: string,
  timeoutMs: number = 5000,
): Promise<boolean> => {
  console.debug(`[Login] Trying to connect to: ${wsUrl}`);

  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      resolve(false);
    }, timeoutMs);

    ws.onopen = () => {
      clearTimeout(timeout);
      ws.close();
      resolve(true);
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
};

/**
 * Try to authenticate with stored token after connection
 */
const tryStoredTokenAuth = async (token?: string): Promise<boolean> => {
  const authToken = token || localStorage.getItem(STORAGE_KEY_TOKEN);
  if (!authToken) {
    return false;
  }

  try {
    connectionStatusMessage.value = t(
      "login.authenticating",
      "Authenticating...",
    );

    const result = await api.authenticateWithToken(authToken);
    emit("authenticated", { token: authToken, user: result.user });
    return true;
  } catch {
    // Clear invalid token if we're not using a URL parameter token
    if (!token) {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    return false;
  }
};

/**
 * Try to authenticate with a guest code (exchange for JWT)
 * This is the new short code system for party guest access
 */
const tryGuestCodeAuth = async (code: string): Promise<boolean> => {
  if (!code) {
    return false;
  }

  try {
    connectionStatusMessage.value = t(
      "login.authenticating",
      "Authenticating...",
    );

    // Exchange the short code for a JWT token via auth/code API
    const result = await api.sendCommand<{
      success: boolean;
      access_token?: string;
      user?: { user_id: string; username: string; role: string };
      error?: string;
    }>("auth/join_code/exchange", { code: code.toUpperCase() });

    if (!result.success || !result.access_token) {
      console.error("[Login] Guest code exchange failed:", result.error);
      return false;
    }

    // Store the JWT token for auto-login and decode claims
    localStorage.setItem(STORAGE_KEY_TOKEN, result.access_token);
    authManager.setToken(result.access_token);

    // Authenticate the WebSocket session with the JWT
    const authResult = await api.authenticateWithToken(result.access_token);

    // Emit authenticated event - App.vue will handle the rest
    emit("authenticated", {
      token: result.access_token,
      user: authResult.user,
    });
    return true;
  } catch (error) {
    console.error("[Login] Guest code authentication failed:", error);
    // Clear potentially invalid token to avoid repeated failing auto-login attempts
    authManager.clearAuth();
    return false;
  }
};

/**
 * Try to authenticate in ingress mode (no credentials needed)
 */
const tryIngressAuth = async (): Promise<boolean> => {
  try {
    connectionStatusMessage.value = t(
      "login.authenticating",
      "Authenticating...",
    );

    // In ingress mode, simply call auth/me to get the auto-authenticated user
    const user = await api.getCurrentUserInfo();
    if (!user) {
      return false;
    }

    emit("authenticated", { user });
    return true;
  } catch {
    return false;
  }
};

/**
 * Smart auto-connect logic
 */
const autoConnect = async () => {
  step.value = "auto-connect";
  connectionStatusMessage.value = t(
    "login.checking_stored",
    "Checking for saved connection...",
  );

  // Check for auth code from setup flow in URL
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get("code");
  const urlRemoteId = urlParams.get("remote_id");
  // Guest code is the short code (e.g., "ABCD1234") exchanged for JWT
  const urlJoinCode = urlParams.get("join");

  // Also check for pending guest code from sessionStorage (survives SW reload)
  const pendingJoinCode = sessionStorage.getItem(SESSION_KEY_PENDING_JOIN_CODE);
  const storedRemoteIdForPending = localStorage.getItem(STORAGE_KEY_REMOTE_ID);

  // Determine the effective guest code and remote ID
  // Priority: URL params > sessionStorage (for reload recovery)
  let effectiveJoinCode = urlJoinCode || null;
  let effectiveRemoteId = urlRemoteId;

  // If no guest code in URL but we have a pending one in sessionStorage, use that
  // This handles the case where SW reload cleared the URL but code was stored
  if (!effectiveJoinCode && pendingJoinCode && storedRemoteIdForPending) {
    effectiveJoinCode = pendingJoinCode;
    effectiveRemoteId = storedRemoteIdForPending;
  }

  if (effectiveRemoteId && effectiveJoinCode) {
    const cleanRemoteId = effectiveRemoteId
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (cleanRemoteId.length === 26) {
      // Clear any stale token before guest code auth
      if (localStorage.getItem(STORAGE_KEY_TOKEN)) {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
      }

      localStorage.setItem(STORAGE_KEY_REMOTE_ID, cleanRemoteId);
      // Store guest code in sessionStorage for SW reload recovery
      sessionStorage.setItem(SESSION_KEY_PENDING_JOIN_CODE, effectiveJoinCode);

      connectionStatusMessage.value = t(
        "login.connecting_remote_party",
        "Connecting to party...",
      );

      try {
        setRemoteIdFromString(cleanRemoteId);
        step.value = "connecting";

        const transport =
          await remoteConnectionManager.connectRemote(cleanRemoteId);

        // Connection established, emit connected event
        emit("connected", transport);

        // Wait for API to be ready
        const apiConnected = await waitForApiConnection(15000);

        if (apiConnected) {
          // Exchange the guest code for a JWT token
          const guestAuthResult = await tryGuestCodeAuth(effectiveJoinCode);

          if (guestAuthResult) {
            // Clear the pending guest code - it's been successfully used
            sessionStorage.removeItem(SESSION_KEY_PENDING_JOIN_CODE);
            // Clean up URL
            const successUrlParams = new URLSearchParams(
              window.location.search,
            );
            if (
              successUrlParams.has("remote_id") ||
              successUrlParams.has("join")
            ) {
              successUrlParams.delete("remote_id");
              successUrlParams.delete("join");
              const queryString = successUrlParams.toString();
              const cleanUrl =
                window.location.origin +
                window.location.pathname +
                (queryString ? "?" + queryString : "");
              window.history.replaceState({}, "", cleanUrl);
            }
            return; // Success - App.vue will complete initialization
          }
        }

        // Code exchange failed
        sessionStorage.removeItem(SESSION_KEY_PENDING_JOIN_CODE);
        connectionError.value = t(
          "login.error_party_auth_failed",
          "Failed to join party. The code may have expired.",
        );
        step.value = "error";
        return;
      } catch (error) {
        sessionStorage.removeItem(SESSION_KEY_PENDING_JOIN_CODE);
        console.error("[Login] Remote party connection failed:", error);
        connectionError.value =
          error instanceof Error
            ? error.message
            : t("login.error_unknown", "Unknown error occurred");
        step.value = "error";
        return;
      }
    }
  }

  // If remote_id is in URL, pre-fill and auto-connect (when in remote-only mode).
  // This also serves as a fallback when both remote_id and join are present but
  // the combined handler above didn't succeed (e.g., connection error).
  let urlRemoteIdForAutoConnect: string | null = null;
  if (urlRemoteId) {
    console.debug("[Login] Found remote_id in URL:", urlRemoteId);
    const cleanRemoteId = urlRemoteId.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanRemoteId.length === 26) {
      setRemoteIdFromString(cleanRemoteId);
      urlRemoteIdForAutoConnect = cleanRemoteId;
      // Store the join code in sessionStorage so the remote-only auto-connect
      // path can pick it up after establishing the WebRTC connection.
      if (urlJoinCode) {
        sessionStorage.setItem(SESSION_KEY_PENDING_JOIN_CODE, urlJoinCode);
        localStorage.setItem(STORAGE_KEY_REMOTE_ID, cleanRemoteId);
      }
      // Clean up the URL
      urlParams.delete("remote_id");
      urlParams.delete("join");
      const queryString = urlParams.toString();
      const newUrl =
        window.location.origin +
        window.location.pathname +
        (queryString ? "?" + queryString : "") +
        window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }

  // Handle auth code from OAuth flow (long codes, not 8-character guest codes)
  if (authCode && authCode.length > 8) {
    // Store the token and clean up the URL
    localStorage.setItem(STORAGE_KEY_TOKEN, authCode);
    urlParams.delete("code");
    const queryString = urlParams.toString();
    const newUrl =
      window.location.origin +
      window.location.pathname +
      (queryString ? "?" + queryString : "") +
      window.location.hash;
    window.history.replaceState({}, "", newUrl);
  }

  // Handle local guest code (no remote_id, just the join code)
  if (urlJoinCode && !urlRemoteId) {
    // Clean up URL - remove join param
    urlParams.delete("join");
    const queryString = urlParams.toString();
    const cleanUrl =
      window.location.origin +
      window.location.pathname +
      (queryString ? "?" + queryString : "");
    window.history.replaceState({}, "", cleanUrl);

    // Check if we're hosted with the API
    isHostedWithAPI.value = await checkIfHostedWithAPI();

    if (isHostedWithAPI.value) {
      connectionStatusMessage.value = t(
        "login.connecting_local_party",
        "Connecting to party...",
      );

      try {
        const address =
          window.location.origin + window.location.pathname.replace(/\/$/, "");
        serverAddress.value = address;

        emit("local-connect", address);
        localStorage.setItem(STORAGE_KEY_SERVER_ADDRESS, address);

        if (await waitForApiConnection()) {
          if (await tryGuestCodeAuth(urlJoinCode)) {
            return; // Success - App.vue will take over
          }
        }

        connectionError.value = t(
          "login.error_party_auth_failed",
          "Failed to join party. The code may have expired.",
        );
        step.value = "error";
        return;
      } catch (error) {
        console.error("[Login] Local party connection failed:", error);
        connectionError.value =
          error instanceof Error
            ? error.message
            : t("login.error_unknown", "Unknown error occurred");
        step.value = "error";
        return;
      }
    }
  }

  // Check if we're hosted with the API
  isHostedWithAPI.value = await checkIfHostedWithAPI();

  // Special handling for Home Assistant Ingress mode
  if (isIngressMode.value) {
    connectionStatusMessage.value = t(
      "login.connecting_ingress",
      "Connecting via Home Assistant...",
    );

    const address =
      window.location.origin + window.location.pathname.replace(/\/$/, "");

    try {
      emit("local-connect", address);

      if (await waitForApiConnection()) {
        if (await tryIngressAuth()) {
          return; // Success - App.vue will take over
        }
      }

      console.error("[Login] Ingress authentication failed");
      connectionError.value = t(
        "login.error_ingress_failed",
        "Failed to authenticate via Home Assistant Ingress",
      );
      step.value = "error";
      return;
    } catch (error) {
      console.error("[Login] Ingress connection failed:", error);
      connectionError.value =
        error instanceof Error
          ? error.message
          : t("login.error_unknown", "Unknown error occurred");
      step.value = "error";
      return;
    }
  }

  // If in remote-only mode, skip all local connection attempts
  if (isRemoteOnlyMode.value) {
    const storedRemoteId =
      localStorage.getItem(STORAGE_KEY_REMOTE_ID) ||
      remoteConnectionManager.getStoredRemoteId();

    // Check for pending guest code - if present, don't use stored token
    const hasPendingGuestCode = sessionStorage.getItem(
      SESSION_KEY_PENDING_JOIN_CODE,
    );

    if (hasPendingGuestCode && storedRemoteId) {
      // Try to complete the guest auth flow after SW reload
      connectionStatusMessage.value = t(
        "login.connecting_remote_party",
        "Connecting to party...",
      );

      try {
        setRemoteIdFromString(storedRemoteId);
        step.value = "connecting";

        const transport =
          await remoteConnectionManager.connectRemote(storedRemoteId);
        emit("connected", transport);

        if (await waitForApiConnection(15000)) {
          if (await tryGuestCodeAuth(hasPendingGuestCode)) {
            sessionStorage.removeItem(SESSION_KEY_PENDING_JOIN_CODE);
            return;
          }
        }

        sessionStorage.removeItem(SESSION_KEY_PENDING_JOIN_CODE);
        connectionError.value = t(
          "login.error_party_auth_failed",
          "Failed to join party. The code may have expired.",
        );
        step.value = "error";
        return;
      } catch (error) {
        console.error("[Login] Pending guest code recovery error:", error);
        sessionStorage.removeItem(SESSION_KEY_PENDING_JOIN_CODE);
        // Fall through to show login form
      }
    } else if (hasPendingGuestCode) {
      sessionStorage.removeItem(SESSION_KEY_PENDING_JOIN_CODE);
    }

    // Use stored token for auto-login (only if no pending guest code)
    const storedToken = hasPendingGuestCode
      ? null
      : localStorage.getItem(STORAGE_KEY_TOKEN);

    // Auto-connect if we have remote_id from URL (from portal redirect)
    // or if we have stored credentials
    const remoteIdToConnect =
      urlRemoteIdForAutoConnect ||
      (storedRemoteId && storedToken ? storedRemoteId : null);

    if (remoteIdToConnect) {
      console.debug(
        "[Login] Auto-connecting to remote:",
        remoteIdToConnect,
        urlRemoteIdForAutoConnect ? "(from URL)" : "(from storage)",
      );
      connectionStatusMessage.value = t(
        "login.connecting_remote",
        "Connecting to remote server...",
      );
      setRemoteIdFromString(remoteIdToConnect);

      try {
        const cleanRemoteId = remoteIdToConnect.trim().toUpperCase();
        const transport =
          await remoteConnectionManager.connectRemote(cleanRemoteId);

        emit("connected", transport);

        if (await waitForApiConnection()) {
          // Try to authenticate with stored token (if available)
          if (storedToken && (await tryStoredTokenAuth())) {
            console.info("[Login] Remote auto-login successful!");
            return; // Success - App.vue will take over
          }
        }

        // No token or token auth failed, show login form
        console.debug("[Login] Showing login form for remote connection");
        connectedServerName.value = `Remote: ${cleanRemoteId}`;
        isRemoteConnection.value = true;
        await fetchAuthProviders();
        step.value = "login";
        return;
      } catch (error) {
        // Fall through to show selection screen
      }
    } else if (storedRemoteId) {
      setRemoteIdFromString(storedRemoteId);
    }

    step.value = "select-mode";
    return;
  }

  // 1. If hosted with API, try connecting to current host first
  if (isHostedWithAPI.value) {
    connectionStatusMessage.value = t(
      "login.checking_local",
      "Checking local server...",
    );

    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const localWsUrl = getWebSocketUrlFromLocation();

    if (await tryConnect(localWsUrl, 3000)) {
      const address =
        window.location.origin + window.location.pathname.replace(/\/$/, "");
      serverAddress.value = address;

      emit("local-connect", address);
      localStorage.setItem(STORAGE_KEY_SERVER_ADDRESS, address);

      if (await waitForApiConnection()) {
        if (storedToken && (await tryStoredTokenAuth())) {
          return; // Success - App.vue will take over
        }
      }

      // Show login form for this server
      try {
        const url = new URL(address);
        connectedServerName.value = url.hostname;
      } catch {
        connectedServerName.value = address;
      }
      await fetchAuthProviders();
      step.value = "login";
      return;
    }
  }

  // 2. Try stored server address + token (for development mode)
  const storedAddress = localStorage.getItem(STORAGE_KEY_SERVER_ADDRESS);
  const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);

  if (storedAddress && storedToken) {
    connectionStatusMessage.value = t(
      "login.connecting_to_saved",
      "Connecting to saved server...",
    );

    const wsUrl = buildWebSocketUrl(storedAddress);
    if (await tryConnect(wsUrl)) {
      serverAddress.value = storedAddress;

      emit("local-connect", storedAddress);
      localStorage.setItem(STORAGE_KEY_SERVER_ADDRESS, storedAddress);

      if (await waitForApiConnection()) {
        if (await tryStoredTokenAuth()) {
          return; // Success - App.vue will take over
        }
      }

      // Token auth failed, show login form for this server
      try {
        const url = new URL(storedAddress);
        connectedServerName.value = url.hostname;
      } catch {
        connectedServerName.value = storedAddress;
      }
      await fetchAuthProviders();
      step.value = "login";
      return;
    }
  }

  // 3. Try stored server address without token (show login form)
  if (storedAddress) {
    connectionStatusMessage.value = t(
      "login.connecting_to_saved",
      "Connecting to saved server...",
    );

    const wsUrl = buildWebSocketUrl(storedAddress);
    if (await tryConnect(wsUrl)) {
      serverAddress.value = storedAddress;
      await performLocalConnect(storedAddress);
      return;
    }
  }

  // 4. Try stored remote ID + token (auto-connect remote)
  const storedRemoteId =
    localStorage.getItem(STORAGE_KEY_REMOTE_ID) ||
    remoteConnectionManager.getStoredRemoteId();
  if (storedRemoteId && storedToken) {
    connectionStatusMessage.value = t(
      "login.connecting_remote",
      "Connecting to remote server...",
    );
    setRemoteIdFromString(storedRemoteId);

    try {
      const cleanRemoteId = storedRemoteId.trim().toUpperCase();
      const transport =
        await remoteConnectionManager.connectRemote(cleanRemoteId);

      emit("connected", transport);

      if (await waitForApiConnection()) {
        if (await tryStoredTokenAuth()) {
          return; // Success - App.vue will take over
        }
      }

      // Token auth failed, show login form
      connectedServerName.value = `Remote: ${cleanRemoteId}`;
      isRemoteConnection.value = true;
      await fetchAuthProviders();
      step.value = "login";
      return;
    } catch {
      // Fall through to show selection screen
    }
  } else if (storedRemoteId) {
    setRemoteIdFromString(storedRemoteId);
  }

  // 5. No auto-connect possible, show selection screen
  step.value = "select-mode";
};

/**
 * Wait for API to be connected
 */
const waitForApiConnection = async (
  timeoutMs: number = 10000,
): Promise<boolean> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (api.serverInfo.value) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};

/**
 * Handle input in remote ID segmented fields
 */
const handleRemoteIdInput = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement;
  // Convert to uppercase and remove non-alphanumeric characters
  let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const maxLen = remoteIdLengths[index];

  if (value.length > maxLen) {
    // Overflow: put excess in next field(s)
    const overflow = value.slice(maxLen);
    value = value.slice(0, maxLen);
    remoteIdParts.value[index] = value;

    if (index < 3 && overflow) {
      distributeRemoteIdText(overflow, index + 1);
    }
  } else {
    remoteIdParts.value[index] = value;

    // Auto-advance to next field when current is full
    if (value.length === maxLen && index < 3) {
      nextTick(() => {
        remoteIdRefs.value[index + 1]?.focus();
      });
    }
  }
};

/**
 * Distribute text across remote ID fields starting from a given index
 */
const distributeRemoteIdText = (text: string, startIndex: number) => {
  let remaining = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let focusIndex = startIndex;

  for (let i = startIndex; i < 4 && remaining.length > 0; i++) {
    const maxLen = remoteIdLengths[i];
    remoteIdParts.value[i] = remaining.slice(0, maxLen);
    if (remaining.length <= maxLen) {
      focusIndex = i;
    }
    remaining = remaining.slice(maxLen);
  }

  nextTick(() => {
    const field = remoteIdRefs.value[focusIndex];
    field?.focus();
    // Position cursor at end
    const len = remoteIdParts.value[focusIndex].length;
    field?.setSelectionRange(len, len);
  });
};

/**
 * Handle keydown in remote ID fields (for backspace navigation)
 */
const handleRemoteIdKeydown = (index: number, event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement;

  if (
    event.key === "Backspace" &&
    input.selectionStart === 0 &&
    input.selectionEnd === 0 &&
    index > 0
  ) {
    // Backspace at start of field: move to previous field
    event.preventDefault();
    const prevField = remoteIdRefs.value[index - 1];
    prevField?.focus();
    const len = remoteIdParts.value[index - 1].length;
    prevField?.setSelectionRange(len, len);
  } else if (
    event.key === "ArrowLeft" &&
    input.selectionStart === 0 &&
    index > 0
  ) {
    // Left arrow at start: move to previous field
    event.preventDefault();
    const prevField = remoteIdRefs.value[index - 1];
    prevField?.focus();
    const len = remoteIdParts.value[index - 1].length;
    prevField?.setSelectionRange(len, len);
  } else if (
    event.key === "ArrowRight" &&
    input.selectionStart === input.value.length &&
    index < 3
  ) {
    // Right arrow at end: move to next field
    event.preventDefault();
    const nextField = remoteIdRefs.value[index + 1];
    nextField?.focus();
    nextField?.setSelectionRange(0, 0);
  } else if (event.key === "Enter") {
    // Enter: submit
    connectToRemote();
  }
};

/**
 * Handle paste in remote ID fields
 */
const handleRemoteIdPaste = (index: number, event: ClipboardEvent) => {
  event.preventDefault();
  const pastedText = event.clipboardData?.getData("text") || "";
  // Remove dashes and non-alphanumeric, convert to uppercase
  const cleanText = pastedText.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (cleanText) {
    // If pasting into first field with full content, replace all
    if (index === 0) {
      // Clear all fields and distribute
      remoteIdParts.value = ["", "", "", ""];
      distributeRemoteIdText(cleanText, 0);
    } else {
      // Distribute from current field
      distributeRemoteIdText(cleanText, index);
    }
  }
};

/**
 * Set ref for remote ID input field
 */
const setRemoteIdRef =
  (index: number) => (el: Element | ComponentPublicInstance | null) => {
    const root = el && "$el" in el ? (el.$el as HTMLElement | undefined) : el;
    remoteIdRefs.value[index] = (root?.querySelector?.("input") ||
      root) as HTMLInputElement | null;
  };

/**
 * Set remote ID from a full string (e.g., from localStorage)
 */
const setRemoteIdFromString = (value: string) => {
  // Remove dashes and non-alphanumeric, then distribute
  const cleanText = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let remaining = cleanText;

  for (let i = 0; i < 4; i++) {
    const maxLen = remoteIdLengths[i];
    remoteIdParts.value[i] = remaining.slice(0, maxLen);
    remaining = remaining.slice(maxLen);
  }
};

/**
 * Perform local connection
 */
const performLocalConnect = async (address: string) => {
  isConnecting.value = true;
  connectionError.value = null;
  isRemoteConnection.value = false;
  step.value = "connecting";
  connectionStatusMessage.value = t(
    "login.connecting_to_server",
    "Connecting to server...",
  );

  try {
    // Emit event to let App.vue handle the actual connection
    emit("local-connect", address);

    // Store the server address for next time
    localStorage.setItem(STORAGE_KEY_SERVER_ADDRESS, address);

    // Wait for the WebSocket connection to establish
    const connected = await waitForApiConnection();
    if (!connected) {
      throw new Error("Connection timeout - server not responding");
    }

    // Try to fetch auth providers (may fail if server requires auth first)
    await fetchAuthProviders();

    // Extract server name from address for display
    try {
      const url = new URL(address);
      connectedServerName.value = url.hostname;
    } catch {
      connectedServerName.value = address;
    }

    step.value = "login";
  } catch (error) {
    console.error("[Login] Local connection failed:", error);
    connectionError.value =
      error instanceof Error
        ? error.message
        : t("login.error_unknown", "Unknown error occurred");
    step.value = "error";
  } finally {
    isConnecting.value = false;
  }
};

/**
 * Connect to local server (from UI)
 */
const connectToLocal = async () => {
  // If hosted with API, connect to current host
  if (isHostedWithAPI.value) {
    const address =
      window.location.origin + window.location.pathname.replace(/\/$/, "");
    await performLocalConnect(address);
    return;
  }

  // Otherwise use the server address input
  if (!serverAddress.value.trim()) return;
  await performLocalConnect(serverAddress.value.trim());
};

/**
 * Connect to remote server
 */
const connectToRemote = async () => {
  if (!remoteIdParts.value.every((p, i) => p.length === remoteIdLengths[i]))
    return;

  isConnecting.value = true;
  connectionError.value = null;
  isRemoteConnection.value = true;
  step.value = "connecting";
  connectionStatusMessage.value = t(
    "login.connecting_to_signaling",
    "Connecting to signaling server...",
  );

  try {
    const cleanRemoteId = remoteId.value.trim().toUpperCase();
    connectionStatusMessage.value = t(
      "login.finding_server",
      "Finding your server...",
    );

    const transport =
      await remoteConnectionManager.connectRemote(cleanRemoteId);

    connectionStatusMessage.value = t(
      "login.establishing_secure",
      "Establishing secure connection...",
    );

    // Store the remote ID for next time
    localStorage.setItem(STORAGE_KEY_REMOTE_ID, cleanRemoteId);

    // Connection established, emit connected event
    emit("connected", transport);

    // Wait for API to be ready
    if (!(await waitForApiConnection())) {
      throw new Error("Failed to establish API connection");
    }

    // Check if there's a join code in the URL (party)
    const currentUrlParams = new URLSearchParams(window.location.search);
    const joinCodeFromUrl = currentUrlParams.get("join");

    if (joinCodeFromUrl) {
      connectionStatusMessage.value = t(
        "login.joining_party",
        "Joining party...",
      );

      if (await tryGuestCodeAuth(joinCodeFromUrl)) {
        // Clean up URL - remove join param
        currentUrlParams.delete("join");
        const queryString = currentUrlParams.toString();
        const cleanUrl =
          window.location.origin +
          window.location.pathname +
          (queryString ? "?" + queryString : "");
        window.history.replaceState({}, "", cleanUrl);
        return; // Success - App.vue will handle redirect
      } else {
        // Clean up URL and fall through to login form
        currentUrlParams.delete("join");
        const queryString = currentUrlParams.toString();
        const cleanUrl =
          window.location.origin +
          window.location.pathname +
          (queryString ? "?" + queryString : "");
        window.history.replaceState({}, "", cleanUrl);
      }
    }

    // Fetch available auth providers
    await fetchAuthProviders();

    connectedServerName.value = `Remote: ${cleanRemoteId}`;
    step.value = "login";
  } catch (error) {
    console.error("[Login] Remote connection failed:", error);
    connectionError.value =
      error instanceof Error
        ? error.message
        : t("login.error_unknown", "Unknown error occurred");
    step.value = "error";
  } finally {
    isConnecting.value = false;
  }
};

const fetchAuthProviders = async () => {
  try {
    // First, check if server info has auth provider hints
    const serverInfo = api.serverInfo.value;
    if (
      serverInfo &&
      "auth_providers" in serverInfo &&
      (serverInfo as ServerInfoMessage & { auth_providers?: AuthProvider[] })
        .auth_providers
    ) {
      authProviders.value = (
        serverInfo as ServerInfoMessage & { auth_providers: AuthProvider[] }
      ).auth_providers;
      console.debug(
        "[Login] Auth providers from serverInfo:",
        authProviders.value,
      );
      return;
    }

    // Try to fetch auth providers (may require auth on some servers)
    const providers = await api.sendCommand<AuthProvider[]>("auth/providers");
    authProviders.value = providers || [];
  } catch {
    // Auth providers fetch failed - this is expected if server requires auth first
    authProviders.value = [];
  }
};

const login = async () => {
  if (!username.value.trim() || !password.value.trim()) return;

  isAuthenticating.value = true;
  loginError.value = null;

  emit("authenticated", {
    username: username.value.trim(),
    password: password.value,
  });
};

/**
 * Handle authentication error from App.vue
 * This is called when the actual authentication fails in App.vue
 */
const handleAuthenticationError = (error: unknown) => {
  console.error("[Login] Authentication failed:", error);

  // Extract error message from different error types
  let errorMessage: string;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    errorMessage = (error as Record<string, string>).message;
  } else if (
    error &&
    typeof error === "object" &&
    "details" in error &&
    typeof (error as Record<string, unknown>).details === "string"
  ) {
    errorMessage = (error as Record<string, string>).details;
  } else {
    errorMessage = t(
      "login.error_login_failed",
      "Login failed. Please check your credentials.",
    );
  }

  // Transform technical error messages into user-friendly ones
  if (
    errorMessage.includes("Invalid credentials") ||
    errorMessage.includes("Invalid username") ||
    errorMessage.includes("Invalid password") ||
    errorMessage.includes("Authentication failed") ||
    errorMessage.toLowerCase().includes("unauthorized")
  ) {
    errorMessage = t(
      "login.error_invalid_credentials",
      "Invalid username or password. Please try again.",
    );
  } else if (errorMessage.includes("Authentication required")) {
    // This happens when subsequent API calls fail due to auth issues
    errorMessage = t(
      "login.error_invalid_credentials",
      "Invalid username or password. Please try again.",
    );
  }

  loginError.value = errorMessage;
  isAuthenticating.value = false;
};

// Expose the method so App.vue can call it
defineExpose({
  handleAuthenticationError,
});

const loginWithHomeAssistant = async () => {
  isAuthenticating.value = true;
  loginError.value = null;

  try {
    const response = await api.sendCommand<{
      authorization_url: string;
    }>("auth/authorization_url", {
      provider_id: "homeassistant",
      return_url: window.location.href,
    });

    if (!response?.authorization_url) {
      throw new Error("Invalid response from server");
    }

    window.location.replace(response.authorization_url);
  } catch (error) {
    console.error("[Login] Failed to start Home Assistant OAuth:", error);
    loginError.value =
      error instanceof Error
        ? error.message
        : t(
            "login.error_oauth_failed",
            "Failed to start Home Assistant authentication.",
          );
    isAuthenticating.value = false;
  }
};

const goBack = () => {
  remoteConnectionManager.disconnect();
  api.disconnect();
  step.value = "select-mode";
  loginError.value = null;
  username.value = "";
  password.value = "";
  authProviders.value = [];
  connectedServerName.value = null;
  isRemoteConnection.value = false;
};

const cancelConnection = () => {
  remoteConnectionManager.disconnect();
  api.disconnect();
  isConnecting.value = false;
  step.value = "select-mode";
};

const retry = () => {
  connectionError.value = null;
  remoteConnectionManager.disconnect();
  api.disconnect();
  step.value = "select-mode";
};

// QR Scanner functions
const openQrScanner = () => {
  qrScannerError.value = null;
  showQrScanner.value = true;
};

const closeQrScanner = () => {
  showQrScanner.value = false;
  qrScannerError.value = null;
};

const onQrCodeDetected = (detectedCodes: { rawValue: string }[]) => {
  if (detectedCodes.length === 0) return;

  const qrData = detectedCodes[0].rawValue;

  // Try to extract remote_id and/or guest code from the QR code
  let extractedRemoteId: string | null = null;
  let extractedGuestCode: string | null = null;

  // Check if it's a URL with parameters
  try {
    const url = new URL(qrData);
    extractedRemoteId = url.searchParams.get("remote_id");
    extractedGuestCode = url.searchParams.get("join");
  } catch {
    // Not a URL, check if it's a raw remote ID (26 alphanumeric characters)
    const cleanData = qrData.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanData.length === 26) {
      extractedRemoteId = cleanData;
    }
  }

  // If we have a guest code (party QR), navigate to the full URL
  // This will trigger the autoConnect flow with the code parameter
  if (extractedGuestCode) {
    closeQrScanner();

    // Build the URL and navigate to trigger guest login flow
    if (extractedRemoteId) {
      // Remote party
      const newUrl = `${window.location.origin}${window.location.pathname}?remote_id=${extractedRemoteId}&join=${extractedGuestCode}#/guest`;
      window.location.href = newUrl;
    } else {
      // Local party
      const newUrl = `${window.location.origin}${window.location.pathname}?join=${extractedGuestCode}#/guest`;
      window.location.href = newUrl;
    }
    return;
  }

  // If we only have a remote ID (regular remote access QR), connect to remote
  if (extractedRemoteId) {
    setRemoteIdFromString(extractedRemoteId);
    closeQrScanner();
    nextTick(() => {
      connectToRemote();
    });
  } else {
    qrScannerError.value = t(
      "login.qr_invalid",
      "Invalid QR code. Please scan a Music Assistant QR code.",
    );
  }
};

const onQrScannerError = (error: Error) => {
  console.error("[Login] QR scanner error:", error);
  qrScannerError.value = t(
    "login.qr_camera_error",
    "Could not access camera. Please check permissions.",
  );
};

// Watch for connection state changes from App.vue
watch(
  () => api.state.value,
  (connectionState) => {
    if (connectionState === ConnectionState.RECONNECTING) {
      step.value = "reconnecting";
    } else if (connectionState === ConnectionState.AUTHENTICATING) {
      // Show connecting state during authentication
      step.value = "connecting";
    } else if (connectionState === ConnectionState.AUTH_REQUIRED) {
      // In Ingress mode, we should never show the login form
      // The authentication is automatic via HA proxy headers
      if (!isIngressMode.value) {
        // Auth is required - show select-mode to let user login
        // BUT: don't kick back to select-mode if we're in the login flow
        // (this happens when login fails - handleAuthenticationError will show the error)
        // Check for both 'login' and 'connecting' steps since AUTHENTICATING changes step to 'connecting'
        if (step.value !== "login" && step.value !== "connecting") {
          step.value = "select-mode";
        } else {
          // Go back to login step to show the error
          step.value = "login";
        }
      } else {
        // In Ingress mode, stay on reconnecting screen
        // App.vue will handle the re-authentication
        step.value = "reconnecting";
      }
    } else if (
      connectionState === ConnectionState.FAILED ||
      connectionState === ConnectionState.DISCONNECTED
    ) {
      // Connection failed or disconnected
      if (
        step.value === "reconnecting" &&
        api.state.value !== ConnectionState.AUTHENTICATED
      ) {
        // In Ingress mode, don't show select-mode on reconnect failure
        if (!isIngressMode.value) {
          // Show select-mode if we were reconnecting and auth failed
          step.value = "select-mode";
        }
      }
    }
  },
);

// Start auto-connect on mount (unless already reconnecting)
onMounted(() => {
  // Delay showing login UI to prevent flash during auto-authentication
  setTimeout(() => {
    showLoginUI.value = true;
  }, 300);

  if (api.state.value !== ConnectionState.RECONNECTING) {
    autoConnect();
  } else {
    step.value = "reconnecting";
  }
});
</script>

<style scoped>
.login-background {
  background: var(--background);
  min-height: 100vh;
  color: var(--foreground);
  opacity: 0;
  animation: fadeIn 0.3s ease-in forwards;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Remote ID segmented input */
.remote-id-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.remote-id-input {
  flex: 1;
  min-width: 0;
}

/* Adjust widths proportionally based on character count (8, 5, 5, 8) */
.remote-id-input-0,
.remote-id-input-3 {
  flex: 8;
}

.remote-id-input-1,
.remote-id-input-2 {
  flex: 5;
}

@media (max-width: 500px) {
  .remote-id-inputs {
    gap: 4px;
  }

  .remote-id-input {
    font-size: 0.875rem;
    padding: 0 4px;
    min-height: 44px;
  }
}

/* QR Scanner - inside DialogContent which teleports to <body> */
:global(.qr-scanner-wrapper video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
