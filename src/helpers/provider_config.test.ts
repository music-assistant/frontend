import { ProviderStatus } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  canReconfigureProvider,
  getProviderStatusTranslationKey,
  getProviderSupportIssuesUrl,
  providerRequiresReconfiguration,
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

  it("builds a provider-specific support issues link", () => {
    expect(getProviderSupportIssuesUrl("youtube_music")).toBe(
      "https://github.com/music-assistant/support/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22youtube_music%22",
    );
  });
});
