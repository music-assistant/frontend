import {
  ProviderStatus,
  ProviderType,
  type RemoteAccessInfo,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerConfig } from "../../tests/fixtures/providerConfig";
import {
  HASS_DOMAIN,
  hassConnectionState,
  remoteAccessStateKey,
} from "./home_assistant";

function hassConfig(status: ProviderStatus | null) {
  return providerConfig({
    domain: HASS_DOMAIN,
    type: ProviderType.PLUGIN,
    status,
  });
}

describe("hassConnectionState", () => {
  it("is not set up without a config", () => {
    expect(hassConnectionState(undefined)).toBe("not_set_up");
  });

  it.each([
    [ProviderStatus.LOADED, "connected"],
    [ProviderStatus.LOADING, "connecting"],
    [null, "connecting"],
    [ProviderStatus.DISABLED, "disabled"],
    [ProviderStatus.AUTH_REQUIRED, "needs_attention"],
    [ProviderStatus.ERROR, "needs_attention"],
    [ProviderStatus.INCOMPATIBLE, "needs_attention"],
    [ProviderStatus.UNAVAILABLE, "needs_attention"],
  ] as const)("follows provider status %s as %s", (status, expected) => {
    expect(hassConnectionState(hassConfig(status))).toBe(expected);
  });
});

describe("remoteAccessStateKey", () => {
  const info = (overrides: Partial<RemoteAccessInfo>): RemoteAccessInfo => ({
    enabled: true,
    running: true,
    connected: true,
    remote_id: "MA-TEST",
    using_ha_cloud: false,
    signaling_url: "wss://signaling.example",
    ...overrides,
  });

  it("says remote access is off", () => {
    expect(remoteAccessStateKey(info({ enabled: false }))).toBe("off");
  });

  it("says it runs through Home Assistant Cloud", () => {
    expect(remoteAccessStateKey(info({ using_ha_cloud: true }))).toBe(
      "settings.home_assistant.remote_access_ha_cloud",
    );
  });

  it("says it runs without Home Assistant Cloud", () => {
    expect(remoteAccessStateKey(info({ using_ha_cloud: false }))).toBe(
      "settings.home_assistant.remote_access_without_ha_cloud",
    );
  });
});
