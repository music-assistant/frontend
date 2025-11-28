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

              <!-- Connection Mode Selector (only if not auto-detected local) -->
              <v-tabs
                v-if="showConnectionTabs && step === 'select-mode'"
                v-model="connectionMode"
                class="mb-6"
                grow
                color="primary"
              >
                <v-tab value="local">
                  <v-icon start>mdi-server</v-icon>
                  {{ $t('login.local_server', 'Local Server') }}
                </v-tab>
                <v-tab value="remote">
                  <v-icon start>mdi-cloud</v-icon>
                  {{ $t('login.remote_server', 'Remote') }}
                </v-tab>
              </v-tabs>

              <!-- Local Server Input (when not auto-detected) -->
              <div v-if="connectionMode === 'local' && step === 'select-mode' && !isLocalServer" class="mb-4">
                <label class="text-body-2 font-weight-medium mb-2 d-block">
                  {{ $t('login.server_address', 'Server Address') }}
                </label>
                <v-text-field
                  v-model="serverAddress"
                  :placeholder="$t('login.server_address_placeholder', 'http://192.168.1.100:8095')"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  :error-messages="connectionError"
                  :disabled="isConnecting"
                  bg-color="surface-light"
                  @keyup.enter="connectToLocal"
                />
              </div>

              <!-- Remote ID Input -->
              <div v-if="connectionMode === 'remote' && step === 'select-mode'" class="mb-4">
                <label class="text-body-2 font-weight-medium mb-2 d-block">
                  {{ $t('login.remote_id', 'Remote ID') }}
                </label>
                <v-text-field
                  v-model="remoteId"
                  :placeholder="$t('login.remote_id_placeholder', 'e.g., MA-X7K9-P2M4')"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  :error-messages="connectionError"
                  :disabled="isConnecting"
                  bg-color="surface-light"
                  @keyup.enter="connectToRemote"
                />
                <p class="text-caption text-medium-emphasis mt-2">
                  {{ $t('login.remote_id_hint', 'Find this in your server settings under "Remote Access"') }}
                </p>
              </div>

              <!-- Connect Button for mode selection -->
              <v-btn
                v-if="step === 'select-mode'"
                color="primary"
                size="x-large"
                block
                rounded="lg"
                class="mb-4 text-none"
                :loading="isConnecting"
                :disabled="(connectionMode === 'remote' && !remoteId.trim()) || (connectionMode === 'local' && !isLocalServer && !serverAddress.trim())"
                @click="connectionMode === 'remote' ? connectToRemote() : connectToLocal()"
              >
                {{ $t('login.connect', 'Connect') }}
              </v-btn>

              <!-- Login Form (after connection) -->
              <template v-if="step === 'login'">
                <!-- Username Field -->
                <div class="mb-4">
                  <label class="text-body-2 font-weight-medium mb-2 d-block">
                    {{ $t('login.username', 'Username') }}
                  </label>
                  <v-text-field
                    v-model="username"
                    :placeholder="$t('login.username_placeholder', 'Enter your username')"
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
                    {{ $t('login.password', 'Password') }}
                  </label>
                  <v-text-field
                    v-model="password"
                    :placeholder="$t('login.password_placeholder', 'Enter your password')"
                    :type="showPassword ? 'text' : 'password'"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append-inner="showPassword = !showPassword"
                    :error-messages="loginError"
                    :disabled="isAuthenticating"
                    bg-color="surface-light"
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
                  {{ $t('login.sign_in', 'Sign In') }}
                </v-btn>

                <!-- OAuth Divider -->
                <div v-if="hasHomeAssistantAuth" class="d-flex align-center my-6">
                  <v-divider class="flex-grow-1" />
                  <span class="mx-4 text-body-2 text-medium-emphasis">
                    {{ $t('login.or_continue_with', 'Or continue with') }}
                  </span>
                  <v-divider class="flex-grow-1" />
                </div>

                <!-- Home Assistant OAuth Button -->
                <v-btn
                  v-if="hasHomeAssistantAuth"
                  variant="outlined"
                  size="x-large"
                  block
                  rounded="lg"
                  class="text-none oauth-btn"
                  :loading="isAuthenticating"
                  @click="loginWithHomeAssistant"
                >
                  <v-icon start>mdi-home-assistant</v-icon>
                  {{ $t('login.sign_in_with_ha', 'Sign in with Home Assistant') }}
                </v-btn>

                <!-- Back button if remote -->
                <v-btn
                  v-if="isRemoteConnection"
                  variant="text"
                  class="mt-4"
                  block
                  @click="goBack"
                  :disabled="isAuthenticating"
                >
                  {{ $t('login.back', 'Back') }}
                </v-btn>
              </template>

              <!-- OAuth Waiting -->
              <template v-if="step === 'oauth-waiting'">
                <div class="text-center py-6">
                  <v-icon color="primary" size="64" class="mb-4">mdi-home-assistant</v-icon>
                  <p class="text-h6 mb-2">{{ $t('login.complete_sign_in', 'Complete Sign-in') }}</p>
                  <p class="text-body-2 text-medium-emphasis mb-6">
                    {{ $t('login.oauth_waiting_message', 'A browser window has opened. Please sign in with Home Assistant, then return here.') }}
                  </p>
                  <v-progress-circular indeterminate color="primary" size="40" class="mb-4" />
                  <p class="text-caption text-medium-emphasis">
                    {{ $t('login.waiting_for_auth', 'Waiting for authentication...') }}
                  </p>
                </div>
                <v-btn variant="text" block @click="cancelOAuth">
                  {{ $t('login.cancel', 'Cancel') }}
                </v-btn>
              </template>

              <!-- Connecting State -->
              <template v-if="step === 'connecting'">
                <div class="text-center py-6">
                  <v-progress-circular indeterminate color="primary" size="64" class="mb-4" />
                  <p class="text-h6 mb-2">{{ $t('login.connecting', 'Connecting...') }}</p>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ connectionStatusMessage }}
                  </p>
                </div>
                <v-btn variant="text" block @click="cancelConnection">
                  {{ $t('login.cancel', 'Cancel') }}
                </v-btn>
              </template>

              <!-- Error State -->
              <template v-if="step === 'error'">
                <div class="text-center py-6">
                  <v-icon color="error" size="64" class="mb-4">mdi-alert-circle</v-icon>
                  <p class="text-h6 mb-2">{{ $t('login.connection_failed', 'Connection Failed') }}</p>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ connectionError }}
                  </p>
                </div>
                <v-btn color="primary" block rounded="lg" @click="retry">
                  {{ $t('login.try_again', 'Try Again') }}
                </v-btn>
              </template>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  remoteConnectionManager,
  type StoredRemoteConnection,
} from '@/plugins/remote';
import { api } from '@/plugins/api';

const { t } = useI18n();

// Props and emits
const emit = defineEmits<{
  (e: 'connected', transport: any): void;
  (e: 'authenticated', credentials: { username?: string; password?: string; token?: string; user?: any }): void;
  (e: 'local-connect', serverAddress: string): void;
}>();

// Detect if we're hosted on the server itself
const isLocalServer = computed(() => {
  const hostname = window.location.hostname;
  // If accessing via IP or localhost on standard MA port, we're local
  return !['app.music-assistant.io', 'music-assistant.github.io'].some(h => hostname.includes(h));
});

// UI State
type Step = 'select-mode' | 'login' | 'connecting' | 'oauth-waiting' | 'error';
const step = ref<Step>('select-mode');
const connectionMode = ref<'local' | 'remote'>(isLocalServer.value ? 'local' : 'remote');
const showConnectionTabs = computed(() => !isLocalServer.value);

// Connection state
const serverAddress = ref('');
const remoteId = ref('');
const isConnecting = ref(false);
const connectionError = ref<string | null>(null);
const connectionStatusMessage = ref('');
const isRemoteConnection = ref(false);

// Login state
const username = ref('');
const password = ref('');
const showPassword = ref(false);
const isAuthenticating = ref(false);
const loginError = ref<string | null>(null);

// Auth providers state
const authProviders = ref<Array<{ id: string; name: string; type: string }>>([]);
const hasHomeAssistantAuth = computed(() =>
  authProviders.value.some(p => p.id === 'hass' || p.type === 'hass')
);

// OAuth state
const oauthSessionId = ref<string | null>(null);
const oauthPollingInterval = ref<number | null>(null);

// Computed
const getSubtitle = computed(() => {
  if (step.value === 'login') {
    return t('login.sign_in_to_continue', 'Sign in to continue');
  }
  if (step.value === 'oauth-waiting') {
    return t('login.complete_in_browser', 'Complete sign-in in your browser');
  }
  if (step.value === 'connecting') {
    return t('login.establishing_connection', 'Establishing connection...');
  }
  return t('login.subtitle', 'Connect to your music server');
});

// Methods
const connectToLocal = async () => {
  if (!isLocalServer.value && !serverAddress.value.trim()) return;

  isConnecting.value = true;
  connectionError.value = null;
  isRemoteConnection.value = false;
  step.value = 'connecting';
  connectionStatusMessage.value = t('login.connecting_to_server', 'Connecting to server...');

  try {
    const address = isLocalServer.value
      ? window.location.origin
      : serverAddress.value.trim();

    // For local connections, emit event to let App.vue handle it
    emit('local-connect', address);

    // Fetch auth providers
    await fetchAuthProviders();

    step.value = 'login';
  } catch (error) {
    console.error('[Login] Local connection failed:', error);
    connectionError.value = error instanceof Error ? error.message : t('login.error_unknown', 'Unknown error occurred');
    step.value = 'error';
  } finally {
    isConnecting.value = false;
  }
};

const connectToRemote = async () => {
  if (!remoteId.value.trim()) return;

  isConnecting.value = true;
  connectionError.value = null;
  isRemoteConnection.value = true;
  step.value = 'connecting';
  connectionStatusMessage.value = t('login.connecting_to_signaling', 'Connecting to signaling server...');

  try {
    connectionStatusMessage.value = t('login.finding_server', 'Finding your server...');

    const transport = await remoteConnectionManager.connectRemote(remoteId.value.trim().toUpperCase());

    connectionStatusMessage.value = t('login.establishing_secure', 'Establishing secure connection...');

    // Connection established, emit connected event
    emit('connected', transport);

    // Fetch available auth providers
    await fetchAuthProviders();

    step.value = 'login';
  } catch (error) {
    console.error('[Login] Remote connection failed:', error);
    connectionError.value = error instanceof Error ? error.message : t('login.error_unknown', 'Unknown error occurred');
    step.value = 'error';
  } finally {
    isConnecting.value = false;
  }
};

const fetchAuthProviders = async () => {
  try {
    const providers = await api.sendCommand<Array<{ id: string; name: string; type: string }>>('auth/providers');
    authProviders.value = providers || [];
    console.log('[Login] Auth providers:', authProviders.value);
  } catch (error) {
    console.error('[Login] Failed to fetch auth providers:', error);
    authProviders.value = [];
  }
};

const login = async () => {
  if (!username.value.trim() || !password.value.trim()) return;

  isAuthenticating.value = true;
  loginError.value = null;

  try {
    emit('authenticated', {
      username: username.value.trim(),
      password: password.value,
    });
  } catch (error) {
    console.error('[Login] Login failed:', error);
    loginError.value = error instanceof Error
      ? error.message
      : t('login.error_login_failed', 'Login failed. Please check your credentials.');
    isAuthenticating.value = false;
  }
};

const loginWithHomeAssistant = async () => {
  isAuthenticating.value = true;
  loginError.value = null;

  try {
    const response = await api.sendCommand<{ authorization_url: string; session_id: string }>(
      'auth/authorization_url',
      {
        provider_id: 'hass',
        for_remote_client: true,
      }
    );

    if (!response?.authorization_url || !response?.session_id) {
      throw new Error('Invalid response from server');
    }

    oauthSessionId.value = response.session_id;
    window.open(response.authorization_url, '_blank');
    step.value = 'oauth-waiting';
    startOAuthPolling();
  } catch (error) {
    console.error('[Login] Failed to start Home Assistant OAuth:', error);
    loginError.value = error instanceof Error
      ? error.message
      : t('login.error_oauth_failed', 'Failed to start Home Assistant authentication.');
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
        status: 'pending' | 'completed' | 'error';
        access_token?: string;
        message?: string;
      }>('auth/oauth_status', {
        session_id: oauthSessionId.value,
      });

      if (status.status === 'completed' && status.access_token) {
        stopOAuthPolling();
        const result = await api.authenticateWithToken(status.access_token);
        emit('authenticated', { token: status.access_token, user: result.user });
      } else if (status.status === 'error') {
        stopOAuthPolling();
        loginError.value = status.message || t('login.error_oauth_failed', 'Authentication failed.');
        step.value = 'login';
        isAuthenticating.value = false;
      }
    } catch (error) {
      console.error('[Login] OAuth polling error:', error);
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
  step.value = 'login';
};

const goBack = () => {
  stopOAuthPolling();
  remoteConnectionManager.disconnect();
  step.value = 'select-mode';
  loginError.value = null;
  username.value = '';
  password.value = '';
  authProviders.value = [];
};

const cancelConnection = () => {
  stopOAuthPolling();
  remoteConnectionManager.disconnect();
  isConnecting.value = false;
  step.value = 'select-mode';
};

const retry = () => {
  connectionError.value = null;
  step.value = 'select-mode';
};

// Auto-connect if local server
onMounted(async () => {
  if (isLocalServer.value) {
    // Auto-connect to local server
    await connectToLocal();
  } else {
    // Check for stored remote ID
    const storedId = remoteConnectionManager.getStoredRemoteId();
    if (storedId) {
      remoteId.value = storedId;
    }
  }
});

onUnmounted(() => {
  stopOAuthPolling();
});
</script>

<style scoped>
.login-background {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
}

.login-card {
  background: rgba(30, 30, 46, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.login-logo {
  width: 80px;
  height: 80px;
}

.oauth-btn {
  border-color: rgba(255, 255, 255, 0.2);
}

.oauth-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
}

:deep(.v-field) {
  border-radius: 12px !important;
}

:deep(.v-field--variant-outlined .v-field__outline__start) {
  border-radius: 12px 0 0 12px !important;
}

:deep(.v-field--variant-outlined .v-field__outline__end) {
  border-radius: 0 12px 12px 0 !important;
}
</style>
