import {
  coerceOptionValue,
  compileHost,
  decompileHost,
  optionValueToText,
  rowsToOptions,
  uniqueHostName,
} from "./ai_radio";
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
  options: {},
  segments: [],
  ...overrides,
});

const makeHost = (overrides: Partial<AIRadioHost> = {}): AIRadioHost => ({
  id: "rick",
  name: "Rick",
  instructions: "Persona.",
  tts_engine: "",
  language: "",
  options: {},
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
    expect(uniqueHostName("morning show", ["Morning Show"])).toBe(
      "morning show 2",
    );
  });

  it("collides on names that slugify alike, not just on case", () => {
    expect(uniqueHostName("Morning show", ["Morning-show"])).toBe(
      "Morning show 2",
    );
    expect(uniqueHostName("Morning show", ["morning_show"])).toBe(
      "Morning show 2",
    );
  });

  it("collides on names that differ only in surrounding whitespace", () => {
    expect(uniqueHostName("Morning show ", ["Morning show"])).not.toBe(
      "Morning show ",
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

describe("coerceOptionValue", () => {
  it("parses plain integers and decimals as numbers", () => {
    expect(coerceOptionValue("1.2")).toBe(1.2);
    expect(coerceOptionValue("42")).toBe(42);
    expect(coerceOptionValue("-3.5")).toBe(-3.5);
    expect(coerceOptionValue("0")).toBe(0);
    expect(coerceOptionValue("0.5")).toBe(0.5);
  });

  it("parses true/false as booleans", () => {
    expect(coerceOptionValue("true")).toBe(true);
    expect(coerceOptionValue("false")).toBe(false);
  });

  it("keeps an empty string a string", () => {
    expect(coerceOptionValue("")).toBe("");
  });

  it("keeps a leading-zero value a string, not an octal-looking number", () => {
    expect(coerceOptionValue("007")).toBe("007");
  });

  it("keeps a version-like value a string", () => {
    expect(coerceOptionValue("1.2.3")).toBe("1.2.3");
  });

  it("keeps arbitrary text a string", () => {
    expect(coerceOptionValue("en_US-lessac-medium")).toBe(
      "en_US-lessac-medium",
    );
  });
});

describe("optionValueToText", () => {
  it("round-trips strings, numbers and booleans back to their plain text form", () => {
    expect(optionValueToText("en_US-lessac-medium")).toBe(
      "en_US-lessac-medium",
    );
    expect(optionValueToText(1.2)).toBe("1.2");
    expect(optionValueToText(true)).toBe("true");
    expect(optionValueToText(false)).toBe("false");
  });
});

describe("rowsToOptions", () => {
  it("coerces each row's value and trims keys", () => {
    expect(
      rowsToOptions([
        { key: " voice ", value: "en_US-lessac-medium" },
        { key: "length_scale", value: "1.2" },
      ]),
    ).toEqual({
      voice: "en_US-lessac-medium",
      length_scale: 1.2,
    });
  });

  it("drops rows with an empty or whitespace-only key", () => {
    expect(
      rowsToOptions([
        { key: "", value: "ignored" },
        { key: "   ", value: "ignored" },
        { key: "voice", value: "en_US-lessac-medium" },
      ]),
    ).toEqual({ voice: "en_US-lessac-medium" });
  });

  it("lets a duplicate key's last row win", () => {
    expect(
      rowsToOptions([
        { key: "voice", value: "first" },
        { key: "voice", value: "second" },
      ]),
    ).toEqual({ voice: "second" });
  });
});

describe("options field round-trip", () => {
  it("carries a draft's options through compileHost unchanged", () => {
    const { host } = compileHost(
      makeDraft({
        options: { voice: "en_US-lessac-medium", length_scale: 1.2 },
      }),
    );
    expect(host.options).toEqual({
      voice: "en_US-lessac-medium",
      length_scale: 1.2,
    });
  });

  it("carries a host's options through decompileHost", () => {
    const draft = decompileHost(makeHost({ options: { speed: 0.9 } }), []);
    expect(draft.options).toEqual({ speed: 0.9 });
  });

  it("defaults to an empty object when a host from an older server has no options key at all", () => {
    const { options: _omitted, ...hostWithoutOptions } = makeHost();
    const draft = decompileHost(hostWithoutOptions as AIRadioHost, []);
    expect(draft.options).toEqual({});
  });
});
