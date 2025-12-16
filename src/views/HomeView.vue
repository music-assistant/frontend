<template>
  <div>
    <Toolbar :show-loading="true" :home="true" color="background">
      <template #append>
        <!-- User avatar menu -->
        <v-menu location="bottom end" scrim>
          <template #activator="{ props }">
            <v-btn
              variant="plain"
              style="width: 40px; height: 40px; margin-right: 8px"
              v-bind="props"
            >
              <v-avatar
                size="40"
                :color="store.currentUser?.avatar_url ? undefined : 'primary'"
                class="user-avatar"
              >
                <v-img
                  v-if="store.currentUser?.avatar_url"
                  :src="store.currentUser.avatar_url"
                />
                <v-icon v-else icon="mdi-account" size="20" color="white" />
              </v-avatar>
            </v-btn>
          </template>
          <v-list density="compact" slim tile>
            <v-list-item
              :title="
                store.currentUser?.display_name || store.currentUser?.username
              "
              :subtitle="store.currentUser?.username"
              disabled
              class="user-header-item"
            >
              <template #prepend>
                <v-avatar
                  size="40"
                  :color="store.currentUser?.avatar_url ? undefined : 'primary'"
                  class="user-avatar"
                >
                  <v-img
                    v-if="store.currentUser?.avatar_url"
                    :src="store.currentUser.avatar_url"
                  />
                  <v-icon v-else icon="mdi-account" size="20" color="white" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item
              :title="$t('auth.profile')"
              @click="router.push({ name: 'profile' })"
            >
              <template #prepend>
                <v-icon icon="mdi-account-cog" />
              </template>
            </v-list-item>
            <v-list-item
              :title="
                $t(
                  editMode
                    ? 'homescreen_edit_disable'
                    : 'homescreen_edit_enable',
                )
              "
              @click="editMode = !editMode"
            >
              <template #prepend>
                <v-icon icon="mdi-pencil" />
              </template>
            </v-list-item>
            <v-list-item
              v-if="!store.isIngressSession"
              :title="$t('auth.logout')"
              @click="handleLogout"
            >
              <template #prepend>
                <v-icon icon="mdi-logout" />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </Toolbar>

    <!-- Provider error warning banner -->
    <v-alert
      v-if="hasProviderErrors && showProviderWarning"
      variant="outlined"
      type="error"
      icon="mdi-alert-circle"
      prominent
      class="mx-5 mt-4"
      closable
      @click:close="showProviderWarning = false"
    >
      <div class="provider-warning-content">
        <span>{{ $t("settings.provider_requires_attention_detail") }}</span>
        <v-btn
          size="small"
          color="error"
          variant="flat"
          @click="navigateToProviders"
        >
          {{ $t("settings.fix_now") }}
        </v-btn>
      </div>
    </v-alert>

    <Container variant="comfortable">
      <Suspense>
        <div>
          <HomeWidgetRows :edit-mode="editMode" />
        </div>
        <template #fallback><v-progress-circular indeterminate /> </template>
      </Suspense>
    </Container>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import HomeWidgetRows from "@/components/HomeWidgetRows.vue";
import Toolbar from "@/components/Toolbar.vue";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);
const hasProviderErrors = ref(false);
const showProviderWarning = ref(true);

const handleLogout = () => {
  authManager.logout();
};

const navigateToProviders = () => {
  router.push("/settings/providers");
};

onMounted(async () => {
  if (authManager.isAdmin()) {
    try {
      const configs = await api.getProviderConfigs();
      hasProviderErrors.value = configs.some(
        (config) => config.enabled && config.last_error,
      );
    } catch {
      // Ignore errors - this is a best-effort feature
    }
  }
});
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}

.editButton {
  float: right;
  margin-bottom: 10px;
}

.user-header-item :deep(.v-list-item__prepend) {
  margin-inline-end: 8px;
  margin-left: -8px;
}

.user-avatar {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.provider-warning-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

@media (max-width: 600px) {
  .provider-warning-content {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
