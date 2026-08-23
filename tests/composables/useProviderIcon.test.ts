import { useProviderIcon } from "@/composables/useProviderIcon";
import { ProviderIconVariant } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";

interface ApiMock {
  providers: Record<string, { domain: string }>;
  providerManifests: Record<
    string,
    { name: string; icon_images: ProviderIconVariant[] }
  >;
  providerIcons: Record<string, string | null>;
  getProviderIcon: (
    domain: string,
    variant: ProviderIconVariant,
  ) => Promise<string | null>;
  /** Completes the pending request for `<domain>:<variant>`. */
  resolveIcon: (key: string, dataUri: string | null) => void;
}

const mocks = vi.hoisted(() => ({
  api: undefined as unknown as ApiMock,
  dark: { value: false },
}));

vi.mock("vuetify", () => ({
  useTheme: () => ({ current: { value: { dark: mocks.dark.value } } }),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  const providerIcons = reactive<Record<string, string | null>>({});
  const pending = new Map<string, (dataUri: string | null) => void>();
  const api: ApiMock = {
    providers: {},
    providerManifests: {},
    providerIcons,
    getProviderIcon: (domain, variant) =>
      new Promise((resolve) => {
        const key = `${domain}:${variant}`;
        pending.set(key, (dataUri) => {
          providerIcons[key] = dataUri;
          resolve(dataUri);
        });
      }),
    resolveIcon: (key, dataUri) => pending.get(key)?.(dataUri),
  };
  mocks.api = api;
  return { api };
});

describe("useProviderIcon", () => {
  const withProviders = function (...domains: string[]) {
    for (const domain of domains) {
      mocks.api.providerManifests[domain] = {
        name: domain,
        icon_images: [ProviderIconVariant.DEFAULT],
      };
    }
  };

  beforeEach(() => {
    for (const key of Object.keys(mocks.api.providerIcons))
      delete mocks.api.providerIcons[key];
    for (const key of Object.keys(mocks.api.providerManifests))
      delete mocks.api.providerManifests[key];
    mocks.dark.value = false;
  });

  it("exposes the icon once the request completes", () => {
    withProviders("alpha");
    const scope = effectScope();
    const icon = scope.run(() => useProviderIcon("alpha"))!;

    expect(icon.iconDataUri.value).toBeNull();

    mocks.api.resolveIcon("alpha:default", "data:image/png;base64,alpha");

    expect(icon.iconDataUri.value).toBe("data:image/png;base64,alpha");
    scope.stop();
  });

  it("keeps the icon of the provider showing now when an earlier request lands late", async () => {
    withProviders("alpha", "beta");
    const domain = ref("alpha");
    const scope = effectScope();
    const icon = scope.run(() => useProviderIcon(domain))!;

    domain.value = "beta";
    await nextTick();

    mocks.api.resolveIcon("beta:default", "data:image/png;base64,beta");
    expect(icon.iconDataUri.value).toBe("data:image/png;base64,beta");

    mocks.api.resolveIcon("alpha:default", "data:image/png;base64,alpha");
    expect(icon.iconDataUri.value).toBe("data:image/png;base64,beta");
    scope.stop();
  });
});
