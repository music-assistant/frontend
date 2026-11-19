<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="security" />
    <PasswordSettings />
    <SessionTokensList :tokens="sessionTokens" @revoke="confirmRevokeToken" />
    <LongLivedTokensList
      :tokens="longLivedTokens"
      @revoke="confirmRevokeToken"
      @created="loadTokens"
    />

    <Dialog v-model:open="showRevokeDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{
              tokenToRevoke?.is_long_lived
                ? $t("auth.revoke_token")
                : $t("auth.revoke_session")
            }}
          </DialogTitle>
        </DialogHeader>
        <div class="py-4">
          <p class="text-sm text-muted-foreground mb-4">
            {{
              tokenToRevoke?.is_long_lived
                ? $t("auth.revoke_token_confirm")
                : $t("auth.revoke_session_confirm")
            }}
          </p>
          <div class="rounded-md bg-destructive/10 p-4">
            <p class="font-medium">{{ tokenToRevoke?.name }}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showRevokeDialog = false">
            {{ $t("cancel") }}
          </Button>
          <Button
            variant="destructive"
            :loading="revokingToken"
            @click="handleRevokeToken"
          >
            {{ $t("auth.revoke") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import LongLivedTokensList from "@/components/profile/LongLivedTokensList.vue";
import PasswordSettings from "@/components/profile/PasswordSettings.vue";
import SessionTokensList from "@/components/profile/SessionTokensList.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/plugins/api";
import type { AuthToken } from "@/plugins/api/interfaces";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

/**
 * The security of the signed-in user's account: the password, the active
 * sessions and the long-lived access tokens.
 */

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
