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

const theme = vi.hoisted(() => ({ isDark: { value: false } }));

vi.mock("@/composables/useThemePreference", () => theme);
vi.mock("@/plugins/api", () => ({
  api: {
    providers,
    providerManifests,
    providerIcons,
    getProviderIcon: vi.fn(),
  },
}));

import { useProviderIcon } from "./useProviderIcon";

const run = (domain: string, light = false) => {
  const scope = effectScope();
  const icon = scope.run(() => useProviderIcon(() => domain, { light }))!;
  scope.stop();
  return icon;
};

describe("useProviderIcon", () => {
  afterEach(() => {
    theme.isDark.value = false;
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

  // the server converts SMB and NFS sources into Local files, keeping their ids
  it("shows Local files for a converted source that isn't loaded", () => {
    providerManifests["filesystem_local"] = {
      name: "Local files",
      icon_images: [ProviderIconVariant.DEFAULT],
    };
    providerIcons["filesystem_local:default"] =
      "data:image/svg+xml;base64,PGxvY2FsLz4=";

    const icon = run("filesystem_smb--fyQZakP3");
    expect(icon.providerName.value).toBe("Local files");
    expect(icon.iconDataUri.value).toBe(
      "data:image/svg+xml;base64,PGxvY2FsLz4=",
    );
  });

  it("keeps the default icon in a dark theme for a light background", () => {
    theme.isDark.value = true;
    providerManifests["tidal"] = {
      name: "Tidal",
      icon_images: [ProviderIconVariant.DEFAULT, ProviderIconVariant.DARK],
    };
    providerIcons["tidal:default"] = "data:image/svg+xml;base64,ZGFyaw==";
    providerIcons["tidal:dark"] = "data:image/svg+xml;base64,bGlnaHQ=";

    expect(run("tidal").iconDataUri.value).toBe(
      "data:image/svg+xml;base64,bGlnaHQ=",
    );
    expect(run("tidal", true).iconDataUri.value).toBe(
      "data:image/svg+xml;base64,ZGFyaw==",
    );
  });

  it("has no icon when the domain is unknown", () => {
    const icon = run("mystery--abc");
    expect(icon.providerName.value).toBe("");
    expect(icon.iconDataUri.value).toBeNull();
  });
});
