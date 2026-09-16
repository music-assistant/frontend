import api from "@/plugins/api";
import { ProviderType, type ProviderInstance } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerInstance } from "../fixtures/providerInstance";

// the store derives the plugins from api.providers, so the mock has to hold a
// reactive map: the store would never hear about changes to a plain one
vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = { providers: reactive<Record<string, ProviderInstance>>({}) };
  return { api, default: api };
});

describe("enabledPlugins", () => {
  beforeEach(() => {
    receiveProviders();
  });

  it("lists the plugins that are loaded", () => {
    receiveProviders(
      plugin("party"),
      // enabled, but still loading or failed to load: its page can't work
      plugin("music_quiz", { available: false }),
      providerInstance({ domain: "spotify" }),
    );

    expect(store.enabledPlugins).toEqual(new Set(["party"]));
  });

  it("follows the provider list as the server updates it", () => {
    receiveProviders(plugin("party"), plugin("ai_radio"));
    expect(store.enabledPlugins).toEqual(new Set(["party", "ai_radio"]));

    receiveProviders(plugin("ai_radio"));
    expect(store.enabledPlugins).toEqual(new Set(["ai_radio"]));
  });
});

/**
 * A plugin, as the server lists it among the providers.
 */
function plugin(
  domain: string,
  overrides: Partial<ProviderInstance> = {},
): ProviderInstance {
  return providerInstance({ type: ProviderType.PLUGIN, domain, ...overrides });
}

/**
 * Hand the api a provider list the way it takes one in: it empties the map it
 * holds and fills that same map again.
 */
function receiveProviders(...providers: ProviderInstance[]) {
  for (const id of Object.keys(api.providers)) delete api.providers[id];
  for (const provider of providers) {
    api.providers[provider.instance_id] = provider;
  }
}
