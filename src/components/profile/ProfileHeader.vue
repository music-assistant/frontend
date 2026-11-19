<template>
  <SettingsPageHeader
    page="profile"
    :title="displayName"
    :description="roleName"
  >
    <template #icon>
      <Avatar class="size-12">
        <AvatarImage
          v-if="store.currentUser?.avatar_url"
          :src="store.currentUser.avatar_url"
          :alt="displayName"
        />
        <AvatarFallback class="bg-primary text-primary-foreground text-lg">
          {{ initial }}
        </AvatarFallback>
      </Avatar>
    </template>
    <!-- Home Assistant signs the user in and owns the account details -->
    <template v-if="!store.isIngressSession" #actions>
      <Button
        variant="outline"
        size="sm"
        data-testid="profile-edit"
        @click="editing = true"
      >
        <Pencil class="size-4" />
        {{ $t("auth.edit_profile") }}
      </Button>
      <Button
        variant="outline"
        size="sm"
        data-testid="profile-sign-out"
        @click="authManager.logout()"
      >
        <LogOut class="size-4" />
        {{ $t("auth.logout") }}
      </Button>
      <EditProfileDialog v-model:open="editing" />
    </template>
  </SettingsPageHeader>
</template>

<script setup lang="ts">
import { LogOut, Pencil } from "@lucide/vue";
import { computed, ref } from "vue";

import EditProfileDialog from "@/components/profile/EditProfileDialog.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { roleDisplayName } from "@/helpers/roles";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

/**
 * The header of the profile, which is who is signed in: the avatar, name and
 * role of the user, with the controls to edit the account and to sign out
 * where the app manages the sign-in itself.
 */

const editing = ref(false);

const displayName = computed(
  () => store.currentUser?.display_name || store.currentUser?.username || "",
);
const initial = computed(() => displayName.value.charAt(0).toUpperCase());
const roleName = computed(() =>
  store.currentUser ? roleDisplayName(store.currentUser.role, store.roles) : "",
);
</script>
