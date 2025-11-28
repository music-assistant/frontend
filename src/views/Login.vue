<template>
  <v-app>
    <v-main class="login-background">
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="10" md="6" lg="5" xl="4">
            <v-card class="login-card pa-8" elevation="12" rounded="xl">
              <!-- Logo -->
              <div class="text-center mb-6">
                <img
                  src="@/assets/icon.svg"
                  alt="Music Assistant"
                  class="login-logo mb-4"
                />
                <h1 class="text-h4 font-weight-bold">Music Assistant</h1>
                <p class="text-body-2 text-medium-emphasis mt-2">
                  {{ getSubtitle }}
                </p>
              </div>

              <!-- Auto-connecting State -->
              <template v-if="step === 'auto-connect'">
                <div class="text-center py-6">
                  <v-progress-circular
                    indeterminate
                    color="primary"
                    size="64"
                    class="mb-4"
                  />
                  <p class="text-body-2 text-medium-emphasis">
                    {{ connectionStatusMessage }}
                  </p>
                </div>
              </template>

              <!-- Connection Mode Selector -->
              <template v-if="step === 'select-mode'">
                <!-- Remote-only mode -->
                <div v-if="isRemoteOnlyMode" class="mb-4 text-center">
                  <v-icon color="primary" size="48" class="mb-2"
                    >mdi-cloud</v-icon
                  >
                  <p class="text-body-2 text-medium-emphasis mb-4">
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
                  <label class="text-body-2 font-weight-medium mb-2 d-block">
                    {{ $t("login.server_address", "Server Address") }}
                  </label>
                  <v-text-field
                    v-model="serverAddress"
                    :placeholder="
                      $t(
                        'login.server_address_placeholder',
                        'http://192.168.1.100:8095',
                      )
                    "
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :error-messages="connectionError"
                    :disabled="isConnecting"
                    bg-color="surface-light"
                    @keyup.enter="connectToLocal"
                  />
                  <p class="text-caption text-medium-emphasis mt-2">
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
                  <label class="text-body-2 font-weight-medium mb-2 d-block">
                    {{ $t("login.remote_id", "Remote ID") }}
                  </label>
                  <v-text-field
                    v-model="remoteId"
                    :placeholder="
                      $t('login.remote_id_placeholder', 'e.g., MA-X7K9-P2M4')
                    "
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :error-messages="connectionError"
                    :disabled="isConnecting"
                    bg-color="surface-light"
                    @keyup.enter="connectToRemote"
                  />
                  <p class="text-caption text-medium-emphasis mt-2">
                    {{
                      $t(
                        "login.remote_id_hint",
                        'Find this in your server settings under "Remote Access"',
                      )
                    }}
                  </p>
                </div>

                <!-- Connect Button -->
                <v-btn
                  color="primary"
                  size="x-large"
                  block
                  rounded="lg"
                  class="mb-4 text-none"
                  :loading="isConnecting"
                  :disabled="
                    (isRemoteOnlyMode && !remoteId.trim()) ||
                    (showServerAddressInput && !serverAddress.trim())
                  "
                  @click="
                    isRemoteOnlyMode ? connectToRemote() : connectToLocal()
                  "
                >
                  {{ $t("login.connect", "Connect") }}
                </v-btn>
              </template>

              <!-- Login Form (after connection) -->
              <template v-if="step === 'login'">
                <!-- Connected server info -->
                <div v-if="connectedServerName" class="text-center mb-4">
                  <v-chip color="success" variant="tonal" size="small">
                    <v-icon start size="small">mdi-check-circle</v-icon>
                    {{ connectedServerName }}
                  </v-chip>
                </div>

                <!-- Username Field -->
                <div class="mb-4">
                  <label class="text-body-2 font-weight-medium mb-2 d-block">
                    {{ $t("login.username", "Username") }}
                  </label>
                  <v-text-field
                    v-model="username"
                    :placeholder="
                      $t('login.username_placeholder', 'Enter your username')
                    "
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :disabled="isAuthenticating"
                    bg-color="surface-light"
                    autofocus
                  />
                </div>

                <!-- Password Field -->
                <div class="mb-6">
                  <label class="text-body-2 font-weight-medium mb-2 d-block">
                    {{ $t("login.password", "Password") }}
                  </label>
                  <v-text-field
                    v-model="password"
                    :placeholder="
                      $t('login.password_placeholder', 'Enter your password')
                    "
                    :type="showPassword ? 'text' : 'password'"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :append-inner-icon="
                      showPassword ? 'mdi-eye-off' : 'mdi-eye'
                    "
                    :error-messages="loginError"
                    :disabled="isAuthenticating"
                    bg-color="surface-light"
                    @click:append-inner="showPassword = !showPassword"
                    @keyup.enter="login"
                  />
                </div>

                <!-- Sign In Button -->
                <v-btn
                  color="primary"
                  size="x-large"
                  block
                  rounded="lg"
                  class="mb-6 text-none"
                  :loading="isAuthenticating"
                  :disabled="!username.trim() || !password.trim()"
                  @click="login"
                >
                  {{ $t("login.sign_in", "Sign In") }}
                </v-btn>

                <!-- Home Assistant OAuth Button -->
                <v-btn
                  v-if="hasHomeAssistantAuth"
                  variant="outlined"
                  size="x-large"
                  block
                  rounded="lg"
                  class="text-none oauth-btn mt-4"
                  :loading="isAuthenticating"
                  @click="loginWithHomeAssistant"
                >
                  <img
                    src="@/assets/home-assistant-logo.svg"
                    alt="Home Assistant"
                    width="24"
                    height="24"
                    style="margin-right: 8px"
                  />
                  {{
                    $t("login.sign_in_with_ha", "Sign in with Home Assistant")
                  }}
                </v-btn>

                <!-- Back button -->
                <v-btn
                  variant="text"
                  class="mt-4"
                  block
                  :disabled="isAuthenticating"
                  @click="goBack"
                >
                  {{ $t("login.different_server", "Use different server") }}
                </v-btn>
              </template>

              <!-- OAuth Waiting -->
              <template v-if="step === 'oauth-waiting'">
                <div class="text-center py-6">
                  <img
                    src="@/assets/home-assistant-logo.svg"
                    alt="Home Assistant"
                    width="64"
                    height="64"
                    class="mb-4"
                    style="margin: 0 auto; display: block"
                  />
                  <p class="text-h6 mb-2">
                    {{ $t("login.complete_sign_in", "Complete Sign-in") }}
                  </p>
                  <p class="text-body-2 text-medium-emphasis mb-6">
                    {{
                      $t(
                        "login.oauth_waiting_message",
                        "A browser window has opened. Please sign in with Home Assistant, then return here.",
                      )
                    }}
                  </p>
                  <v-progress-circular
                    indeterminate
                    color="primary"
                    size="40"
                    class="mb-4"
                  />
                  <p class="text-caption text-medium-emphasis">
                    {{
                      $t(
                        "login.waiting_for_auth",
                        "Waiting for authentication...",
                      )
                    }}
                  </p>
                </div>
                <v-btn variant="text" block @click="cancelOAuth">
                  {{ $t("login.cancel", "Cancel") }}
                </v-btn>
              </template>

              <!-- Connecting State -->
              <template v-if="step === 'connecting'">
                <div class="text-center py-6">
                  <v-progress-circular
                    indeterminate
                    color="primary"
                    size="64"
                    class="mb-4"
                  />
                  <p class="text-h6 mb-2">
                    {{ $t("login.connecting", "Connecting...") }}
                  </p>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ connectionStatusMessage }}
                  </p>
                </div>
                <v-btn variant="text" block @click="cancelConnection">
                  {{ $t("login.cancel", "Cancel") }}
                </v-btn>
              </template>

              <!-- Error State -->
              <template v-if="step === 'error'">
                <div class="text-center py-6">
                  <v-icon color="error" size="64" class="mb-4"
                    >mdi-alert-circle</v-icon
                  >
                  <p class="text-h6 mb-2">
                    {{ $t("login.connection_failed", "Connection Failed") }}
                  </p>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ connectionError }}
                  </p>
                </div>
                <v-btn color="primary" block rounded="lg" @click="retry">
                  {{ $t("login.try_again", "Try Again") }}
                </v-btn>
              </template>
            </v-card>

            <!-- Footer -->
            <div class="text-center mt-6">
              <a
                href="https://www.openhomefoundation.org/"
                target="_blank"
                rel="noopener noreferrer"
                class="ohf-footer-link"
              >
                <p
                  class="text-caption text-medium-emphasis d-flex align-center justify-center"
                >
                  <img
                    src="@/assets/open-home-foundation-icon.svg"
                    alt="Open Home Foundation"
                    class="ohf-icon"
                  />
                  <span class="ml-1"
                    >Music Assistant is a product from the Open Home
                    Foundation</span
                  >
                </p>
              </a>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { remoteConnectionManager } from "@/plugins/remote";
import { api } from "@/plugins/api";
import type { AuthProvider } from "@/plugins/api/interfaces";

const { t } = useI18n();

// Storage keys
const STORAGE_KEY_SERVER_ADDRESS = "mass_server_address";
const STORAGE_KEY_REMOTE_ID = "mass_remote_id";
const STORAGE_KEY_TOKEN = "ma_access_token";

// Props and emits
const emit = defineEmits<{
  (e: "connected", transport: any): void;
  (
    e: "authenticated",
    credentials: {
      username?: string;
      password?: string;
      token?: string;
      user?: any;
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
    console.debug("[Login] Checking if hosted with API at:", baseUrl + "/info");
    const response = await fetch(`${baseUrl}/info`, {
      method: "GET",
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    if (!response.ok) {
      console.debug(
        "[Login] /info endpoint returned status:",
        response.status,
        "- not hosted with API",
      );
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

    console.debug(
      "[Login] /info endpoint check:",
      isMusicAssistant ? "Music Assistant server detected" : "not MA server",
    );
    return isMusicAssistant;
  } catch (error) {
    console.debug("[Login] /info endpoint check failed:", error);
    return false;
  }
};

// UI State
type Step =
  | "auto-connect"
  | "select-mode"
  | "login"
  | "connecting"
  | "oauth-waiting"
  | "error";
const step = ref<Step>("auto-connect");

// Connection state
const serverAddress = ref("");
const remoteId = ref("");
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

// OAuth state
const oauthSessionId = ref<string | null>(null);
const oauthPollingInterval = ref<number | null>(null);

// Computed
const getSubtitle = computed(() => {
  if (step.value === "auto-connect") {
    return t("login.auto_connecting", "Looking for your server...");
  }
  if (step.value === "login") {
    return t("login.sign_in_to_continue", "Sign in to continue");
  }
  if (step.value === "oauth-waiting") {
    return t("login.complete_in_browser", "Complete sign-in in your browser");
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
  console.log(`[Login] Trying to connect to: ${wsUrl}`);

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
const tryStoredTokenAuth = async (): Promise<boolean> => {
  const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  if (!storedToken) {
    console.log("[Login] No stored token found");
    return false;
  }

  try {
    console.log("[Login] Trying to authenticate with stored token");
    connectionStatusMessage.value = t(
      "login.authenticating",
      "Authenticating...",
    );

    // Authenticate the WebSocket session with the token
    const result = await api.authenticateWithToken(storedToken);
    console.log("[Login] Token authentication successful");

    // Emit authenticated event - App.vue will handle the rest
    emit("authenticated", { token: storedToken, user: result.user });
    return true;
  } catch (error) {
    console.log("[Login] Stored token authentication failed:", error);
    // Clear invalid token
    localStorage.removeItem(STORAGE_KEY_TOKEN);
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

  // Check if we're hosted with the API
  isHostedWithAPI.value = await checkIfHostedWithAPI();
  console.log("[Login] Hosted with API:", isHostedWithAPI.value);

  // If in remote-only mode, skip all local connection attempts
  if (isRemoteOnlyMode.value) {
    console.log("[Login] Remote-only mode, checking for stored remote ID");
    const storedRemoteId =
      localStorage.getItem(STORAGE_KEY_REMOTE_ID) ||
      remoteConnectionManager.getStoredRemoteId();
    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);

    if (storedRemoteId && storedToken) {
      console.log(
        "[Login] Found stored remote ID and token, trying auto-connect",
      );
      connectionStatusMessage.value = t(
        "login.connecting_remote",
        "Connecting to remote server...",
      );
      remoteId.value = storedRemoteId;

      try {
        const cleanRemoteId = storedRemoteId.trim().toUpperCase();
        const transport =
          await remoteConnectionManager.connectRemote(cleanRemoteId);

        // Connection established, emit connected event
        emit("connected", transport);

        // Wait for API to be ready
        if (await waitForApiConnection()) {
          // Try to authenticate with stored token
          if (await tryStoredTokenAuth()) {
            console.log("[Login] Remote auto-login successful!");
            return; // Success - App.vue will take over
          }
        }

        // Token auth failed, show login form
        console.log("[Login] Remote token auth failed, showing login form");
        connectedServerName.value = `Remote: ${cleanRemoteId}`;
        isRemoteConnection.value = true;
        await fetchAuthProviders();
        step.value = "login";
        return;
      } catch (error) {
        console.log("[Login] Remote auto-connect failed:", error);
      }
    } else if (storedRemoteId) {
      // Just pre-fill the remote ID field
      console.log("[Login] Found stored remote ID (no token):", storedRemoteId);
      remoteId.value = storedRemoteId;
    }

    // Show selection screen (only remote option)
    console.log("[Login] Remote-only mode, showing selection screen");
    step.value = "select-mode";
    return;
  }

  // 1. If hosted with API, try connecting to current host first
  if (isHostedWithAPI.value) {
    console.log("[Login] Hosted with API, trying local connection");
    connectionStatusMessage.value = t(
      "login.checking_local",
      "Checking local server...",
    );

    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const localWsUrl = getWebSocketUrlFromLocation();
    console.log("[Login] Trying local WebSocket:", localWsUrl);

    if (await tryConnect(localWsUrl, 3000)) {
      console.log("[Login] Local server found!");
      const address =
        window.location.origin + window.location.pathname.replace(/\/$/, "");
      serverAddress.value = address;

      // Establish connection
      emit("local-connect", address);
      localStorage.setItem(STORAGE_KEY_SERVER_ADDRESS, address);

      // Wait for WebSocket connection
      if (await waitForApiConnection()) {
        // Try to authenticate with stored token if available
        if (storedToken && (await tryStoredTokenAuth())) {
          console.log("[Login] Auto-login successful!");
          return; // Success - App.vue will take over
        }
      }

      // Show login form for this server
      console.log("[Login] Showing login form for local server");
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
    console.log("[Login] Found stored server address and token");
    connectionStatusMessage.value = t(
      "login.connecting_to_saved",
      "Connecting to saved server...",
    );

    const wsUrl = buildWebSocketUrl(storedAddress);
    if (await tryConnect(wsUrl)) {
      console.log("[Login] Stored server reachable, establishing connection");
      serverAddress.value = storedAddress;

      // Establish connection
      emit("local-connect", storedAddress);
      localStorage.setItem(STORAGE_KEY_SERVER_ADDRESS, storedAddress);

      // Wait for WebSocket connection
      if (await waitForApiConnection()) {
        // Try to authenticate with stored token
        if (await tryStoredTokenAuth()) {
          console.log("[Login] Auto-login successful!");
          return; // Success - App.vue will take over
        }
      }

      // Token auth failed, show login form for this server
      console.log("[Login] Token auth failed, showing login form");
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
    console.log("[Login] Stored server connection failed");
  }

  // 3. Try stored server address without token (show login form)
  if (storedAddress) {
    console.log("[Login] Found stored server address (no token)");
    connectionStatusMessage.value = t(
      "login.connecting_to_saved",
      "Connecting to saved server...",
    );

    const wsUrl = buildWebSocketUrl(storedAddress);
    if (await tryConnect(wsUrl)) {
      console.log("[Login] Stored server reachable");
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
    console.log(
      "[Login] Found stored remote ID and token, trying auto-connect",
    );
    connectionStatusMessage.value = t(
      "login.connecting_remote",
      "Connecting to remote server...",
    );
    remoteId.value = storedRemoteId;

    try {
      const cleanRemoteId = storedRemoteId.trim().toUpperCase();
      const transport =
        await remoteConnectionManager.connectRemote(cleanRemoteId);

      // Connection established, emit connected event
      emit("connected", transport);

      // Wait for API to be ready
      if (await waitForApiConnection()) {
        // Try to authenticate with stored token
        if (await tryStoredTokenAuth()) {
          console.log("[Login] Remote auto-login successful!");
          return; // Success - App.vue will take over
        }
      }

      // Token auth failed, show login form
      console.log("[Login] Remote token auth failed, showing login form");
      connectedServerName.value = `Remote: ${cleanRemoteId}`;
      isRemoteConnection.value = true;
      await fetchAuthProviders();
      step.value = "login";
      return;
    } catch (error) {
      console.log("[Login] Remote auto-connect failed:", error);
      // Fall through to show selection screen
    }
  } else if (storedRemoteId) {
    // Just pre-fill the remote ID field
    console.log("[Login] Found stored remote ID (no token):", storedRemoteId);
    remoteId.value = storedRemoteId;
  }

  // 5. No auto-connect possible, show selection screen
  console.log("[Login] Auto-connect failed, showing selection screen");
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
  if (!remoteId.value.trim()) return;

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
    if (serverInfo && (serverInfo as any).auth_providers) {
      authProviders.value = (serverInfo as any).auth_providers;
      console.log(
        "[Login] Auth providers from serverInfo:",
        authProviders.value,
      );
      return;
    }

    // Try to fetch auth providers (may require auth on some servers)
    const providers = await api.sendCommand<AuthProvider[]>("auth/providers");
    authProviders.value = providers || [];
    console.log("[Login] Auth providers:", authProviders.value);
  } catch (error) {
    // Auth providers fetch failed - this is expected if server requires auth first
    // Just show username/password form without OAuth options
    console.log(
      "[Login] Auth providers not available (may require auth first)",
    );
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
const handleAuthenticationError = (error: any) => {
  console.error("[Login] Authentication failed:", error);

  // Extract error message from different error types
  let errorMessage: string;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error.message === "string") {
    errorMessage = error.message;
  } else if (error && typeof error.details === "string") {
    errorMessage = error.details;
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
      session_id: string;
    }>("auth/authorization_url", {
      provider_id: "homeassistant",
      for_remote_client: true,
    });

    if (!response?.authorization_url || !response?.session_id) {
      throw new Error("Invalid response from server");
    }

    oauthSessionId.value = response.session_id;
    window.open(response.authorization_url, "_blank");
    step.value = "oauth-waiting";
    startOAuthPolling();
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

const startOAuthPolling = () => {
  oauthPollingInterval.value = window.setInterval(async () => {
    if (!oauthSessionId.value) {
      stopOAuthPolling();
      return;
    }

    try {
      const status = await api.sendCommand<{
        status: "pending" | "completed" | "error";
        access_token?: string;
        message?: string;
      }>("auth/oauth_status", {
        session_id: oauthSessionId.value,
      });

      if (status.status === "completed" && status.access_token) {
        stopOAuthPolling();
        const result = await api.authenticateWithToken(status.access_token);
        emit("authenticated", {
          token: status.access_token,
          user: result.user,
        });
      } else if (status.status === "error") {
        stopOAuthPolling();
        loginError.value =
          status.message ||
          t("login.error_oauth_failed", "Authentication failed.");
        step.value = "login";
        isAuthenticating.value = false;
      }
    } catch (error) {
      console.error("[Login] OAuth polling error:", error);
    }
  }, 2000);
};

const stopOAuthPolling = () => {
  if (oauthPollingInterval.value) {
    clearInterval(oauthPollingInterval.value);
    oauthPollingInterval.value = null;
  }
  oauthSessionId.value = null;
};

const cancelOAuth = () => {
  stopOAuthPolling();
  isAuthenticating.value = false;
  step.value = "login";
};

const goBack = () => {
  stopOAuthPolling();
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
  stopOAuthPolling();
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

// Start auto-connect on mount
onMounted(() => {
  autoConnect();
});

onUnmounted(() => {
  stopOAuthPolling();
});
</script>

<style scoped>
/* CSS Variables matching Music Assistant server styling */
.login-background {
  --fg: #000000;
  --background: #f5f5f5;
  --panel: #ffffff;
  --primary: #03a9f4;
  --text-secondary: rgba(0, 0, 0, 0.6);
  --text-tertiary: rgba(0, 0, 0, 0.4);
  --border: rgba(0, 0, 0, 0.1);
  --input-bg: rgba(0, 0, 0, 0.03);
  --input-focus-bg: rgba(3, 169, 244, 0.05);
  --error-text: #d32f2f;
  --success: #4caf50;

  background: var(--background);
  min-height: 100vh;
  color: var(--fg);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .login-background {
    --fg: #ffffff;
    --background: #181818;
    --panel: #232323;
    --text-secondary: rgba(255, 255, 255, 0.7);
    --text-tertiary: rgba(255, 255, 255, 0.4);
    --border: rgba(255, 255, 255, 0.08);
    --input-bg: rgba(255, 255, 255, 0.05);
    --input-focus-bg: rgba(3, 169, 244, 0.08);
    --error-text: #ff6b6b;
    --success: #66bb6a;
  }
}

.login-card {
  background: var(--panel) !important;
  border: 1px solid var(--border);
}

.login-logo {
  width: 80px;
  height: 80px;
}

.oauth-btn {
  border-color: var(--border) !important;
}

.oauth-btn:hover {
  border-color: var(--primary) !important;
  background: var(--input-focus-bg) !important;
}

:deep(.v-field) {
  border-radius: 10px !important;
}

:deep(.v-field--variant-outlined .v-field__outline__start) {
  border-radius: 10px 0 0 10px !important;
}

:deep(.v-field--variant-outlined .v-field__outline__end) {
  border-radius: 0 10px 10px 0 !important;
}

:deep(.v-card) {
  color: var(--fg) !important;
}

:deep(.v-card-title),
:deep(.v-card-text),
:deep(.text-h4),
:deep(.text-h6),
:deep(.text-body-2) {
  color: var(--fg) !important;
}

:deep(.text-medium-emphasis) {
  color: var(--text-secondary) !important;
}

:deep(.v-tab) {
  color: var(--text-secondary) !important;
}

:deep(.v-tab--selected) {
  color: var(--primary) !important;
}

:deep(.v-field__input) {
  color: var(--fg) !important;
}

:deep(.v-label) {
  color: var(--text-secondary) !important;
}

.ohf-footer-link {
  text-decoration: none;
  color: inherit;
  transition: opacity 0.2s;
}

.ohf-footer-link:hover {
  opacity: 0.7;
}

.ohf-icon {
  height: 16px;
  width: auto;
  flex-shrink: 0;
}
</style>
