import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import ProtocolChip from "@/components/ProtocolChip.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { OutputProtocol } from "@/plugins/api/interfaces";
import { providerManifest } from "../fixtures/providerManifest";

const apiMock = vi.hoisted(() => ({
  getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
}));
const openLinkInNewTab = vi.hoisted(() => vi.fn());

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  api: apiMock,
}));
vi.mock("@/helpers/utils", () => ({ openLinkInNewTab }));

const vuetify = createVuetify({ components, directives });

enableAutoUnmount(afterEach);

function outputProtocol(
  overrides: Partial<OutputProtocol> = {},
): OutputProtocol {
  return {
    output_protocol_id: "native",
    name: "Native",
    is_native: true,
    protocol_domain: "airplay",
    priority: 0,
    available: true,
    derived_from: null,
    ...overrides,
  };
}

function mountChip(props: { protocol: OutputProtocol; linkToDocs?: boolean }) {
  return mount(ProtocolChip, {
    props,
    global: {
      plugins: [vuetify],
      stubs: {
        ProviderIcon: {
          props: ["domain"],
          template:
            '<span data-testid="provider-icon" :data-domain="domain" />',
        },
      },
    },
  });
}

describe("ProtocolChip", () => {
  beforeEach(() => {
    apiMock.getProviderManifest.mockReset();
    openLinkInNewTab.mockReset();
  });

  it("renders the provider name and icon for the protocol", () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ domain: "airplay", name: "AirPlay" }),
    );

    const wrapper = mountChip({ protocol: outputProtocol() });

    expect(wrapper.text()).toContain("AirPlay");
    expect(
      wrapper.get('[data-testid="provider-icon"]').attributes("data-domain"),
    ).toBe("airplay");
  });

  it("falls back to the protocol domain when the provider is unknown", () => {
    apiMock.getProviderManifest.mockReturnValue(undefined);

    const wrapper = mountChip({ protocol: outputProtocol() });

    expect(wrapper.text()).toContain("airplay");
  });

  it("dims the chip when the protocol is unavailable", () => {
    apiMock.getProviderManifest.mockReturnValue(providerManifest());

    const wrapper = mountChip({
      protocol: outputProtocol({ available: false }),
    });

    expect(wrapper.classes()).toContain("protocol-chip--unavailable");
  });

  it("opens the provider documentation on click when linking is enabled", async () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: "https://example.org/airplay" }),
    );

    const wrapper = mountChip({ protocol: outputProtocol(), linkToDocs: true });
    expect(wrapper.classes()).toContain("protocol-chip--clickable");

    await wrapper.trigger("click");

    expect(openLinkInNewTab).toHaveBeenCalledWith(
      "https://example.org/airplay",
    );
  });

  it("stays inert when the call site does not link to the documentation", async () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: "https://example.org/airplay" }),
    );

    const wrapper = mountChip({ protocol: outputProtocol() });
    expect(wrapper.classes()).not.toContain("protocol-chip--clickable");

    await wrapper.trigger("click");

    expect(openLinkInNewTab).not.toHaveBeenCalled();
  });

  it("stays inert when the provider has no documentation", async () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: null }),
    );

    const wrapper = mountChip({ protocol: outputProtocol(), linkToDocs: true });
    expect(wrapper.classes()).not.toContain("protocol-chip--clickable");

    await wrapper.trigger("click");

    expect(openLinkInNewTab).not.toHaveBeenCalled();
  });
});
