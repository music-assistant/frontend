<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import PanelDragHandle from "@/components/PanelDragHandle.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar";
import { useAccountSwitcher } from "@/composables/useAccountSwitcher";
import { authManager } from "@/plugins/auth";
import {
  accountAccentClass as getAccountAccentClass,
  accountSwitcherAccentClass as getAccountSwitcherAccentClass,
} from "./accountMenu";

const {
  accountInitial,
  accountName,
  addAccount,
  availableAccounts,
  loginDialogOpen,
  loginError,
  loginLoading,
  loginPassword,
  loginUser,
  savedAccounts,
  selectAccount,
  signInToAccount,
  switchAccountsOpen,
} = useAccountSwitcher();
const { isMobile } = useSidebar();

const accountAccentClass = (account: { username: string }) =>
  getAccountAccentClass(account.username);
const accountSwitcherAccentClass = (account: { username: string }) =>
  getAccountSwitcherAccentClass(account.username);
</script>

<template>
  <component :is="isMobile ? Sheet : Dialog" v-model:open="switchAccountsOpen">
    <component
      :is="isMobile ? SheetContent : DialogContent"
      :class="
        isMobile
          ? 'account-switcher-mobile-panel h-dvh max-h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 p-0'
          : 'max-w-md'
      "
      :data-player-panel="isMobile ? '' : undefined"
      v-bind="isMobile ? { side: 'bottom', showClose: false } : {}"
    >
      <PanelDragHandle
        v-if="isMobile"
        swipe-anywhere
        @dismiss="switchAccountsOpen = false"
      />
      <component
        :is="isMobile ? SheetHeader : DialogHeader"
        :class="isMobile ? 'px-4 pb-3 pt-0' : undefined"
      >
        <component :is="isMobile ? SheetTitle : DialogTitle">
          {{ $t("auth.switch_account") }}
        </component>
        <component :is="isMobile ? SheetDescription : DialogDescription">
          {{ $t("auth.switch_account_description") }}
        </component>
      </component>
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        <button
          v-for="item in availableAccounts"
          :key="item.account?.token || item.user?.user_id"
          type="button"
          class="flex items-center gap-3 rounded-lg border border-l-4 p-3 text-left transition-colors hover:bg-accent"
          :class="accountSwitcherAccentClass(item.user || item.account!)"
          @click="selectAccount(item)"
        >
          <Avatar
            class="size-10 border"
            :class="accountAccentClass(item.user || item.account!)"
          >
            <AvatarImage
              v-if="item.user?.avatar_url || item.account?.avatarUrl"
              :src="item.user?.avatar_url || item.account?.avatarUrl || ''"
              :alt="accountName(item.user || item.account!)"
            />
            <AvatarFallback
              class="text-primary-foreground"
              :class="accountAccentClass(item.user || item.account!)"
              >{{ accountInitial(item.user || item.account!) }}</AvatarFallback
            >
          </Avatar>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{
              accountName(item.user || item.account!)
            }}</span>
            <span class="block truncate text-xs text-muted-foreground">
              @{{ item.user?.username || item.account?.username }}
            </span>
          </span>
          <span v-if="!item.account" class="text-xs text-muted-foreground">
            {{ $t("auth.login") }}
          </span>
          <span
            v-if="item.account?.token === authManager.getToken()"
            class="text-xs text-muted-foreground"
          >
            {{ $t("auth.current") }}
          </span>
        </button>
        <p
          v-if="savedAccounts.length < 2"
          class="rounded-lg bg-muted p-3 text-sm text-muted-foreground"
        >
          {{ $t("auth.add_account_hint") }}
        </p>
        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          @click="addAccount"
        >
          {{ $t("auth.add_account") }}
        </button>
      </div>
    </component>
  </component>

  <Dialog v-model:open="loginDialogOpen">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t("auth.login") }}</DialogTitle>
        <DialogDescription>{{ loginUser?.username }}</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4" @submit.prevent="signInToAccount">
        <div class="grid gap-2">
          <label for="switch-account-password" class="text-sm font-medium">
            {{ $t("auth.password") }}
          </label>
          <Input
            id="switch-account-password"
            v-model="loginPassword"
            type="password"
            autocomplete="current-password"
            autofocus
          />
          <p v-if="loginError" class="text-sm text-destructive">
            {{ loginError }}
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="loginDialogOpen = false"
          >
            {{ $t("cancel") }}
          </Button>
          <Button type="submit" :loading="loginLoading">
            {{ $t("auth.login") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.account-switcher-mobile-panel {
  box-sizing: border-box;
  padding: var(--device-inset-top) var(--device-inset-right)
    var(--device-inset-bottom) var(--device-inset-left);
}
</style>
