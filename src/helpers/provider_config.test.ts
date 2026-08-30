import { ProviderStage, ProviderStatus } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  canReconfigureProvider,
  getProviderStageTranslationKey,
  getProviderStatusTranslationKey,
  getProviderSupportIssuesUrl,
  providerRequiresReconfiguration,
  shouldShowStageBadge,
} from "./provider_config";

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
