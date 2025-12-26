<template>
  <div class="user-profile">
    <v-container class="pa-4 mx-auto" style="max-width: 600px">
      <ProfileSettings class="mb-6" />
      <PasswordSettings class="mb-6" />
      <SessionTokensList
        :tokens="sessionTokens"
        class="mb-6"
        @revoke="confirmRevokeToken"
      />
      <LongLivedTokensList
        :tokens="longLivedTokens"
        @revoke="confirmRevokeToken"
        @created="loadTokens"
      />
    </v-container>

    <v-dialog v-model="showRevokeDialog" max-width="500">
      <v-card>
        <v-card-title>
          {{
            tokenToRevoke?.is_long_lived
              ? $t("auth.revoke_token")
              : $t("auth.revoke_session")
          }}
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            {{
              tokenToRevoke?.is_long_lived
                ? $t("auth.revoke_token_confirm")
                : $t("auth.revoke_session_confirm")
            }}
          </p>
          <v-sheet class="bg-grey-lighten-4 pa-4 rounded">
            <p class="font-weight-medium mb-0">{{ tokenToRevoke?.name }}</p>
          </v-sheet>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRevokeDialog = false">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn
            color="error"
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
  display: flex;
  flex-direction: column;
}

@media (max-width: 600px) {
  .profile-container {
    padding: 12px;
  }
}
</style>
