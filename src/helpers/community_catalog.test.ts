import { CommunityProviderState } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { communityProvider } from "../../tests/fixtures/communityProvider";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import {
  formatCatalogDate,
  getCommunityStateLabel,
  getCommunityStateText,
  getInstalledCommunityProviders,
  getRepositoryUrl,
  isCommunityInstalled,
  isCommunityProblem,
  isCommunityRunning,
} from "./community_catalog";

const ERROR = { error_code: 61, message: "It does not run." };

describe("the state of one from the community catalog", () => {
  it.each([
    [CommunityProviderState.AVAILABLE, false, false, false],
    [CommunityProviderState.INSTALLED, true, true, false],
    [CommunityProviderState.UPDATE_AVAILABLE, true, true, false],
    [CommunityProviderState.RESTART_REQUIRED, true, true, false],
    [CommunityProviderState.WITHDRAWN, true, false, false],
    [CommunityProviderState.BLOCKED, true, false, true],
    [CommunityProviderState.UNAVAILABLE, true, false, true],
  ])(
    "%s: installed %s, running %s, a problem %s",
    (state, installed, running, problem) => {
      const provider = communityProvider("radio", { state });

      expect(isCommunityInstalled(provider)).toBe(installed);
      expect(isCommunityRunning(provider)).toBe(running);
      expect(isCommunityProblem(provider)).toBe(problem);
    },
  );

  it.each([
    [CommunityProviderState.INSTALLED, undefined],
    [CommunityProviderState.UPDATE_AVAILABLE, undefined],
    [
      CommunityProviderState.BLOCKED,
      "settings.catalog.community.state.blocked",
    ],
    [
      CommunityProviderState.UNAVAILABLE,
      "settings.catalog.community.state.unavailable",
    ],
    [
      CommunityProviderState.WITHDRAWN,
      "settings.catalog.community.state.withdrawn",
    ],
  ])("labels %s as %s", (state, label) => {
    expect(getCommunityStateLabel(communityProvider("radio", { state }))).toBe(
      label,
    );
  });

  it("says why it does not run before what the catalog says about it", () => {
    expect(
      getCommunityStateText(
        communityProvider("radio", { error: ERROR, reason: "Abuse" }),
      ),
    ).toBe("It does not run.");
    expect(
      getCommunityStateText(communityProvider("radio", { reason: "Abuse" })),
    ).toBe("Abuse");
    expect(getCommunityStateText(communityProvider("radio"))).toBe("");
  });
});

describe("getInstalledCommunityProviders", () => {
  it("lists the installed ones by name, running or not", () => {
    const named = (
      domain: string,
      name: string,
      state: CommunityProviderState,
    ) =>
      communityProvider(domain, {
        state,
        manifest: providerManifest({ domain, name }),
      });

    const installed = getInstalledCommunityProviders([
      named("zebra", "Zebra radio", CommunityProviderState.INSTALLED),
      named("offer", "Offered", CommunityProviderState.AVAILABLE),
      named("alpha", "alpha FM", CommunityProviderState.BLOCKED),
    ]);

    expect(installed.map((provider) => provider.domain)).toEqual([
      "alpha",
      "zebra",
    ]);
  });
});

describe("getRepositoryUrl", () => {
  it("points at the repository on GitHub", () => {
    expect(getRepositoryUrl("jane/radio")).toBe(
      "https://github.com/jane/radio",
    );
  });
});

describe("formatCatalogDate", () => {
  it("shows a date the way the locale writes it", () => {
    expect(formatCatalogDate("2026-11-02T12:00:00Z", "en-US")).toBe(
      "Nov 2, 2026",
    );
    expect(formatCatalogDate("2026-11-02T12:00:00Z", "nl-NL")).toBe(
      "2 nov 2026",
    );
  });
});
