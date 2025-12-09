<template>
  <div class="password-settings">
    <div class="section-header">
      <h3>{{ $t("auth.change_password") }}</h3>
      <p class="section-subtitle">
        {{ $t("auth.update_your_password") }}
      </p>
    </div>

    <v-alert
      v-if="store.isIngressSession"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ $t("auth.ingress_password_note") }}
    </v-alert>

    <v-form ref="passwordForm" @submit.prevent="handleChangePassword">
      <v-text-field
        v-model="newPassword"
        :label="$t('auth.new_password')"
        type="password"
        variant="outlined"
        density="comfortable"
        class="mb-2"
        :rules="[rules.required, rules.passwordLength]"
      />

      <v-text-field
        v-model="confirmNewPassword"
        :label="$t('auth.confirm_password')"
        type="password"
        variant="outlined"
        density="comfortable"
        class="mb-4"
        :rules="[rules.required, rules.passwordMatch]"
      />

      <v-btn
        type="submit"
        color="primary"
        variant="flat"
        :loading="changing"
        :disabled="!canChangePassword"
      >
        {{ $t("auth.change_password") }}
      </v-btn>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const newPassword = ref("");
const confirmNewPassword = ref("");
const changing = ref(false);
const passwordForm = ref<any>(null);

const rules = {
  required: (v: string) => !!v || t("auth.field_required"),
  passwordLength: (v: string) => v.length >= 8 || t("auth.password_min_length"),
  passwordMatch: (v: string) =>
    v === newPassword.value || t("auth.passwords_must_match"),
};

const canChangePassword = computed(() => {
  return (
    newPassword.value.length >= 8 &&
    newPassword.value === confirmNewPassword.value
  );
});

const handleChangePassword = async () => {
  changing.value = true;

  try {
    const result = await api.changePassword(newPassword.value);

    if (result) {
      toast.success(t("auth.password_changed"));

      newPassword.value = "";
      confirmNewPassword.value = "";

      await nextTick();
      passwordForm.value?.resetValidation();
    } else {
      toast.error(t("auth.password_change_failed"));
    }
  } catch (err: any) {
    toast.error(err.message || t("auth.password_change_failed"));
  } finally {
    changing.value = false;
  }
};
</script>

<style scoped>
.password-settings {
  margin-bottom: 24px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  margin-bottom: 4px;
  font-weight: 500;
}

.section-subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.813rem;
  margin: 0;
  line-height: 1.4;
}
</style>
