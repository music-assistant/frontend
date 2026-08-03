import { describe, expect, it } from "vitest";
import { mergeConfigEntries } from "@/helpers/config_entry_ui";
import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";

function entry(overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    key: "engine",
    type: ConfigEntryType.STRING,
    label: "Engine",
    default_value: null,
    required: false,
    category: "generic",
    ...overrides,
  };
}

describe("mergeConfigEntries", () => {
  it("adopts the fresh definition for an untouched key", () => {
    const current = { engine: entry({ options: [], read_only: true }) };
    const incoming = {
      engine: entry({
        options: [{ title: "Home Assistant", value: "ha" }],
        read_only: false,
      }),
    };

    const merged = mergeConfigEntries(current, incoming);

    expect(merged.engine.options).toEqual([
      { title: "Home Assistant", value: "ha" },
    ]);
    expect(merged.engine.read_only).toBe(false);
  });

  it("keeps a locally edited value while refreshing its definition", () => {
    const current = {
      name: entry({ key: "name", value: "typed but not saved" }),
    };
    const incoming = {
      name: entry({ key: "name", options: [], read_only: true }),
    };

    const merged = mergeConfigEntries(current, incoming);

    expect(merged.name.value).toBe("typed but not saved");
    expect(merged.name.read_only).toBe(true);
  });

  it("drops a key that no longer exists in the incoming entries", () => {
    const current = { stale: entry({ key: "stale" }) };
    const incoming = {};

    const merged = mergeConfigEntries(current, incoming);

    expect(merged).toEqual({});
  });

  it("adds a key that only exists in the incoming entries", () => {
    const current = {};
    const incoming = { fresh: entry({ key: "fresh" }) };

    const merged = mergeConfigEntries(current, incoming);

    expect(merged.fresh).toEqual(incoming.fresh);
    // the form edits entries in place, so a merged entry must never alias its input
    expect(merged.fresh).not.toBe(incoming.fresh);
  });

  it("does not mutate either input", () => {
    const current = { engine: entry({ value: "current value" }) };
    const incoming = {
      engine: entry({ options: [{ title: "A", value: "a" }] }),
    };
    const currentSnapshot = JSON.parse(JSON.stringify(current));
    const incomingSnapshot = JSON.parse(JSON.stringify(incoming));

    mergeConfigEntries(current, incoming);

    expect(current).toEqual(currentSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });
});
