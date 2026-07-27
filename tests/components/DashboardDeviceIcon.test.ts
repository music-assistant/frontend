import DashboardDeviceIcon from "@/components/DashboardDeviceIcon.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    sendCommand: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

describe("DashboardDeviceIcon", () => {
  beforeEach(() => {
    apiMock.sendCommand.mockReset();
  });

  it("resolves and renders the icon when a provider domain hint is set", async () => {
    apiMock.sendCommand.mockResolvedValue("data:image/png;base64,abc123");

    const wrapper = mount(DashboardDeviceIcon, {
      props: { providerDomainHint: "chromecast" },
    });
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("providers/icon", {
      provider: "chromecast",
    });
    const img = wrapper.get('[data-testid="cast-dashboard-device-icon"]');
    expect(img.element.tagName).toBe("IMG");
    expect(img.attributes("src")).toBe("data:image/png;base64,abc123");
  });

  it("renders the fallback icon without calling the API when there is no hint", async () => {
    const wrapper = mount(DashboardDeviceIcon, {
      props: { providerDomainHint: null },
    });
    await flushAsync();

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
    const icon = wrapper.get('[data-testid="cast-dashboard-device-icon"]');
    expect(icon.element.tagName).not.toBe("IMG");
  });

  it("renders the fallback icon when the API resolves to null", async () => {
    apiMock.sendCommand.mockResolvedValue(null);

    const wrapper = mount(DashboardDeviceIcon, {
      props: { providerDomainHint: "unknown-domain" },
    });
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("providers/icon", {
      provider: "unknown-domain",
    });
    const icon = wrapper.get('[data-testid="cast-dashboard-device-icon"]');
    expect(icon.element.tagName).not.toBe("IMG");
  });
});

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}
