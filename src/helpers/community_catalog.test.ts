import {
  type CommunityProvider,
  CommunityProviderState,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { communityProvider } from "../../tests/fixtures/communityProvider";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import {
  canRetryCommunityVersion,
  formatCatalogDate,
  getCommunityLinkUrl,
  getCommunityStateLabel,
  getCommunityStateText,
  getInstalledCommunityProviders,
  getRepositoryUrl,
  hasCommunityUpdate,
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
      CommunityProviderState.RESTART_REQUIRED,
      "settings.catalog.community.state.restart_required",
    ],
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

describe("updates of one from the community catalog", () => {
  it.each([
    [CommunityProviderState.UPDATE_AVAILABLE, true],
    [CommunityProviderState.INSTALLED, false],
    [CommunityProviderState.RESTART_REQUIRED, false],
    [CommunityProviderState.AVAILABLE, false],
  ])("%s has an update: %s", (state, update) => {
    expect(hasCommunityUpdate(communityProvider("radio", { state }))).toBe(
      update,
    );
  });

  it("offers to try a failed version again only while it is the one on offer", () => {
    const installed = (overrides: Partial<CommunityProvider>) =>
      communityProvider("radio", {
        state: CommunityProviderState.INSTALLED,
        installed_version: "1.1.0",
        latest_version: "1.2.0",
        ...overrides,
      });

    expect(
      canRetryCommunityVersion(installed({ failed_version: "1.2.0" })),
    ).toBe(true);
    expect(canRetryCommunityVersion(installed({}))).toBe(false);
    // a newer version than the failed one is an ordinary update
    expect(
      canRetryCommunityVersion(
        installed({
          state: CommunityProviderState.UPDATE_AVAILABLE,
          failed_version: "1.2.0",
          latest_version: "1.3.0",
        }),
      ),
    ).toBe(false);
    // nothing to try while the catalog offers no version
    expect(
      canRetryCommunityVersion(
        installed({
          state: CommunityProviderState.WITHDRAWN,
          failed_version: "1.2.0",
        }),
      ),
    ).toBe(false);
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

  it("shows the day in UTC, whatever the time zone", () => {
    expect(formatCatalogDate("2026-11-02T00:00:00Z", "en-US")).toBe(
      "Nov 2, 2026",
    );
  });

  it("is empty for a value that is not a date", () => {
    expect(formatCatalogDate("soon", "en-US")).toBe("");
  });
});

describe("getCommunityLinkUrl", () => {
  it("only links to an https address", () => {
    expect(getCommunityLinkUrl("https://example.org/why")).toBe(
      "https://example.org/why",
    );
    expect(getCommunityLinkUrl("http://example.org/why")).toBeUndefined();
    expect(getCommunityLinkUrl("javascript:alert(1)")).toBeUndefined();
    expect(getCommunityLinkUrl("not a url")).toBeUndefined();
    expect(getCommunityLinkUrl(null)).toBeUndefined();
  });
});
