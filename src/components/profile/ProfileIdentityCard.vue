<template>
  <Card
    class="flex-row flex-wrap items-center gap-4 px-6"
    data-testid="profile-identity"
  >
    <Avatar class="size-16 shrink-0">
      <AvatarImage
        v-if="store.currentUser?.avatar_url"
        :src="store.currentUser.avatar_url"
        :alt="displayName"
      />
      <AvatarFallback class="bg-primary text-primary-foreground text-xl">
        {{ initial }}
      </AvatarFallback>
    </Avatar>
    <div class="min-w-0 flex-1">
      <h2 class="truncate text-lg font-semibold">{{ displayName }}</h2>
      <p class="text-muted-foreground truncate text-sm">{{ roleName }}</p>
    </div>
    <!-- Home Assistant signs the user in and owns the account details -->
    <div
      v-if="!store.isIngressSession"
      class="flex gap-2 max-sm:w-full max-sm:justify-end"
    >
      <Button
        variant="outline"
        data-testid="profile-edit"
        @click="editing = true"
      >
        <Pencil class="size-4" />
        {{ $t("auth.edit_profile") }}
      </Button>
      <Button
        variant="outline"
        data-testid="profile-sign-out"
        @click="authManager.logout()"
      >
        <LogOut class="size-4" />
        {{ $t("auth.logout") }}
      </Button>
    </div>
    <EditProfileDialog v-if="!store.isIngressSession" v-model:open="editing" />
  </Card>
</template>

<script setup lang="ts">
import { LogOut, Pencil } from "@lucide/vue";
import { computed, ref } from "vue";

import EditProfileDialog from "@/components/profile/EditProfileDialog.vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { roleDisplayName } from "@/helpers/roles";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

/**
 * Who is signed in: the avatar, name and role of the user, with the controls to
 * edit the account and to sign out where the app manages the sign-in itself.
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
