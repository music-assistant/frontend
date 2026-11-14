import type { CatalogEntry } from "@/helpers/provider_catalog";
import { ProviderTier, ProviderType } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { providerConfig } from "../../../../tests/fixtures/providerConfig";
import { providerManifest } from "../../../../tests/fixtures/providerManifest";
import { useCatalogEntryDetails } from "./useCatalogEntryDetails";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

describe("useCatalogEntryDetails", () => {
  it("describes an entry nobody has set up", () => {
    const details = useCatalogEntryDetails({
      manifest: providerManifest({
        type: ProviderType.PLAYER,
        codeowners: ["@music-assistant"],
      }),
      instances: [],
      canAdd: true,
    });

    expect(details.typeLabel.value).toBe("settings.catalog.type.player");
    expect(details.community.value).toBe(false);
    expect(details.maintainers.value).toEqual([]);
    expect(details.isSetUp.value).toBe(false);
  });

  it("follows the entry once an instance is set up", () => {
    const entry = ref<CatalogEntry>({
      manifest: providerManifest({
        domain: "soundcloud",
        tier: ProviderTier.COMMUNITY,
        codeowners: ["@jane", "@music-assistant"],
      }),
      instances: [],
      canAdd: true,
    });
    const details = useCatalogEntryDetails(entry);

    entry.value = {
      ...entry.value,
      instances: [
        providerConfig({ domain: "soundcloud", instance_id: "soundcloud--a" }),
      ],
      canAdd: false,
    };

    expect(details.community.value).toBe(true);
    expect(details.maintainers.value).toEqual(["@jane"]);
    expect(details.isSetUp.value).toBe(true);
    expect(details.manageRoute.value).toEqual({
      name: "editprovider",
      params: { instanceId: "soundcloud--a" },
    });
  });
});
