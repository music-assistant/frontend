import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtocolChip from "@/components/ProtocolChip.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { OutputProtocol } from "@/plugins/api/interfaces";
import { outputProtocol } from "../fixtures/outputProtocol";
import { providerManifest } from "../fixtures/providerManifest";

const apiMock = vi.hoisted(() => ({
  getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
}));
const getExternalLinkUrl = vi.hoisted(() => vi.fn());

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  api: apiMock,
}));
vi.mock("@/helpers/utils", () => ({ getExternalLinkUrl }));

enableAutoUnmount(afterEach);

function mountChip(props: { protocol: OutputProtocol; linkToDocs?: boolean }) {
  return mount(ProtocolChip, {
    props,
    global: {
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
    // the helper rewrites docs urls for beta servers, so pass them through
    getExternalLinkUrl.mockReset().mockImplementation((url?: string) => url);
  });

  it("renders the provider name and icon for the protocol", () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ domain: "airplay", name: "AirPlay provider" }),
    );

    const wrapper = mountChip({ protocol: outputProtocol() });

    // the fixture's own name differs, so this pins the manifest as the source
    expect(wrapper.text()).toContain("AirPlay provider");
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

    expect(wrapper.classes()).toContain("opacity-40");
  });

  it("fills with a background vuetify's theme stylesheet does not claim", () => {
    apiMock.getProviderManifest.mockReturnValue(providerManifest());

    const wrapper = mountChip({ protocol: outputProtocol() });

    // vuetify defines its own .bg-secondary at runtime and wins the !important
    // tie, so shipping the variant's fill would turn the chip teal
    expect(wrapper.classes()).toContain("bg-muted");
    expect(wrapper.classes()).not.toContain("bg-secondary");
  });

  it("links to the provider documentation when linking is enabled", () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: "https://example.org/airplay" }),
    );

    const wrapper = mountChip({ protocol: outputProtocol(), linkToDocs: true });

    // a real anchor, so the chip is announced as a link and honours
    // middle-click / cmd-click / "open in new tab"
    expect(wrapper.element.tagName).toBe("A");
    expect(wrapper.attributes("href")).toBe("https://example.org/airplay");
    expect(wrapper.attributes("target")).toBe("_blank");
    expect(wrapper.attributes("rel")).toBe("noopener noreferrer");
    expect(wrapper.find(".lucide-external-link").exists()).toBe(true);
  });

  it("routes the documentation url through the external link helper", () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: "https://music-assistant.io/docs" }),
    );
    getExternalLinkUrl.mockReturnValue("https://beta.music-assistant.io/docs");

    const wrapper = mountChip({ protocol: outputProtocol(), linkToDocs: true });

    expect(getExternalLinkUrl).toHaveBeenCalledWith(
      "https://music-assistant.io/docs",
    );
    expect(wrapper.attributes("href")).toBe(
      "https://beta.music-assistant.io/docs",
    );
  });

  it("stays inert when the call site does not link to the documentation", () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: "https://example.org/airplay" }),
    );

    const wrapper = mountChip({ protocol: outputProtocol() });

    // a plain span, so the two list call sites keep a non-focusable label
    expect(wrapper.element.tagName).toBe("SPAN");
    expect(wrapper.attributes("href")).toBeUndefined();
    expect(wrapper.attributes("tabindex")).toBeUndefined();
    expect(wrapper.find(".lucide-external-link").exists()).toBe(false);
    expect(getExternalLinkUrl).not.toHaveBeenCalled();
  });

  it("stays inert when the provider has no documentation", () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: null }),
    );

    const wrapper = mountChip({ protocol: outputProtocol(), linkToDocs: true });

    expect(wrapper.element.tagName).toBe("SPAN");
    expect(wrapper.attributes("href")).toBeUndefined();
    expect(wrapper.attributes("tabindex")).toBeUndefined();
    expect(wrapper.find(".lucide-external-link").exists()).toBe(false);
  });

  it("stays inert when the documentation url is not a web url", () => {
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({ documentation: "javascript:alert(1)" }),
    );
    getExternalLinkUrl.mockReturnValue(undefined);

    const wrapper = mountChip({ protocol: outputProtocol(), linkToDocs: true });

    expect(wrapper.element.tagName).toBe("SPAN");
    expect(wrapper.attributes("href")).toBeUndefined();
  });
});
