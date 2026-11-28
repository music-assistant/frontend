import {
  forgetDesktopSavedLogin,
  getDesktopSavedLoginStatus,
  hasDesktopSavedLogin,
  restoreDesktopSavedLogin,
  saveDesktopLogin,
  type SavedLoginCredentials,
} from "@/plugins/companion";
import { toast } from "vue-sonner";
import { computed, onUnmounted, ref, watch, type Ref } from "vue";

interface LoginFields {
  username: Ref<string>;
  password: Ref<string>;
  isAuthenticating: Ref<boolean>;
  step: Ref<string>;
  getConnection: () => string | null;
  translate: (key: string) => string;
}

interface SavedLoginCandidate extends SavedLoginCredentials {
  connection: string;
  serverId: string;
  nonce: string;
}

interface SaveOptions {
  candidate: SavedLoginCandidate;
  isCurrent: () => boolean;
  translate: (key: string) => string;
}

/** Optional OS storage must never hold up or roll back a completed sign-in. */
export async function saveAuthenticatedDesktopLogin({
  candidate,
  isCurrent,
  translate,
}: SaveOptions): Promise<void> {
  if (!isCurrent()) return;
  try {
    const status = await getDesktopSavedLoginStatus();
    if (!isCurrent()) return;
    if (
      !status?.supported ||
      !status.available ||
      status.context !== candidate.context
    ) {
      toast.error(translate("login.saved_password_unavailable"));
      return;
    }
    const saved = await saveDesktopLogin(candidate);
    if (!isCurrent()) return;
    if (saved?.saved) toast.success(translate("login.saved_password_saved"));
    else toast.error(translate("login.saved_password_unavailable"));
  } catch {
    if (isCurrent()) toast.error(translate("login.saved_password_unavailable"));
  }
}

export function useDesktopSavedLogin({
  username,
  password,
  isAuthenticating,
  step,
  getConnection,
  translate,
}: LoginFields) {
  const forgetPending = ref(false);
  const rememberPassword = ref(false);
  const rememberPasswordTouched = ref(false);
  const savedPasswordExists = ref(false);
  const savedLoginContext = ref<string | null>(null);
  const savedLoginReady = ref(0);
  const savedLoginConnection = computed(getConnection);
  let generation = 0;
  let mounted = true;
  let restoredLogin: {
    connection: string;
    username: string | null;
    password: string | null;
  } | null = null;

  const onSavedLoginReady = () => {
    savedLoginReady.value++;
  };
  if (typeof window !== "undefined" && window === window.top)
    window.addEventListener("companion-saved-login-ready", onSavedLoginReady);

  watch(
    [() => step.value === "login", savedLoginConnection, savedLoginReady],
    async ([onLogin, connection], _previous, onCleanup) => {
      const currentGeneration = ++generation;
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      if (restoredLogin && restoredLogin.connection !== connection) {
        if (username.value === restoredLogin.username) username.value = "";
        if (password.value === restoredLogin.password) password.value = "";
        restoredLogin = null;
      }
      savedLoginContext.value = null;
      savedPasswordExists.value = false;
      rememberPassword.value = false;
      rememberPasswordTouched.value = false;
      if (!onLogin || !connection || !hasDesktopSavedLogin()) return;
      const stillCurrent = () =>
        mounted &&
        !cancelled &&
        currentGeneration === generation &&
        step.value === "login" &&
        savedLoginConnection.value === connection;
      try {
        const status = await getDesktopSavedLoginStatus();
        if (
          !stillCurrent() ||
          !status?.supported ||
          !status.available ||
          !status.context
        )
          return;
        savedLoginContext.value = status.context;
        savedPasswordExists.value = status.saved;
        if (!status.saved) return;
        const restored = await restoreDesktopSavedLogin(status.context);
        if (!stillCurrent() || !restored || restored.context !== status.context)
          return;
        if (username.value && username.value !== restored.username) return;
        const restoredUsername = !username.value;
        const restoredPassword = !password.value;
        if (restoredUsername) username.value = restored.username;
        if (restoredPassword) password.value = restored.password;
        if (restoredUsername || restoredPassword)
          restoredLogin = {
            connection,
            username: restoredUsername ? restored.username : null,
            password: restoredPassword ? restored.password : null,
          };
        if (!rememberPasswordTouched.value) rememberPassword.value = true;
      } catch {
        if (stillCurrent())
          toast.error(translate("login.saved_password_unavailable"));
      }
    },
    { immediate: true },
  );

  const forgetSavedPassword = async () => {
    if (isAuthenticating.value || forgetPending.value) return;
    const context = savedLoginContext.value;
    const connection = savedLoginConnection.value;
    if (!context || !connection || !hasDesktopSavedLogin()) return;
    const currentGeneration = ++generation;
    const passwordAtForget = password.value;
    forgetPending.value = true;
    try {
      const status = await forgetDesktopSavedLogin(context);
      if (
        !mounted ||
        currentGeneration !== generation ||
        step.value !== "login" ||
        savedLoginConnection.value !== connection ||
        savedLoginContext.value !== context
      )
        return;
      if (!status?.available || status.saved)
        throw new Error("Unable to remove saved password");
      if (password.value === passwordAtForget) password.value = "";
      restoredLogin = null;
      rememberPassword.value = false;
      rememberPasswordTouched.value = true;
      savedPasswordExists.value = false;
      toast.success(translate("login.saved_password_removed"));
    } catch {
      if (
        mounted &&
        currentGeneration === generation &&
        step.value === "login" &&
        savedLoginConnection.value === connection
      )
        toast.error(translate("login.saved_password_unavailable"));
    } finally {
      if (mounted) forgetPending.value = false;
    }
  };

  onUnmounted(() => {
    mounted = false;
    ++generation;
    if (typeof window !== "undefined")
      window.removeEventListener(
        "companion-saved-login-ready",
        onSavedLoginReady,
      );
  });

  return {
    forgetPending,
    rememberPassword,
    rememberPasswordTouched,
    savedPasswordExists,
    savedLoginContext,
    savedLoginConnection,
    forgetSavedPassword,
  };
}
