import { ProviderStage, ProviderStatus } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../tests/fixtures/providerConfig";
import {
  canReconfigureProvider,
  getProviderName,
  getProviderStageTranslationKey,
  getProviderStatusTranslationKey,
  getProviderSupportIssuesUrl,
  providerRequiresReconfiguration,
  shouldShowStageBadge,
} from "./provider_config";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, { name: string }>,
    providers: {} as Record<string, { name: string }>,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

describe("provider configuration state", () => {
  it.each([
    [ProviderStatus.LOADED, true, true, true],
    [ProviderStatus.ERROR, true, true, true],
    [ProviderStatus.INCOMPATIBLE, true, true, false],
    [ProviderStatus.LOADED, true, false, false],
    [ProviderStatus.LOADED, false, true, false],
    [ProviderStatus.LOADED, undefined, true, false],
  ])(
    "identifies reconfiguration support for status %s, setup flow %s, enabled %s",
    (status, hasSetupFlow, enabled, expected) => {
      expect(canReconfigureProvider(status, hasSetupFlow, enabled)).toBe(
        expected,
      );
    },
  );

  it.each([
    [ProviderStatus.AUTH_REQUIRED, true, true, true],
    [ProviderStatus.AUTH_REQUIRED, true, false, false],
    [ProviderStatus.AUTH_REQUIRED, false, true, false],
    [ProviderStatus.ERROR, true, true, false],
    [ProviderStatus.LOADED, true, true, false],
    [undefined, true, true, false],
  ])(
    "identifies required reconfiguration for status %s, setup flow %s, enabled %s",
    (status, hasSetupFlow, enabled, expected) => {
      expect(
        providerRequiresReconfiguration(status, hasSetupFlow, enabled),
      ).toBe(expected);
    },
  );

  it.each([
    [ProviderStatus.LOADED, "settings.provider_status_loaded"],
    [ProviderStatus.LOADING, "settings.provider_status_loading"],
    [ProviderStatus.DISABLED, "settings.provider_status_disabled"],
    [ProviderStatus.AUTH_REQUIRED, "settings.provider_status_auth_required"],
    [ProviderStatus.INCOMPATIBLE, "settings.provider_status_incompatible"],
    [ProviderStatus.ERROR, "settings.provider_status_error"],
    [undefined, "settings.provider_status_unknown"],
  ])("maps provider status %s to %s", (status, expected) => {
    expect(getProviderStatusTranslationKey(status)).toBe(expected);
  });

  it.each([
    [
      ProviderStatus.INCOMPATIBLE,
      ProviderStage.DEPRECATED,
      "settings.provider_status_retired",
    ],
    [
      ProviderStatus.INCOMPATIBLE,
      ProviderStage.STABLE,
      "settings.provider_status_incompatible",
    ],
    [
      ProviderStatus.INCOMPATIBLE,
      undefined,
      "settings.provider_status_incompatible",
    ],
    // only INCOMPATIBLE is ambiguous; a deprecated provider that still loads
    // keeps its own status
    [
      ProviderStatus.LOADED,
      ProviderStage.DEPRECATED,
      "settings.provider_status_loaded",
    ],
    [undefined, ProviderStage.DEPRECATED, "settings.provider_status_unknown"],
  ])("maps status %s at stage %s to %s", (status, stage, expected) => {
    expect(getProviderStatusTranslationKey(status, stage)).toBe(expected);
  });

  it.each([
    [ProviderStage.ALPHA, "settings.stage.options.alpha"],
    [ProviderStage.BETA, "settings.stage.options.beta"],
    [ProviderStage.STABLE, "settings.stage.options.stable"],
    [ProviderStage.EXPERIMENTAL, "settings.stage.options.experimental"],
    [ProviderStage.UNMAINTAINED, "settings.stage.options.unmaintained"],
    [ProviderStage.DEPRECATED, "settings.stage.options.deprecated"],
    [undefined, undefined],
    ["", undefined],
    ["something_new", undefined],
  ])("maps provider stage %s to %s", (stage, expected) => {
    expect(getProviderStageTranslationKey(stage)).toBe(expected);
  });

  it.each([
    [ProviderStage.STABLE, false],
    [ProviderStage.ALPHA, true],
    [ProviderStage.BETA, true],
    [ProviderStage.EXPERIMENTAL, true],
    [ProviderStage.UNMAINTAINED, true],
    [ProviderStage.DEPRECATED, true],
    [undefined, false],
    ["something_new", false],
  ])("badges provider stage %s: %s", (stage, expected) => {
    expect(shouldShowStageBadge(stage)).toBe(expected);
  });

  it.each([
    ["spotify", "spotify"],
    ["spotify_connect", "Spotify Connect"],
    ["ytmusic", "youtube_music"],
  ])("builds a support issues link for %s", (domain, label) => {
    expect(getProviderSupportIssuesUrl(domain)).toBe(
      `https://github.com/music-assistant/support/issues?q=${encodeURIComponent(
        `is:issue state:open label:"${label}"`,
      )}`,
    );
  });
});

describe("provider display name", () => {
  beforeEach(() => {
    apiMock.providers = {};
    apiMock.providerManifests = {};
  });

  it("prefers the custom name from the config over the live instance name", () => {
    const config = providerConfig({
      domain: "spotify",
      name: "Kitchen Spotify",
      default_name: "Spotify",
    });
    apiMock.providers[config.instance_id] = { name: "Spotify" };
    apiMock.providerManifests[config.domain] = { name: "Spotify" };

    expect(getProviderName(config)).toBe("Kitchen Spotify");
  });

  it("uses the live instance name when the config has no custom name", () => {
    const config = providerConfig({
      domain: "spotify",
      default_name: "Spotify",
    });
    apiMock.providers[config.instance_id] = { name: "Spotify (bob)" };
    apiMock.providerManifests[config.domain] = { name: "Spotify" };

    expect(getProviderName(config)).toBe("Spotify (bob)");
  });

  it("falls back to the default name for an unloaded provider", () => {
    // an unloaded provider has no instance to read a name from
    const config = providerConfig({
      domain: "spotify",
      name: null,
      default_name: "Spotify (bob)",
    });
    apiMock.providerManifests[config.domain] = { name: "Spotify" };

    expect(getProviderName(config)).toBe("Spotify (bob)");
  });

  it("falls back to the manifest name without a custom or default name", () => {
    const config = providerConfig({ domain: "spotify" });
    apiMock.providerManifests[config.domain] = { name: "Spotify" };

    expect(getProviderName(config)).toBe("Spotify");
  });

  it("falls back to the instance id when nothing else is known", () => {
    const config = providerConfig({ domain: "spotify" });

    expect(getProviderName(config)).toBe(config.instance_id);
  });

  it("falls through an empty custom name rather than rendering blank", () => {
    const config = providerConfig({ domain: "spotify", name: "" });
    apiMock.providerManifests[config.domain] = { name: "Spotify" };

    expect(getProviderName(config)).toBe("Spotify");
  });
});
