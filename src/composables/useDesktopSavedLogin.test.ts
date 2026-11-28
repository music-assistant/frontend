import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";
import {
  saveAuthenticatedDesktopLogin,
  useDesktopSavedLogin,
} from "./useDesktopSavedLogin";
import {
  forgetDesktopSavedLogin,
  getDesktopSavedLoginStatus,
  restoreDesktopSavedLogin,
  saveDesktopLogin,
} from "@/plugins/companion";

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/plugins/companion", () => ({
  hasDesktopSavedLogin: vi.fn(() => true),
  getDesktopSavedLoginStatus: vi.fn(),
  restoreDesktopSavedLogin: vi.fn(),
  forgetDesktopSavedLogin: vi.fn(),
  saveDesktopLogin: vi.fn(),
}));

const status = {
  supported: true,
  available: true,
  saved: true,
  context: "context",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const candidate = {
  username: "example",
  password: "test-only",
  context: "context",
  connection: "local:server",
  serverId: "server",
  nonce: "nonce",
};
const translate = (key: string) => key;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe("completed authentication and optional desktop save", () => {
  it("does not wait for status or save and reports success separately", async () => {
    const pendingStatus = deferred<typeof status>();
    const pendingSave = deferred<typeof status>();
    vi.mocked(getDesktopSavedLoginStatus).mockReturnValue(
      pendingStatus.promise,
    );
    vi.mocked(saveDesktopLogin).mockReturnValue(pendingSave.promise);
    const save = saveAuthenticatedDesktopLogin({
      candidate,
      isCurrent: () => true,
      translate,
    });
    expect(saveDesktopLogin).not.toHaveBeenCalled();
    pendingStatus.resolve(status);
    await Promise.resolve();
    expect(saveDesktopLogin).toHaveBeenCalledWith(candidate);
    pendingSave.resolve(status);
    await save;
    expect(toast.success).toHaveBeenCalledWith("login.saved_password_saved");
  });

  it("reports a failed OS save as an error without rejecting", async () => {
    vi.mocked(getDesktopSavedLoginStatus).mockResolvedValue(status);
    vi.mocked(saveDesktopLogin).mockRejectedValue(new Error("OS unavailable"));
    await expect(
      saveAuthenticatedDesktopLogin({
        candidate,
        isCurrent: () => true,
        translate,
      }),
    ).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith(
      "login.saved_password_unavailable",
    );
  });

  it("does not save after logout while status is pending", async () => {
    const pending = deferred<typeof status>();
    vi.mocked(getDesktopSavedLoginStatus).mockReturnValue(pending.promise);
    let authenticated = true;
    const save = saveAuthenticatedDesktopLogin({
      candidate,
      isCurrent: () => authenticated,
      translate,
    });
    authenticated = false;
    pending.resolve(status);
    await save;
    expect(saveDesktopLogin).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not report a stale result after revocation during save", async () => {
    const pending = deferred<typeof status>();
    vi.mocked(getDesktopSavedLoginStatus).mockResolvedValue(status);
    vi.mocked(saveDesktopLogin).mockReturnValue(pending.promise);
    let authenticated = true;
    const save = saveAuthenticatedDesktopLogin({
      candidate,
      isCurrent: () => authenticated,
      translate,
    });
    await Promise.resolve();
    authenticated = false;
    pending.reject(new Error("revoked"));
    await expect(save).resolves.toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

function setupLogin() {
  const username = ref("");
  const password = ref("");
  const step = ref("login");
  const connection = ref<string | null>("local:server");
  const isAuthenticating = ref(false);
  let login!: ReturnType<typeof useDesktopSavedLogin>;
  const wrapper = mount(
    defineComponent({
      setup() {
        login = useDesktopSavedLogin({
          username,
          password,
          step,
          isAuthenticating,
          getConnection: () => connection.value,
          translate,
        });
        return () => null;
      },
    }),
  );
  return {
    username,
    password,
    step,
    connection,
    isAuthenticating,
    login,
    wrapper,
  };
}

describe("desktop saved-login form", () => {
  it("only clears unchanged restored fields when switching connections", async () => {
    vi.mocked(getDesktopSavedLoginStatus).mockResolvedValue(status);
    vi.mocked(restoreDesktopSavedLogin).mockResolvedValue({
      username: "saved",
      password: "restored",
      context: "context",
    });
    const form = setupLogin();
    await nextTick();
    await nextTick();
    await Promise.resolve();
    expect(form.username.value).toBe("saved");
    form.password.value = "edited";
    form.connection.value = "local:other";
    await nextTick();
    expect(form.username.value).toBe("");
    expect(form.password.value).toBe("edited");
    form.wrapper.unmount();
  });

  it("excludes login while forget is pending, then clears only the unchanged password", async () => {
    vi.mocked(getDesktopSavedLoginStatus).mockResolvedValue(status);
    vi.mocked(restoreDesktopSavedLogin).mockResolvedValue({
      username: "saved",
      password: "restored",
      context: "context",
    });
    const pending = deferred<typeof status>();
    vi.mocked(forgetDesktopSavedLogin).mockReturnValue(pending.promise);
    const form = setupLogin();
    await nextTick();
    await nextTick();
    await Promise.resolve();
    const forgetting = form.login.forgetSavedPassword();
    expect(form.login.forgetPending.value).toBe(true);
    form.password.value = "new password";
    pending.resolve({ ...status, saved: false });
    await forgetting;
    expect(form.login.forgetPending.value).toBe(false);
    expect(form.password.value).toBe("new password");
    expect(form.login.rememberPassword.value).toBe(false);
    form.wrapper.unmount();
  });
});
