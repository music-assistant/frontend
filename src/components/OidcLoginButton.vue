<template>
  <Button
    variant="outline"
    class="mt-4 h-14 w-full rounded-lg text-base"
    :disabled="disabled || isStarting"
    @click="startLogin"
  >
    <LoaderCircle v-if="isStarting" class="size-5 animate-spin" />
    <KeyRound v-else class="size-5" />
    {{ t("login.sign_in_with_provider", { provider: providerName }) }}
  </Button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { KeyRound, LoaderCircle } from "@lucide/vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/plugins/api";
import type { AuthProvider } from "@/plugins/api/interfaces";
import { isWebUrl } from "@/helpers/utils";

const props = defineProps<{ provider: AuthProvider; disabled?: boolean }>();
const emit = defineEmits<{
  busy: [value: boolean];
  error: [message: string | null];
}>();
const { t } = useI18n();
const isStarting = ref(false);
const providerName = computed(() => props.provider.name || "OpenID Connect");
let isActive = true;

onBeforeUnmount(() => {
  isActive = false;
  // The login form can disappear while authorization is still pending.
  if (isStarting.value) emit("busy", false);
});

const startLogin = async () => {
  isStarting.value = true;
  emit("busy", true);
  emit("error", null);
  try {
    const result = await api.startAuthorization(
      props.provider.provider_id,
      window.location.href,
      undefined,
      { suppressGlobalError: true },
    );
    if (!isActive) return;
    if (!isWebUrl(result.authorization_url)) {
      throw new Error(result.error || t("login.error_external_login_failed"));
    }
    toast.success(t("login.redirecting_to_provider"));
    // The server entry point creates browser-bound state before visiting the IdP.
    window.location.replace(result.authorization_url);
  } catch (error) {
    if (!isActive) return;
    const message =
      error instanceof Error
        ? error.message
        : t("login.error_external_login_failed");
    toast.error(message);
    emit("error", message);
    emit("busy", false);
    isStarting.value = false;
  }
};
</script>
