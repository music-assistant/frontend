<template>
  <div class="user-profile">
    <Container variant="comfortable" class="profile-container">
      <div class="profile-content">
        <ProfileSettings />
        <v-divider class="my-6" />
        <PasswordSettings />
        <v-divider class="my-6" />
        <SessionTokensList
          :tokens="sessionTokens"
          @revoke="confirmRevokeToken"
        />
        <v-divider class="my-6" />
        <LongLivedTokensList
          :tokens="longLivedTokens"
          @revoke="confirmRevokeToken"
          @created="loadTokens"
        />
      </div>
    </Container>
    <v-dialog v-model="showRevokeDialog" max-width="480">
      <v-card>
        <v-card-title class="text-h6 pl-6 pb-0 mt-3">
          {{
            tokenToRevoke?.is_long_lived
              ? $t("auth.revoke_token")
              : $t("auth.revoke_session")
          }}
        </v-card-title>
        <v-card-text class="px-6 pb-2">
          <p class="text-body-1 mb-4">
            {{
              tokenToRevoke?.is_long_lived
                ? $t("auth.revoke_token_confirm")
                : $t("auth.revoke_session_confirm")
            }}
          </p>
          <div class="token-name-box">
            {{ tokenToRevoke?.name }}
          </div>
        </v-card-text>
        <v-card-actions class="pa-6 pt-4">
          <v-spacer />
          <v-btn variant="text" @click="showRevokeDialog = false">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="revokingToken"
            @click="handleRevokeToken"
          >
            {{ $t("auth.revoke") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import LongLivedTokensList from "@/components/profile/LongLivedTokensList.vue";
import PasswordSettings from "@/components/profile/PasswordSettings.vue";
import ProfileSettings from "@/components/profile/ProfileSettings.vue";
import SessionTokensList from "@/components/profile/SessionTokensList.vue";
import { api } from "@/plugins/api";
import type { AuthToken } from "@/plugins/api/interfaces";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const tokens = ref<AuthToken[]>([]);
const showRevokeDialog = ref(false);
const tokenToRevoke = ref<AuthToken | null>(null);
const revokingToken = ref(false);

const sessionTokens = computed(() =>
  tokens.value.filter((token) => !token.is_long_lived),
);

const longLivedTokens = computed(() =>
  tokens.value.filter((token) => token.is_long_lived),
);

const loadTokens = async () => {
  try {
    tokens.value = await api.getUserTokens();
  } catch (error) {
    console.error("Failed to load tokens:", error);
  }
};

const confirmRevokeToken = (token: AuthToken) => {
  tokenToRevoke.value = token;
  showRevokeDialog.value = true;
};

const handleRevokeToken = async () => {
  if (!tokenToRevoke.value) return;

  revokingToken.value = true;

  try {
    const success = await api.revokeToken(tokenToRevoke.value.token_id);
    if (success) {
      await loadTokens();
      const isSession = !tokenToRevoke.value.is_long_lived;
      toast.success(
        isSession ? t("auth.session_revoked") : t("auth.token_revoked"),
      );
    } else {
      const isSession = !tokenToRevoke.value.is_long_lived;
      toast.error(
        isSession
          ? t("auth.session_revoke_failed")
          : t("auth.token_revoke_failed"),
      );
    }
  } catch (error) {
    console.error("Failed to revoke token:", error);
    const isSession = !tokenToRevoke.value?.is_long_lived;
    toast.error(
      isSession
        ? t("auth.session_revoke_failed")
        : t("auth.token_revoke_failed"),
    );
  } finally {
    showRevokeDialog.value = false;
    tokenToRevoke.value = null;
    revokingToken.value = false;
  }
};

onMounted(() => {
  loadTokens();
});
</script>

<style scoped>
.user-profile {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.profile-container {
  padding: 24px 20px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.profile-content {
  background: rgba(var(--v-theme-surface), 0.4);
  border-radius: 8px;
  padding: 24px;
  border: 1px solid rgba(var(--v-border-color), 0.12);
}

@media (max-width: 600px) {
  .profile-container {
    padding: 12px;
  }

  .profile-content {
    padding: 16px;
    border-radius: 8px;
  }
}

.token-name-box {
  background: rgba(var(--v-theme-error), 0.08);
  border-left: 3px solid rgb(var(--v-theme-error));
  padding: 12px 16px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.938rem;
}
</style>
