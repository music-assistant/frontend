import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import { UserRole, type Scope, type User } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILTIN_ROLE_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../../tests/fixtures/scopes";
import { user } from "../../tests/fixtures/user";
import {
  hasOnboardingTrack,
  isAdminTrack,
  isMemberTrack,
  isNewAccount,
  ONBOARDING_WELCOME_PREFERENCE,
  shouldOpenWelcome,
} from "./onboarding_access";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { currentUser: undefined as User | undefined },
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

/** Sign in with a role and the scopes it grants. */
function signInAs(
  overrides: Partial<User> = {},
  scopes: readonly Scope[] = BUILTIN_ROLE_SCOPES.user,
) {
  vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));
  storeMock.currentUser = user(overrides);
}

beforeEach(() => {
  storeMock.currentUser = undefined;
  vi.mocked(authManager.hasScope).mockReturnValue(false);
});

describe("the onboarding track a session is on", () => {
  it.each([
    {
      who: "an admin",
      scopes: BUILTIN_ROLE_SCOPES.admin,
      role: UserRole.ADMIN,
      admin: true,
      member: false,
    },
    {
      who: "a member",
      scopes: BUILTIN_ROLE_SCOPES.user,
      role: UserRole.USER,
      admin: false,
      member: true,
    },
    {
      // a role an admin made up here: not a guest, so someone who lives here
      who: "a custom role",
      scopes: OWN_SOURCES_ROLE_SCOPES,
      role: "dj",
      admin: false,
      member: true,
    },
    {
      who: "a guest",
      scopes: BUILTIN_ROLE_SCOPES.guest,
      role: UserRole.GUEST,
      admin: false,
      member: false,
    },
    {
      // the Home Assistant integration signs in as one of these
      who: "a service account",
      scopes: BUILTIN_ROLE_SCOPES.user,
      role: UserRole.SERVICE,
      admin: false,
      member: false,
    },
  ])(
    "puts $who on the admin track: $admin",
    ({ scopes, role, admin, member }) => {
      signInAs({ role }, scopes);

      expect(isAdminTrack()).toBe(admin);
      expect(isMemberTrack()).toBe(member);
      expect(hasOnboardingTrack()).toBe(admin || member);
    },
  );

  it("has nothing for a session nobody is signed in on", () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );

    expect(isMemberTrack()).toBe(false);
    expect(hasOnboardingTrack()).toBe(false);
  });

  it("leaves the Home Assistant system account out", () => {
    // it signs in like anyone else, and is nobody to welcome into a household
    signInAs({ username: HOMEASSISTANT_SYSTEM_USER });

    expect(isMemberTrack()).toBe(false);
    expect(hasOnboardingTrack()).toBe(false);
  });

  it("never puts an admin on both tracks at once", () => {
    signInAs({ role: UserRole.ADMIN }, BUILTIN_ROLE_SCOPES.admin);

    // the two tracks are exclusive, which is what keeps their steps apart
    expect(isAdminTrack() && isMemberTrack()).toBe(false);
  });
});

describe("opening the welcome by itself", () => {
  const justNow = () => new Date().toISOString();

  it("welcomes a member who has just been given an account", () => {
    signInAs({ created_at: justNow() });

    expect(shouldOpenWelcome()).toBe(true);
  });

  it("leaves a member who has been welcomed already alone", () => {
    signInAs({
      created_at: justNow(),
      preferences: { [ONBOARDING_WELCOME_PREFERENCE]: "2026-01-02T03:04:05Z" },
    });

    // the marker is the whole answer: it says the welcome has been shown
    expect(shouldOpenWelcome()).toBe(false);
  });

  it("leaves a member who has had the account a while to find it", () => {
    signInAs({ created_at: "2024-01-01T00:00:00Z" });

    expect(shouldOpenWelcome()).toBe(false);
  });

  it("interrupts nobody over a date it cannot read", () => {
    signInAs({ created_at: "not a date" });

    expect(shouldOpenWelcome()).toBe(false);
  });

  it.each([
    ["a guest", UserRole.GUEST, BUILTIN_ROLE_SCOPES.guest],
    ["an admin", UserRole.ADMIN, BUILTIN_ROLE_SCOPES.admin],
  ])("never opens the welcome on %s", (_who, role, scopes) => {
    signInAs({ role, created_at: justNow() }, scopes);

    expect(shouldOpenWelcome()).toBe(false);
  });

  it("opens nothing while nobody is signed in", () => {
    expect(shouldOpenWelcome()).toBe(false);
  });
});

describe("a new account", () => {
  const NOW = Date.parse("2024-03-10T12:00:00Z");

  it.each([
    ["the moment it was created", "2024-03-10T12:00:00Z", true],
    ["a day old", "2024-03-09T12:00:00Z", true],
    ["just inside the week", "2024-03-03T12:00:01Z", true],
    ["exactly a week old", "2024-03-03T12:00:00Z", true],
    ["just over a week old", "2024-03-03T11:59:59Z", false],
    ["months old", "2023-11-01T00:00:00Z", false],
    // a browser clock running behind the server's is no reason to keep
    // someone out of their own welcome
    ["created in the future", "2024-03-11T12:00:00Z", true],
  ])("counts an account created %s: %s", (_case, createdAt, isNew) => {
    expect(isNewAccount(createdAt, NOW)).toBe(isNew);
  });

  it.each(["", "not a date", "2024-13-45"])(
    "never counts %o as a date worth interrupting someone over",
    (createdAt) => {
      expect(isNewAccount(createdAt, NOW)).toBe(false);
    },
  );
});
