import { describe, expect, it } from "vitest";
import {
  isEntryDisabled,
  mergeActionEntries,
  mergeConfigEntries,
} from "@/helpers/config_entry_ui";
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

describe("isEntryDisabled", () => {
  const dependant = (overrides: Partial<ConfigEntry> = {}) =>
    entry({ key: "engine_option", depends_on: "engine", ...overrides });

  it("leaves an entry without a dependency enabled", () => {
    expect(isEntryDisabled(entry(), [entry()])).toBe(false);
  });

  it("disables an entry whose dependency is not on the form", () => {
    expect(isEntryDisabled(dependant(), [])).toBe(true);
  });

  it("disables on a falsy dependency value when no expected value is given", () => {
    const dep = entry({ value: "" });

    expect(isEntryDisabled(dependant(), [dep])).toBe(true);
  });

  it("enables on a truthy dependency value when no expected value is given", () => {
    const dep = entry({ value: "ha" });

    expect(isEntryDisabled(dependant(), [dep])).toBe(false);
  });

  it("enables only while the dependency holds depends_on_value", () => {
    const target = dependant({ depends_on_value: "ha" });

    expect(isEntryDisabled(target, [entry({ value: "ha" })])).toBe(false);
    expect(isEntryDisabled(target, [entry({ value: "other" })])).toBe(true);
  });

  it("matches a falsy depends_on_value", () => {
    const target = dependant({ depends_on_value: false });
    const boolDep = (value: boolean) =>
      entry({ type: ConfigEntryType.BOOLEAN, value });

    expect(isEntryDisabled(target, [boolDep(false)])).toBe(false);
    expect(isEntryDisabled(target, [boolDep(true)])).toBe(true);
  });

  it("disables while the dependency holds depends_on_value_not", () => {
    const target = dependant({ depends_on_value_not: "off" });

    expect(isEntryDisabled(target, [entry({ value: "off" })])).toBe(true);
    expect(isEntryDisabled(target, [entry({ value: "ha" })])).toBe(false);
  });

  it("matches a falsy depends_on_value_not", () => {
    const target = dependant({ depends_on_value_not: false });
    const boolDep = (value: boolean) =>
      entry({ type: ConfigEntryType.BOOLEAN, value });

    expect(isEntryDisabled(target, [boolDep(false)])).toBe(true);
    expect(isEntryDisabled(target, [boolDep(true)])).toBe(false);
  });

  it("gives depends_on_value precedence when both bounds are set", () => {
    const target = dependant({
      depends_on_value: "ha",
      depends_on_value_not: "ha",
    });

    expect(isEntryDisabled(target, [entry({ value: "ha" })])).toBe(false);
  });

  // the server may type a value differently than the entry declares its bound,
  // so both bounds compare loosely
  it("compares the bounds loosely across types", () => {
    expect(
      isEntryDisabled(dependant({ depends_on_value: 1 }), [
        entry({ value: "1" }),
      ]),
    ).toBe(false);
    expect(
      isEntryDisabled(dependant({ depends_on_value_not: 1 }), [
        entry({ value: "1" }),
      ]),
    ).toBe(true);
  });

  it("resolves the dependency by key rather than by position", () => {
    const target = dependant({ depends_on_value: "ha" });
    const form = [
      entry({ key: "decoy", value: "other" }),
      entry({ value: "ha" }),
    ];

    expect(isEntryDisabled(target, form)).toBe(false);
  });
});

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

describe("mergeActionEntries", () => {
  it("keeps the current value for an entry the action left unset", () => {
    const current = { engine: entry({ value: "current value" }) };
    const incoming = [entry({ read_only: true })];

    const merged = mergeActionEntries(current, incoming);

    expect(merged.engine.value).toBe("current value");
    expect(merged.engine.read_only).toBe(true);
  });

  it("keeps a falsy current value", () => {
    const current = {
      enabled: entry({ key: "enabled", type: ConfigEntryType.BOOLEAN }),
    };
    current.enabled.value = false;

    const merged = mergeActionEntries(current, [
      entry({ key: "enabled", type: ConfigEntryType.BOOLEAN }),
    ]);

    expect(merged.enabled.value).toBe(false);
  });

  it("takes the value the action did set", () => {
    const current = { engine: entry({ value: "current value" }) };
    const incoming = [entry({ value: "set by the action" })];

    const merged = mergeActionEntries(current, incoming);

    expect(merged.engine.value).toBe("set by the action");
  });

  it("adds an entry that only the action returned", () => {
    const merged = mergeActionEntries({}, [entry({ key: "fresh" })]);

    expect(merged.fresh.key).toBe("fresh");
  });

  it("drops an entry the action no longer returns", () => {
    const current = { stale: entry({ key: "stale" }) };

    expect(mergeActionEntries(current, [])).toEqual({});
  });

  it("does not mutate either input", () => {
    const current = { engine: entry({ value: "current value" }) };
    const incoming = [entry({ read_only: true })];
    const currentSnapshot = JSON.parse(JSON.stringify(current));
    const incomingSnapshot = JSON.parse(JSON.stringify(incoming));

    mergeActionEntries(current, incoming);

    expect(current).toEqual(currentSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });
});
