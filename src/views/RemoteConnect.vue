<template>
  <v-app>
    <v-main class="d-flex align-center justify-center" style="min-height: 100vh">
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="6" lg="4">
            <!-- Logo and Title -->
            <div class="text-center mb-8">
              <v-img
                src="/logo.svg"
                alt="Music Assistant"
                max-height="80"
                class="mx-auto mb-4"
              />
              <h1 class="text-h4 font-weight-bold">Music Assistant</h1>
              <p class="text-subtitle-1 text-medium-emphasis mt-2">
                {{ getSubtitle }}
              </p>
            </div>

            <!-- Connection Card -->
            <v-card elevation="8" class="pa-6">
              <!-- Step 1: Enter Remote ID -->
              <template v-if="step === 'remote-id'">
                <v-card-title class="text-h6 text-center pb-4">
                  {{ $t('remote.connect_title', 'Connect to your server') }}
                </v-card-title>

                <v-card-text>
                  <v-text-field
                    v-model="remoteId"
                    :label="$t('remote.remote_id', 'Remote ID')"
                    :placeholder="$t('remote.remote_id_placeholder', 'e.g., MA-X7K9-P2M4')"
                    variant="outlined"
                    prepend-inner-icon="mdi-lan-connect"
                    :error-messages="connectionError"
                    :disabled="isConnecting"
                    @keyup.enter="connectToRemote"
                    autofocus
                  />

                  <p class="text-caption text-medium-emphasis mt-2">
                    {{
                      $t(
                        'remote.remote_id_hint',
                        'Find your Remote ID in your Music Assistant server settings under "Remote Access".'
                      )
                    }}
                  </p>

                  <!-- Stored Connections -->
                  <template v-if="storedConnections.length > 0">
                    <v-divider class="my-4" />
                    <p class="text-subtitle-2 mb-2">
                      {{ $t('remote.recent_connections', 'Recent Connections') }}
                    </p>
                    <v-list density="compact" class="bg-transparent">
                      <v-list-item
                        v-for="conn in storedConnections"
                        :key="conn.remoteId"
                        @click="selectStoredConnection(conn)"
                        :disabled="isConnecting"
                        class="rounded mb-1"
                      >
                        <template v-slot:prepend>
                          <v-icon>mdi-server</v-icon>
                        </template>
                        <v-list-item-title>
                          {{ conn.serverName || conn.remoteId }}
                        </v-list-item-title>
                        <v-list-item-subtitle v-if="conn.serverName">
                          {{ conn.remoteId }}
                        </v-list-item-subtitle>
                        <template v-slot:append>
                          <v-btn
                            icon
                            variant="text"
                            size="small"
                            @click.stop="removeStoredConnection(conn.remoteId)"
                          >
                            <v-icon size="small">mdi-close</v-icon>
                          </v-btn>
                        </template>
                      </v-list-item>
                    </v-list>
                  </template>
                </v-card-text>

                <v-card-actions class="flex-column">
                  <v-btn
                    color="primary"
                    size="large"
                    block
                    :loading="isConnecting"
                    :disabled="!remoteId.trim()"
                    @click="connectToRemote"
                  >
                    {{ $t('remote.connect', 'Connect') }}
                  </v-btn>

                  <v-btn
                    v-if="canConnectLocally"
                    variant="text"
                    class="mt-3"
                    @click="switchToLocal"
                  >
                    {{ $t('remote.connect_locally', 'Connect to local server instead') }}
                  </v-btn>
                </v-card-actions>
              </template>

              <!-- Step 2: Login -->
              <template v-else-if="step === 'login'">
                <v-card-title class="text-h6 text-center pb-4">
                  {{ $t('remote.login_title', 'Sign in to your server') }}
                </v-card-title>

                <v-card-subtitle class="text-center pb-4">
                  <v-chip size="small" color="primary" variant="tonal">
                    <v-icon start size="small">mdi-lan-connect</v-icon>
                    {{ currentRemoteId }}
                  </v-chip>
                </v-card-subtitle>

                <v-card-text>
                  <v-form @submit.prevent="login" ref="loginForm">
                    <v-text-field
                      v-model="username"
                      :label="$t('remote.username', 'Username')"
                      variant="outlined"
                      prepend-inner-icon="mdi-account"
                      :error-messages="loginError && !password ? loginError : ''"
                      :disabled="isAuthenticating"
                      autofocus
                    />

                    <v-text-field
                      v-model="password"
                      :label="$t('remote.password', 'Password')"
                      :type="showPassword ? 'text' : 'password'"
                      variant="outlined"
                      prepend-inner-icon="mdi-lock"
                      :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showPassword = !showPassword"
                      :error-messages="loginError"
                      :disabled="isAuthenticating"
                      @keyup.enter="login"
                    />

                    <v-checkbox
                      v-model="rememberCredentials"
                      :label="$t('remote.remember_me', 'Remember me on this device')"
                      density="compact"
                      hide-details
                    />
                  </v-form>
                </v-card-text>

                <v-card-actions class="flex-column">
                  <v-btn
                    color="primary"
                    size="large"
                    block
                    :loading="isAuthenticating"
                    :disabled="!username.trim() || !password.trim()"
                    @click="login"
                  >
                    {{ $t('remote.sign_in', 'Sign In') }}
                  </v-btn>

                  <v-btn variant="text" class="mt-3" @click="goBack" :disabled="isAuthenticating">
                    {{ $t('remote.back', 'Back') }}
                  </v-btn>
                </v-card-actions>
              </template>

              <!-- Step 3: Connecting -->
              <template v-else-if="step === 'connecting'">
                <v-card-text class="text-center py-8">
                  <v-progress-circular indeterminate color="primary" size="64" class="mb-4" />
                  <p class="text-h6">{{ $t('remote.connecting', 'Connecting...') }}</p>
                  <p class="text-body-2 text-medium-emphasis mt-2">
                    {{ connectionStatusMessage }}
                  </p>
                </v-card-text>

                <v-card-actions>
                  <v-btn variant="text" block @click="cancelConnection">
                    {{ $t('remote.cancel', 'Cancel') }}
                  </v-btn>
                </v-card-actions>
              </template>

              <!-- Error State -->
              <template v-else-if="step === 'error'">
                <v-card-text class="text-center py-8">
                  <v-icon color="error" size="64" class="mb-4">mdi-alert-circle</v-icon>
                  <p class="text-h6">{{ $t('remote.connection_failed', 'Connection Failed') }}</p>
                  <p class="text-body-2 text-medium-emphasis mt-2">
                    {{ connectionError }}
                  </p>
                </v-card-text>

                <v-card-actions>
                  <v-btn color="primary" block @click="retry">
                    {{ $t('remote.retry', 'Try Again') }}
                  </v-btn>
                </v-card-actions>
              </template>
            </v-card>

            <!-- Footer -->
            <div class="text-center mt-6 text-caption text-medium-emphasis">
              <a
                href="https://music-assistant.io"
                target="_blank"
                class="text-decoration-none text-inherit"
              >
                music-assistant.io
              </a>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  remoteConnectionManager,
  RemoteConnectionState,
  type StoredRemoteConnection,
} from '@/plugins/remote';

const { t } = useI18n();

// Props and emits
const emit = defineEmits<{
  (e: 'connected', transport: any): void;
  (e: 'authenticated', user: any): void;
  (e: 'switch-to-local'): void;
}>();

// Define props with defaults
const props = withDefaults(
  defineProps<{
    canConnectLocally?: boolean;
  }>(),
  {
    canConnectLocally: false,
  }
);

// UI State
type Step = 'remote-id' | 'login' | 'connecting' | 'error';
const step = ref<Step>('remote-id');

// Connection state
const remoteId = ref('');
const currentRemoteId = ref<string | null>(null);
const isConnecting = ref(false);
const connectionError = ref<string | null>(null);
const connectionStatusMessage = ref('');

// Login state
const username = ref('');
const password = ref('');
const showPassword = ref(false);
const rememberCredentials = ref(true);
const isAuthenticating = ref(false);
const loginError = ref<string | null>(null);

// Stored connections
const storedConnections = computed(() => remoteConnectionManager.storedConnections);

// Computed
const getSubtitle = computed(() => {
  if (step.value === 'login') {
    return t('remote.subtitle_login', 'Sign in to access your music');
  }
  return t('remote.subtitle', 'Connect to your home server from anywhere');
});

// Methods
const connectToRemote = async () => {
  if (!remoteId.value.trim()) return;

  isConnecting.value = true;
  connectionError.value = null;
  currentRemoteId.value = remoteId.value.trim().toUpperCase();
  step.value = 'connecting';
  connectionStatusMessage.value = t(
    'remote.status_connecting_signaling',
    'Connecting to signaling server...'
  );

  try {
    // Update status as we progress
    connectionStatusMessage.value = t(
      'remote.status_finding_server',
      'Finding your server...'
    );

    const transport = await remoteConnectionManager.connectRemote(currentRemoteId.value);

    connectionStatusMessage.value = t(
      'remote.status_establishing',
      'Establishing secure connection...'
    );

    // Connection established, now need to authenticate
    step.value = 'login';
    emit('connected', transport);
  } catch (error) {
    console.error('[RemoteConnect] Connection failed:', error);
    connectionError.value =
      error instanceof Error ? error.message : t('remote.error_unknown', 'Unknown error occurred');
    step.value = 'error';
  } finally {
    isConnecting.value = false;
  }
};

const login = async () => {
  if (!username.value.trim() || !password.value.trim()) return;

  isAuthenticating.value = true;
  loginError.value = null;

  try {
    // Send login command over the WebRTC connection
    // The actual authentication is handled by the API
    const credentials = {
      username: username.value.trim(),
      password: password.value,
    };

    // Store credentials if requested
    if (rememberCredentials.value && currentRemoteId.value) {
      // We'll store the auth token after successful login, not the password
    }

    emit('authenticated', credentials);
  } catch (error) {
    console.error('[RemoteConnect] Login failed:', error);
    loginError.value =
      error instanceof Error
        ? error.message
        : t('remote.error_login_failed', 'Login failed. Please check your credentials.');
    isAuthenticating.value = false;
  }
};

const selectStoredConnection = (conn: StoredRemoteConnection) => {
  remoteId.value = conn.remoteId;
  connectToRemote();
};

const removeStoredConnection = (id: string) => {
  remoteConnectionManager.removeStoredConnection(id);
};

const goBack = () => {
  remoteConnectionManager.disconnect();
  step.value = 'remote-id';
  loginError.value = null;
  username.value = '';
  password.value = '';
};

const cancelConnection = () => {
  remoteConnectionManager.disconnect();
  isConnecting.value = false;
  step.value = 'remote-id';
};

const retry = () => {
  connectionError.value = null;
  step.value = 'remote-id';
};

const switchToLocal = () => {
  emit('switch-to-local');
};

// Check for stored remote ID on mount
onMounted(() => {
  const storedId = remoteConnectionManager.getStoredRemoteId();
  if (storedId) {
    remoteId.value = storedId;
  }
});
</script>

<style scoped>
.v-card {
  background: rgba(var(--v-theme-surface), 0.95);
  backdrop-filter: blur(10px);
}
</style>
