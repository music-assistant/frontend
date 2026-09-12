import { api } from "@/plugins/api";
import type { User } from "@/plugins/api/interfaces";
import { authManager, type SavedAccount } from "@/plugins/auth";
import { toast } from "vue-sonner";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

export interface AccountOption {
  user?: User;
  account?: SavedAccount;
}

const savedAccounts = computed(() => authManager.getSavedAccounts());
const serverUsers = ref<User[]>([]);
const switchAccountsOpen = ref(false);
const loginUser = ref<User | null>(null);
const loginPassword = ref("");
const loginLoading = ref(false);
const loginError = ref("");
const loginDialogOpen = ref(false);

const availableAccounts = computed<AccountOption[]>(() => {
  if (!serverUsers.value.length) {
    return savedAccounts.value.map((account) => ({
      user: undefined,
      account,
    }));
  }

  return serverUsers.value.map((user) => ({
    user,
    account: savedAccounts.value.find(
      (account) => account.username === user.username,
    ),
  }));
});

const loadAccounts = async () => {
  if (!authManager.isAdmin()) {
    serverUsers.value = [];
    return;
  }
  try {
    serverUsers.value = await api.getAllUsers();
  } catch {
    // Non-admin users cannot list all accounts; remembered sessions still work.
  }
};

const accountName = (account: SavedAccount | User) =>
  ("display_name" in account ? account.display_name : account.displayName) ||
  account.username;

const accountInitial = (account: SavedAccount | User) =>
  accountName(account).charAt(0).toUpperCase() || "U";

export function useAccountSwitcher() {
  const { t } = useI18n();

  const openAccountSwitcher = () => {
    switchAccountsOpen.value = true;
    void loadAccounts();
  };

  const addAccount = () => {
    authManager.logout();
  };

  const switchAccount = (account: SavedAccount | undefined) => {
    if (!account) return;
    switchAccountsOpen.value = false;
    authManager.switchAccount(account);
  };

  const selectAccount = (item: AccountOption) => {
    if (item.account) {
      switchAccount(item.account);
      return;
    }
    if (!item.user) return;
    loginUser.value = item.user;
    loginPassword.value = "";
    loginError.value = "";
    loginDialogOpen.value = true;
  };

  const signInToAccount = async () => {
    if (!loginUser.value || !loginPassword.value || loginLoading.value) return;
    loginLoading.value = true;
    loginError.value = "";
    try {
      const result = await api.loginWithCredentials(
        loginUser.value.username,
        loginPassword.value,
      );
      authManager.setToken(result.token);
      authManager.setCurrentUser(result.user);
      loginDialogOpen.value = false;
      switchAccountsOpen.value = false;
      window.location.reload();
    } catch (error: unknown) {
      loginError.value =
        error instanceof Error ? error.message : t("auth.login_failed");
    } finally {
      loginLoading.value = false;
    }
  };

  return {
    accountInitial,
    accountName,
    addAccount,
    availableAccounts,
    loadAccounts,
    loginDialogOpen,
    loginError,
    loginLoading,
    loginPassword,
    loginUser,
    savedAccounts,
    selectAccount,
    signInToAccount,
    switchAccountsOpen,
    openAccountSwitcher,
  };
}
