<template>
  <div>
    <Toolbar :show-loading="true" :home="true" color="background">
      <template #append>
        <!-- User avatar menu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <div class="avatar-trigger">
              <Avatar class="user-avatar size-10">
                <AvatarImage
                  v-if="store.currentUser?.avatar_url"
                  :src="store.currentUser.avatar_url"
                />
                <AvatarFallback class="bg-primary">
                  <User :size="20" class="text-white" />
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div class="user-header-section">
              <Avatar class="user-avatar size-10">
                <AvatarImage
                  v-if="store.currentUser?.avatar_url"
                  :src="store.currentUser.avatar_url"
                />
                <AvatarFallback class="bg-primary">
                  <User :size="20" class="text-white" />
                </AvatarFallback>
              </Avatar>
              <div class="flex flex-col">
                <span class="text-sm font-semibold">
                  {{
                    store.currentUser?.display_name ||
                    store.currentUser?.username
                  }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ store.currentUser?.username }}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="router.push({ name: 'profile' })">
              <Settings :size="16" />
              <span>{{ $t("auth.profile") }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem @click="editMode = !editMode">
              <Pencil :size="16" />
              <span>
                {{
                  $t(
                    editMode
                      ? "homescreen_edit_disable"
                      : "homescreen_edit_enable",
                  )
                }}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="!store.isIngressSession"
              @click="handleLogout"
            >
              <LogOut :size="16" />
              <span>{{ $t("auth.logout") }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { LogOut, Pencil, Settings, User } from "lucide-vue-next";
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

.avatar-trigger {
  cursor: pointer;
  margin-right: 8px;
}

.avatar-trigger:hover {
  opacity: 0.9;
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

  .user-header-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px;
    background-color: hsl(var(--muted) / 0.3);
    border-radius: calc(var(--radius) - 2px);
    margin-bottom: 4px;
  }
}
</style>
