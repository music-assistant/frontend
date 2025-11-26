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
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);

const handleLogout = () => {
  authManager.logout();
};
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
</style>
