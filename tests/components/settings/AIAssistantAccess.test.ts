import AIAssistantAccess from "@/components/settings/ai/AIAssistantAccess.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../fixtures/providerConfig";

const { apiMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

enableAutoUnmount(afterEach);

const SWITCH = '[data-testid="ai-assistant-access-switch"]';

function mcpConfig(enabled: boolean) {
  return providerConfig({
    domain: "mcp_server",
    instance_id: "mcp_server",
    type: ProviderType.PLUGIN,
    enabled,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getProviderConfigs.mockResolvedValue([mcpConfig(false)]);
  apiMock.saveProviderConfig.mockImplementation(async (_domain, values) =>
    mcpConfig(Boolean(values.enabled)),
  );
});

async function mountAccess() {
  const wrapper = mount(AIAssistantAccess);
  await flushPromises();
  return wrapper;
}

describe("AIAssistantAccess", () => {
  it("shows whether the built-in MCP server is on", async () => {
    const wrapper = await mountAccess();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(
      undefined,
      "mcp_server",
    );
    expect(wrapper.get(SWITCH).attributes("data-state")).toBe("unchecked");
  });

  it("turns the MCP server on, and says so", async () => {
    const wrapper = await mountAccess();

    await wrapper.get(SWITCH).trigger("click");
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "mcp_server",
      { enabled: true },
      "mcp_server",
    );
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.ai.assistant_access_enabled",
    );
    expect(wrapper.get(SWITCH).attributes("data-state")).toBe("checked");
  });

  it("turns the MCP server off, and says so", async () => {
    apiMock.getProviderConfigs.mockResolvedValue([mcpConfig(true)]);
    const wrapper = await mountAccess();

    await wrapper.get(SWITCH).trigger("click");
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "mcp_server",
      { enabled: false },
      "mcp_server",
    );
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.ai.assistant_access_disabled",
    );
  });

  it("keeps what the server has when the change fails", async () => {
    apiMock.saveProviderConfig.mockRejectedValueOnce(new Error("refused"));
    const wrapper = await mountAccess();

    await wrapper.get(SWITCH).trigger("click");
    await flushPromises();

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(wrapper.get(SWITCH).attributes("data-state")).toBe("unchecked");
    expect(wrapper.get(SWITCH).attributes("disabled")).toBeUndefined();
  });

  it("renders nothing for a user who may not change providers", async () => {
    hasScope.mockImplementation(
      (scope) => scope !== Scope.CONFIG_PROVIDERS_WRITE,
    );

    const wrapper = await mountAccess();

    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
    expect(wrapper.find(SWITCH).exists()).toBe(false);
  });
});
