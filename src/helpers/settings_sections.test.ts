import { Scope } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  BUILTIN_ROLE_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../../tests/fixtures/scopes";
import { availableSettingsSections } from "./settings_sections";

const ALL_SECTIONS = [
  "music_providers",
  "player_providers",
  "metadata_providers",
  "plugin_providers",
  "players",
  "audio_analysis_providers",
  "profile",
  "frontend",
  "users",
  "remote_access",
  "system",
  "about",
];

function sectionNames(
  scopes: readonly Scope[],
  serverVersionAtLeast: (version: string) => boolean = () => true,
): string[] {
  return availableSettingsSections(
    scopeChecker(scopes),
    serverVersionAtLeast,
  ).map((section) => section.name);
}

describe("availableSettingsSections", () => {
  it("lists every section to an admin", () => {
    expect(sectionNames(BUILTIN_ROLE_SCOPES.admin)).toEqual(ALL_SECTIONS);
  });

  it("lists a member its own music sources and its personal settings", () => {
    expect(sectionNames(BUILTIN_ROLE_SCOPES.user)).toEqual([
      "music_providers",
      "profile",
      "frontend",
      "about",
    ]);
  });

  it("lists a guest its personal settings only", () => {
    expect(sectionNames(BUILTIN_ROLE_SCOPES.guest)).toEqual([
      "profile",
      "frontend",
      "about",
    ]);
  });

  it("lists a role managing its own music sources nothing more to manage", () => {
    expect(sectionNames(OWN_SOURCES_ROLE_SCOPES)).toEqual([
      "music_providers",
      "profile",
      "frontend",
      "about",
    ]);
  });

  it("lists the users to a role that may read them", () => {
    expect(
      sectionNames([...BUILTIN_ROLE_SCOPES.guest, Scope.USERS_READ]),
    ).toContain("users");
  });

  it("leaves out a section the server is too old for", () => {
    expect(
      sectionNames(BUILTIN_ROLE_SCOPES.admin, (version) => version !== "2.9.0"),
    ).not.toContain("audio_analysis_providers");
  });
});
