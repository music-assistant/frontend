import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  buildSettingsForm,
  changedValuesByOwner,
  storedValues,
} from "./settings_form";
import { coreOwner } from "./settings_pages";

const STREAMS = coreOwner("streams");
const TASKS = coreOwner("tasks");

function entry(
  key: string,
  category = "generic",
  overrides: Partial<ConfigEntry> = {},
): ConfigEntry {
  return {
    key,
    category,
    type: ConfigEntryType.INTEGER,
    label: key,
    default_value: null,
    required: false,
    options: [],
    ...overrides,
  };
}

describe("buildSettingsForm", () => {
  it("takes the entries each source shows, in their order", () => {
    const concurrency = entry("background_scan_concurrency", "audio_analysis");
    const logLevel = entry("smart_fades_log_level", "audio_analysis");
    const maxTasks = entry("max_concurrent_tasks", "advanced");

    const form = buildSettingsForm([
      {
        source: { owner: STREAMS, categories: ["audio_analysis"] },
        entries: [concurrency, entry("fade_in", "playback"), logLevel],
      },
      { source: { owner: TASKS }, entries: [maxTasks] },
    ]);

    expect(form.entries).toEqual([concurrency, logLevel, maxTasks]);
    expect(form.entries[0]).toBe(concurrency);
    expect(Object.fromEntries(form.owners)).toEqual({
      background_scan_concurrency: STREAMS,
      smart_fades_log_level: STREAMS,
      max_concurrent_tasks: TASKS,
    });
  });

  it("throws when two owners feed the same key", () => {
    expect(() =>
      buildSettingsForm([
        { source: { owner: STREAMS }, entries: [entry("log_level")] },
        { source: { owner: TASKS }, entries: [entry("log_level")] },
      ]),
    ).toThrow("log_level");
  });
});

describe("storedValues", () => {
  it("takes the value, else the default, else null", () => {
    expect(
      storedValues([
        entry("own", "generic", { value: 2, default_value: 1 }),
        entry("default", "generic", { default_value: 1 }),
        entry("none"),
        entry("off", "generic", { value: false, default_value: true }),
      ]),
    ).toEqual({ own: 2, default: 1, none: null, off: false });
  });
});

describe("changedValuesByOwner", () => {
  const owners = new Map([
    ["concurrency", STREAMS],
    ["codecs", STREAMS],
    ["max_tasks", TASKS],
  ]);
  const saved = { concurrency: 2, codecs: ["flac", "mp3"], max_tasks: 4 };

  it("groups the changed values per owner", () => {
    expect(
      changedValuesByOwner(
        { concurrency: 3, codecs: ["flac", "mp3"], max_tasks: 5 },
        saved,
        owners,
      ),
    ).toEqual([
      { owner: STREAMS, values: { concurrency: 3 } },
      { owner: TASKS, values: { max_tasks: 5 } },
    ]);
  });

  it("compares lists by their content", () => {
    expect(
      changedValuesByOwner({ codecs: ["flac", "mp3"] }, saved, owners),
    ).toEqual([]);
    expect(changedValuesByOwner({ codecs: ["flac"] }, saved, owners)).toEqual([
      { owner: STREAMS, values: { codecs: ["flac"] } },
    ]);
  });

  it("counts a reset to the default as a change", () => {
    expect(changedValuesByOwner({ max_tasks: null }, saved, owners)).toEqual([
      { owner: TASKS, values: { max_tasks: null } },
    ]);
  });

  it("ignores keys outside the form", () => {
    expect(changedValuesByOwner({ bind_port: 8097 }, saved, owners)).toEqual(
      [],
    );
  });

  it("finds nothing when nothing changed", () => {
    expect(changedValuesByOwner({ ...saved }, saved, owners)).toEqual([]);
  });
});
