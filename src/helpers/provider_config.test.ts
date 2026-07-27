import { ProviderStatus } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  canReconfigureProvider,
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
});
