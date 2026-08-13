import { compileHost, decompileHost, uniqueHostName } from "./ai_radio";
import type { HostDraft } from "./ai_radio";
import type { AIRadioHost } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale.replaceAll("_", "-"),
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

const makeDraft = (overrides: Partial<HostDraft> = {}): HostDraft => ({
  id: "rick",
  name: "Rick",
  instructions: "Persona.",
  ttsEngine: "",
  language: "",
  segments: [],
  ...overrides,
});

const makeHost = (overrides: Partial<AIRadioHost> = {}): AIRadioHost => ({
  id: "rick",
  name: "Rick",
  instructions: "Persona.",
  tts_engine: "",
  language: "",
  section_ids: [],
  section_order: [],
  merge_section_id: "",
  ...overrides,
});

describe("uniqueHostName", () => {
  it("returns the name unchanged when nothing collides", () => {
    expect(uniqueHostName("Morning show", [])).toBe("Morning show");
    expect(uniqueHostName("Morning show", ["Party host"])).toBe("Morning show");
  });

  it("appends 2 on a single collision", () => {
    expect(uniqueHostName("Morning show", ["Morning show"])).toBe(
      "Morning show 2",
    );
  });

  it("keeps incrementing past several collisions", () => {
    expect(
      uniqueHostName("Morning show", [
        "Morning show",
        "Morning show 2",
        "Morning show 3",
      ]),
    ).toBe("Morning show 4");
  });

  it("treats collisions case-insensitively, matching how host ids are slugified", () => {
    // compileHost derives a host's id by slugifying (and lowercasing) its
    // name, so "Morning Show" and "morning show" would collide anyway.
    expect(uniqueHostName("morning show", ["Morning Show"])).toBe(
      "morning show 2",
    );
  });
});

describe("language field round-trip", () => {
  it("carries a draft's language through compileHost unchanged", () => {
    const { host } = compileHost(makeDraft({ language: "nl_NL" }));
    expect(host.language).toBe("nl_NL");
  });

  it("carries a host's language through decompileHost", () => {
    const draft = decompileHost(makeHost({ language: "fr" }), []);
    expect(draft.language).toBe("fr");
  });

  it("defaults to the empty string (follow the server language) when absent", () => {
    const { language: _omitted, ...hostWithoutLanguage } = makeHost();
    const draft = decompileHost(hostWithoutLanguage as AIRadioHost, []);
    expect(draft.language).toBe("");
  });
});
