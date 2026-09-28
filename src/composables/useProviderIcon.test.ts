import { effectScope } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderIconVariant } from "@/plugins/api/interfaces";

const { providers, providerManifests, providerIcons } = vi.hoisted(() => ({
  providers: {} as Record<string, { domain: string }>,
  providerManifests: {} as Record<
    string,
    { name: string; icon_images: string[] }
  >,
  providerIcons: {} as Record<string, string>,
}));

vi.mock("vuetify", () => ({
  useTheme: () => ({ current: { value: { dark: false } } }),
}));
vi.mock("@/plugins/api", () => ({
  api: {
    providers,
    providerManifests,
    providerIcons,
    getProviderIcon: vi.fn(),
  },
}));

import { useProviderIcon } from "./useProviderIcon";

const run = (domain: string) => {
  const scope = effectScope();
  const icon = scope.run(() => useProviderIcon(() => domain))!;
  scope.stop();
  return icon;
};

describe("useProviderIcon", () => {
  afterEach(() => {
    for (const map of [providers, providerManifests, providerIcons])
      Object.keys(map).forEach((k) => delete map[k]);
  });

  it("falls back to the domain when the instance isn't loaded", () => {
    // instance not shared with this user, so absent from api.providers
    providerManifests["tidal"] = {
      name: "Tidal",
      icon_images: [ProviderIconVariant.DEFAULT],
    };
    providerIcons["tidal:default"] = "data:image/svg+xml;base64,PHN2Zy8+";

    const icon = run("tidal--abc");
    expect(icon.providerName.value).toBe("Tidal");
    expect(icon.iconDataUri.value).toBe("data:image/svg+xml;base64,PHN2Zy8+");
  });

  it("has no icon when the domain is unknown", () => {
    const icon = run("mystery--abc");
    expect(icon.providerName.value).toBe("");
    expect(icon.iconDataUri.value).toBeNull();
  });
});
