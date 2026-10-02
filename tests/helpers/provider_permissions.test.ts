import {
  canConfigureSourceAccess,
  canManageSource,
  canOwnSources,
  canReconfigureSource,
  canToggleSource,
  managesAllSources,
  maySetUpSource,
} from "@/helpers/provider_permissions";
import {
  ProviderSharing,
  ProviderStatus,
  ProviderType,
  type Scope,
  type User,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../fixtures/providerConfig";
import {
  BUILTIN_ROLE_SCOPES,
  MEMBER_WITHOUT_OWN_SCOPES,
  scopeChecker,
} from "../fixtures/scopes";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, TestProviderManifest>,
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  storeMock: { currentUser: undefined as User | undefined },
}));

interface TestProviderManifest {
  builtin: boolean;
  has_setup_flow: boolean;
  self_service: boolean;
}

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

const ownSource = providerConfig({
  domain: "spotify",
  access: {
    owner: "user-me",
    sharing: ProviderSharing.PRIVATE,
    shared_users: [],
  },
});
const sharedSource = providerConfig({
  domain: "spotify",
  access: {
    owner: "user-other",
    sharing: ProviderSharing.MEMBERS,
    shared_users: [],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.providerManifests = {
    spotify: { builtin: false, has_setup_flow: true, self_service: true },
  };
  storeMock.currentUser = user({ user_id: "user-me" });
  signInAs(BUILTIN_ROLE_SCOPES.admin);
});

describe("an admin", () => {
  it("manages, sets up and toggles every source", () => {
    expect(managesAllSources()).toBe(true);
    expect(canOwnSources()).toBe(true);
    expect(canToggleSource(sharedSource)).toBe(true);
    expect(canManageSource(sharedSource)).toBe(true);
    expect(maySetUpSource(sharedSource)).toBe(true);
  });

  it("may set up a provider members may not set up themselves", () => {
    apiMock.providerManifests.spotify.self_service = false;

    expect(maySetUpSource(sharedSource)).toBe(true);
  });
});

describe("a member", () => {
  beforeEach(() => signInAs(BUILTIN_ROLE_SCOPES.user));

  it("manages only the music sources it owns", () => {
    expect(managesAllSources()).toBe(false);
    expect(canOwnSources()).toBe(true);
    expect(canManageSource(ownSource)).toBe(true);
    expect(canManageSource(sharedSource)).toBe(false);
  });

  it("enables and disables only the music sources it owns", () => {
    expect(canToggleSource(ownSource)).toBe(true);
    expect(canToggleSource(sharedSource)).toBe(false);
  });

  it("sets up its own source only of a provider members may set up", () => {
    expect(maySetUpSource(ownSource)).toBe(true);

    apiMock.providerManifests.spotify.self_service = false;

    expect(maySetUpSource(ownSource)).toBe(false);
  });

  it("manages none once its role may no longer own sources", () => {
    signInAs(MEMBER_WITHOUT_OWN_SCOPES);

    expect(canOwnSources()).toBe(false);
    expect(canManageSource(ownSource)).toBe(false);
  });
});

describe("canReconfigureSource", () => {
  it("allows a source that may be set up and has a setup flow", () => {
    expect(canReconfigureSource(ownSource)).toBe(true);
  });

  it.each([
    ["without a setup flow", {}, { has_setup_flow: false }],
    ["while disabled", { enabled: false }, {}],
    ["while incompatible", { status: ProviderStatus.INCOMPATIBLE }, {}],
  ])("refuses a source %s", (_label, configOverrides, manifestOverrides) => {
    Object.assign(apiMock.providerManifests.spotify, manifestOverrides);

    expect(canReconfigureSource({ ...ownSource, ...configOverrides })).toBe(
      false,
    );
  });

  it("refuses a source the viewer may not set up", () => {
    signInAs(BUILTIN_ROLE_SCOPES.user);

    expect(canReconfigureSource(sharedSource)).toBe(false);
  });
});

describe("canConfigureSourceAccess", () => {
  it("allows a music source the viewer manages", () => {
    expect(canConfigureSourceAccess(ownSource)).toBe(true);
  });

  it("refuses a source the viewer does not manage", () => {
    signInAs(BUILTIN_ROLE_SCOPES.user);

    expect(canConfigureSourceAccess(sharedSource)).toBe(false);
  });

  it("refuses a builtin provider", () => {
    apiMock.providerManifests.spotify.builtin = true;

    expect(canConfigureSourceAccess(ownSource)).toBe(false);
  });

  it("refuses a source that is not a music source", () => {
    expect(
      canConfigureSourceAccess({ ...ownSource, type: ProviderType.PLAYER }),
    ).toBe(false);
  });
});

function signInAs(scopes: readonly Scope[]) {
  authMock.hasScope.mockImplementation(scopeChecker(scopes));
}
