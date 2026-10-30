import OidcLoginButton from "@/components/OidcLoginButton.vue";
import { AuthProviderType } from "@/plugins/api/interfaces";
import en from "@/translations/en.json";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";

const mocks = vi.hoisted(() => ({
  startAuthorization: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: { startAuthorization: mocks.startAuthorization },
}));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

enableAutoUnmount(afterEach);
afterEach(() => vi.restoreAllMocks());

function mountButton(disabled = false, name = "Authentik") {
  return mount(OidcLoginButton, {
    props: {
      provider: {
        provider_id: "oidc",
        provider_type: AuthProviderType.OIDC,
        requires_redirect: true,
        name,
      },
      disabled,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: "en", messages: { en } })],
    },
  });
}

describe("OIDC sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startAuthorization.mockResolvedValue({
      authorization_url: "https://music.example/auth/oidc/start",
    });
  });

  it("opens the server's browser-bound entry point using the configured provider", async () => {
    const replace = vi
      .spyOn(window.location, "replace")
      .mockImplementation(() => {});
    const wrapper = mountButton();
    expect(wrapper.text()).toContain("Sign in with Authentik");

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(mocks.startAuthorization).toHaveBeenCalledWith(
      "oidc",
      window.location.href,
      undefined,
      { suppressGlobalError: true },
    );
    expect(replace).toHaveBeenCalledWith(
      "https://music.example/auth/oidc/start",
    );
    expect(wrapper.emitted("busy")).toEqual([[true]]);
    expect(wrapper.emitted("error")).toEqual([[null]]);
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it("keeps other sign-in attempts from starting while the button is disabled", async () => {
    const wrapper = mountButton(true);
    await wrapper.find("button").trigger("click");
    expect(mocks.startAuthorization).not.toHaveBeenCalled();
  });

  it.each([null, "javascript:alert(1)"])(
    "refuses an invalid authorization URL (%s) and restores the sign-in form",
    async (authorizationUrl) => {
      const replace = vi
        .spyOn(window.location, "replace")
        .mockImplementation(() => {});
      mocks.startAuthorization.mockResolvedValue({
        authorization_url: authorizationUrl,
      });
      const wrapper = mountButton();

      await wrapper.find("button").trigger("click");
      await flushPromises();

      expect(replace).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenCalledWith(
        "Unable to start sign-in. Please try again.",
      );
      expect(wrapper.emitted("busy")).toEqual([[true], [false]]);
      expect(wrapper.find("button").attributes("disabled")).toBeUndefined();
    },
  );

  it("shows provider failures without leaving local sign-in disabled", async () => {
    mocks.startAuthorization.mockRejectedValue(
      new Error("Provider unavailable"),
    );
    const wrapper = mountButton();

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("error")?.at(-1)).toEqual(["Provider unavailable"]);
    expect(wrapper.emitted("busy")?.at(-1)).toEqual([false]);
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith("Provider unavailable");
  });

  it("renders the administrator's provider label as text", () => {
    const wrapper = mountButton(false, "<script>alert(1)</script>");
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.text()).toContain("<script>alert(1)</script>");
  });
});
