<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-h6 pa-6 pb-4">
        {{ $t("auth.create_user") }}
      </v-card-title>
      <v-card-text class="px-6 pb-2">
        <v-text-field
          v-model="localUser.username"
          :label="$t('auth.username')"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :rules="[rules.required, rules.usernameLength]"
          autofocus
        />
        <v-text-field
          v-model="localUser.displayName"
          :label="$t('auth.display_name')"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :hint="$t('optional')"
          persistent-hint
        />
        <v-text-field
          v-model="localUser.password"
          :label="$t('auth.password')"
          type="password"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :rules="[rules.required, rules.passwordLength]"
        />
        <v-text-field
          v-model="localUser.confirmPassword"
          :label="$t('auth.confirm_password')"
          type="password"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :rules="[rules.required, rules.passwordMatch]"
        />
        <v-select
          v-model="localUser.role"
          :label="$t('auth.role')"
          :items="roleOptions"
          variant="outlined"
          density="comfortable"
          class="mb-2"
        />

        <!-- Player Filter -->
        <v-select
          v-model="localUser.playerFilter"
          :label="$t('auth.player_filter')"
          :items="playerOptions"
          variant="outlined"
          density="comfortable"
          multiple
          chips
          closable-chips
          class="mb-2"
          :hint="$t('auth.player_filter_hint')"
          persistent-hint
        >
          <template #selection="{ item, index }">
            <v-chip
              v-if="index < 2"
              size="small"
              closable
              @click:close="removePlayer(item.value)"
            >
              {{ item.title }}
            </v-chip>
            <span
              v-if="index === 2"
              class="text-grey text-caption align-self-center"
            >
              (+{{ localUser.playerFilter.length - 2 }} {{ $t("actions") }})
            </span>
          </template>
        </v-select>

        <!-- Provider Filter -->
        <v-select
          v-model="localUser.providerFilter"
          :label="$t('auth.provider_filter')"
          :items="providerOptions"
          variant="outlined"
          density="comfortable"
          multiple
          chips
          closable-chips
          class="mb-2"
          :hint="$t('auth.provider_filter_hint')"
          persistent-hint
        >
          <template #selection="{ item, index }">
            <v-chip
              v-if="index < 2"
              size="small"
              closable
              @click:close="removeProvider(item.value)"
            >
              {{ item.title }}
            </v-chip>
            <span
              v-if="index === 2"
              class="text-grey text-caption align-self-center"
            >
              (+{{ localUser.providerFilter.length - 2 }} {{ $t("actions") }})
            </span>
          </template>
        </v-select>
      </v-card-text>
      <v-card-actions class="pa-6 pt-4">
        <v-spacer />
        <v-btn variant="text" @click="handleClose">
          {{ $t("cancel") }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!canCreate"
          @click="handleCreate"
        >
          {{ $t("create") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { UserRole, ProviderType } from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [];
}>();

const loading = ref(false);

const localUser = ref({
  username: "",
  displayName: "",
  password: "",
  confirmPassword: "",
  role: "user" as UserRole,
  playerFilter: [] as string[],
  providerFilter: [] as string[],
});

const roleOptions = [
  { title: t("auth.admin_role"), value: "admin" },
  { title: t("auth.user_role"), value: "user" },
];

const playerOptions = computed(() => {
  return Object.values(api.players)
    .map((player) => ({
      title: player.name,
      value: player.player_id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
});

const providerOptions = computed(() => {
  return Object.values(api.providers)
    .filter((provider) => provider.type === ProviderType.MUSIC)
    .map((provider) => ({
      title: provider.name,
      value: provider.instance_id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
});

const removePlayer = (playerId: string) => {
  localUser.value.playerFilter = localUser.value.playerFilter.filter(
    (id) => id !== playerId,
  );
};

const removeProvider = (instanceId: string) => {
  localUser.value.providerFilter = localUser.value.providerFilter.filter(
    (id) => id !== instanceId,
  );
};

const rules = {
  required: (v: string) => !!v || t("auth.field_required"),
  usernameLength: (v: string) => v.length >= 3 || t("auth.username_min_length"),
  passwordLength: (v: string) => v.length >= 8 || t("auth.password_min_length"),
  passwordMatch: (v: string) =>
    v === localUser.value.password || t("auth.passwords_must_match"),
};

const canCreate = computed(() => {
  return (
    localUser.value.username.length >= 3 &&
    localUser.value.password.length >= 8 &&
    localUser.value.password === localUser.value.confirmPassword &&
    localUser.value.role
  );
});

const resetForm = () => {
  localUser.value = {
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
    role: UserRole.USER,
    playerFilter: [],
    providerFilter: [],
  };
};

const handleClose = () => {
  resetForm();
  emit("update:modelValue", false);
};

const handleCreate = async () => {
  loading.value = true;

  try {
    const user = await api.createUser(
      localUser.value.username,
      localUser.value.password,
      localUser.value.role,
      localUser.value.displayName || undefined,
      localUser.value.playerFilter.length > 0
        ? localUser.value.playerFilter
        : undefined,
      localUser.value.providerFilter.length > 0
        ? localUser.value.providerFilter
        : undefined,
    );

    if (user) {
      toast.success(t("auth.user_created"));
      resetForm();
      emit("created");
      emit("update:modelValue", false);
    } else {
      toast.error(t("auth.user_create_failed"));
    }
  } catch (error) {
    toast.error(t("auth.user_create_failed"));
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (!newVal) {
      resetForm();
    }
  },
);
</script>
