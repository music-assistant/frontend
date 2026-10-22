import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Scope } from "@/plugins/api/interfaces";

const mocks = vi.hoisted(() => ({
  hasScope: vi.fn(),
  getProviderConfigs: vi.fn(),
  getPlayerConfigs: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: mocks.hasScope },
}));
vi.mock("@/plugins/store", () => ({ store: {} }));
vi.mock("@/plugins/api", () => ({
  default: {
    getProviderConfigs: mocks.getProviderConfigs,
    getPlayerConfigs: mocks.getPlayerConfigs,
    subscribe_multi: () => mocks.unsubscribe,
  },
}));

import { useScrobblingStatus } from "@/composables/useScrobblingStatus";

const ScrobblingStatusHarness = defineComponent({
  setup: () => useScrobblingStatus(),
  template: "<div />",
});

describe("scrobbling refresh permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProviderConfigs.mockResolvedValue([]);
    mocks.getPlayerConfigs.mockResolvedValue([]);
  });

  it.each([Scope.CONFIG_PROVIDERS_READ, Scope.CONFIG_PLAYERS_READ])(
    "does not request configuration when %s is denied",
    async (deniedScope) => {
      mocks.hasScope.mockImplementation((scope) => scope !== deniedScope);
      const wrapper = mount(ScrobblingStatusHarness);
      await wrapper.vm.refresh();
      expect(mocks.getProviderConfigs).not.toHaveBeenCalled();
      expect(mocks.getPlayerConfigs).not.toHaveBeenCalled();
      expect(wrapper.vm.status.configured).toBe(false);
      wrapper.unmount();
      expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    },
  );

  it("refreshes both configurations when the scopes are granted", async () => {
    mocks.hasScope.mockReturnValue(true);
    const wrapper = mount(ScrobblingStatusHarness);
    expect(mocks.getProviderConfigs).toHaveBeenCalledOnce();
    expect(mocks.getPlayerConfigs).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});
