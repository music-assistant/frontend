import SecuritySettings from "@/views/profile/SecuritySettings.vue";
import { type AuthToken } from "@/plugins/api/interfaces";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getUserTokens: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

enableAutoUnmount(afterEach);

function token(overrides: Partial<AuthToken>): AuthToken {
  return {
    token_id: "token",
    name: "token",
    created_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    last_used_at: null,
    is_long_lived: false,
    ...overrides,
  };
}

describe("SecuritySettings", () => {
  it("shows the password, the sessions and the long-lived tokens of the account", async () => {
    apiMock.getUserTokens.mockResolvedValue([
      token({ token_id: "session", is_long_lived: false }),
      token({ token_id: "api", is_long_lived: true }),
    ]);
    const wrapper = shallowMount(SecuritySettings, {
      global: { mocks: { $t: (key: string) => key } },
    });
    await flushPromises();

    expect(
      wrapper
        .findAll("*")
        .map((child) => child.element.tagName.toLowerCase())
        .filter((tag) => tag.endsWith("-stub") && !tag.startsWith("dialog")),
    ).toEqual([
      "settings-page-header-stub",
      "password-settings-stub",
      "session-tokens-list-stub",
      "long-lived-tokens-list-stub",
    ]);
    const tokenIds = (name: string) =>
      (wrapper.getComponent({ name }).props("tokens") as AuthToken[]).map(
        ({ token_id }) => token_id,
      );
    expect(tokenIds("SessionTokensList")).toEqual(["session"]);
    expect(tokenIds("LongLivedTokensList")).toEqual(["api"]);
  });
});
