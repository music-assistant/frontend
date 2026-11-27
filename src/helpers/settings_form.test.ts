import {
  ConfigEntryType,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  buildLogLevelForm,
  buildSettingsForm,
  changedValuesByOwner,
  storedValues,
} from "./settings_form";
import { coreOwner } from "./settings_pages";

const STREAMS = coreOwner("streams");
const TASKS = coreOwner("tasks");
const QUEUES = coreOwner("player_queues");

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

// the text of a translation key, as the form gets it
const translate = (key: string) => `text of ${key}`;

describe("buildSettingsForm", () => {
  it("takes the entries a single source shows, as they are", () => {
    const concurrency = entry("background_scan_concurrency", "audio_analysis");
    const logLevel = entry("smart_fades_log_level", "audio_analysis");

    const form = buildSettingsForm(
      [
        {
          source: { owner: STREAMS, categories: ["audio_analysis"] },
          entries: [concurrency, entry("fade_in", "playback"), logLevel],
        },
      ],
      translate,
    );

    expect(form.entries).toEqual([concurrency, logLevel]);
    expect(Object.fromEntries(form.fields)).toEqual({
      background_scan_concurrency: {
        owner: STREAMS,
        key: "background_scan_concurrency",
      },
      smart_fades_log_level: { owner: STREAMS, key: "smart_fades_log_level" },
    });
  });

  it("shows each of several sources as a section of its own, under its title", () => {
    const form = buildSettingsForm(
      [
        {
          source: { owner: STREAMS, categories: ["generic"], title: "audio" },
          entries: [entry("bind_port"), entry("fade_in", "playback")],
        },
        {
          source: { owner: TASKS, title: "tasks" },
          entries: [entry("max_concurrent_tasks", "advanced")],
        },
      ],
      translate,
    );

    expect(
      form.entries.map(({ key, category, category_label }) => ({
        key,
        category,
        category_label,
      })),
    ).toEqual([
      {
        key: "core/streams/bind_port",
        category: "core/streams",
        category_label: "text of audio",
      },
      {
        key: "core/tasks/max_concurrent_tasks",
        category: "core/tasks",
        category_label: "text of tasks",
      },
    ]);
  });

  it("shows the entries of sources without a title under their categories, which owners share", () => {
    const form = buildSettingsForm(
      [
        {
          source: { owner: QUEUES },
          entries: [
            entry("crossfade_mode", "crossfade", {
              category_label: "Crossfade",
            }),
            entry("pause_timeout", "playback", {
              category_label: "Queue Playback",
            }),
          ],
        },
        {
          source: { owner: STREAMS, categories: ["crossfade"] },
          entries: [
            entry("allow_crossfade_same_album", "crossfade", {
              category_label: "Crossfade",
            }),
            entry("bind_port"),
          ],
        },
      ],
      translate,
    );

    expect(
      form.entries.map(({ key, category, category_label }) => ({
        key,
        category,
        category_label,
      })),
    ).toEqual([
      {
        key: "core/player_queues/crossfade_mode",
        category: "crossfade",
        category_label: "Crossfade",
      },
      {
        key: "core/player_queues/pause_timeout",
        category: "playback",
        category_label: "Queue Playback",
      },
      {
        key: "core/streams/allow_crossfade_same_album",
        category: "crossfade",
        category_label: "Crossfade",
      },
    ]);
  });

  it("keeps the entries of owners sharing a key apart", () => {
    const form = buildSettingsForm(
      [
        { source: { owner: STREAMS }, entries: [entry("bind_port")] },
        { source: { owner: TASKS }, entries: [entry("bind_port")] },
      ],
      translate,
    );

    expect(Object.fromEntries(form.fields)).toEqual({
      "core/streams/bind_port": { owner: STREAMS, key: "bind_port" },
      "core/tasks/bind_port": { owner: TASKS, key: "bind_port" },
    });
  });

  it("points dependencies and actions at the entries of their own owner", () => {
    const form = buildSettingsForm(
      [
        {
          source: { owner: STREAMS },
          entries: [
            entry("enable_ssl"),
            entry("verify_ssl", "generic", {
              depends_on: "enable_ssl",
              action: "verify_ssl",
            }),
          ],
        },
        { source: { owner: TASKS }, entries: [entry("enable_ssl")] },
      ],
      translate,
    );

    expect(form.entries[1]).toMatchObject({
      key: "core/streams/verify_ssl",
      depends_on: "core/streams/enable_ssl",
      action: "core/streams/verify_ssl",
    });
  });

  it("leaves out the log level of every source", () => {
    const form = buildSettingsForm(
      [
        {
          source: { owner: TASKS },
          entries: [entry("max_concurrent_tasks"), entry("log_level")],
        },
      ],
      translate,
    );

    expect(form.entries.map((e) => e.key)).toEqual(["max_concurrent_tasks"]);
  });

  it("leaves the loaded entries as they are", () => {
    const bindPort = entry("bind_port");

    buildSettingsForm(
      [
        { source: { owner: STREAMS }, entries: [bindPort] },
        { source: { owner: TASKS }, entries: [] },
      ],
      translate,
    );

    expect(bindPort).toEqual(entry("bind_port"));
  });
});

describe("buildLogLevelForm", () => {
  const MODULE_NAMES: Record<string, string> = {
    streams: "Streams",
    tasks: "Background tasks",
    cache: "Cache",
  };
  const moduleName = (domain: string) => MODULE_NAMES[domain];

  function moduleConfig(domain: string, entries: ConfigEntry[]): CoreConfig {
    return {
      domain,
      last_error: null,
      values: Object.fromEntries(entries.map((e) => [e.key, e])),
    };
  }

  function logLevel(value: string): ConfigEntry {
    return entry("log_level", "generic", {
      type: ConfigEntryType.STRING,
      default_value: "GLOBAL",
      description: "Set the log verbosity for this provider.",
      advanced: true,
      value,
    });
  }

  it("shows the log level of each module under the name of the module, by name", () => {
    const form = buildLogLevelForm(
      [
        moduleConfig("streams", [entry("bind_port"), logLevel("DEBUG")]),
        moduleConfig("tasks", [logLevel("GLOBAL")]),
        moduleConfig("cache", [logLevel("INFO")]),
      ],
      moduleName,
      "Log levels",
    );

    expect(
      form.entries.map(({ key, label, value }) => ({ key, label, value })),
    ).toEqual([
      {
        key: "core/tasks/log_level",
        label: "Background tasks",
        value: "GLOBAL",
      },
      { key: "core/cache/log_level", label: "Cache", value: "INFO" },
      { key: "core/streams/log_level", label: "Streams", value: "DEBUG" },
    ]);
    expect(Object.fromEntries(form.fields)).toEqual({
      "core/tasks/log_level": { owner: TASKS, key: "log_level" },
      "core/cache/log_level": { owner: coreOwner("cache"), key: "log_level" },
      "core/streams/log_level": { owner: STREAMS, key: "log_level" },
    });
  });

  it("puts every log level in one section, without the description of a single module, in view without the advanced settings", () => {
    const form = buildLogLevelForm(
      [moduleConfig("streams", [logLevel("DEBUG")])],
      moduleName,
      "Log levels",
    );

    expect(form.entries[0]).toMatchObject({
      category: "log_levels",
      category_label: "Log levels",
      description: null,
      advanced: false,
      default_value: "GLOBAL",
    });
  });

  it("leaves out a module without a log level", () => {
    const form = buildLogLevelForm(
      [moduleConfig("streams", [entry("bind_port")])],
      moduleName,
      "Log levels",
    );

    expect(form.entries).toEqual([]);
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
  const fields = new Map([
    ["concurrency", { owner: STREAMS, key: "concurrency" }],
    ["codecs", { owner: STREAMS, key: "codecs" }],
    ["max_tasks", { owner: TASKS, key: "max_tasks" }],
  ]);
  const saved = { concurrency: 2, codecs: ["flac", "mp3"], max_tasks: 4 };

  it("groups the changed values per owner", () => {
    expect(
      changedValuesByOwner(
        { concurrency: 3, codecs: ["flac", "mp3"], max_tasks: 5 },
        saved,
        fields,
      ),
    ).toEqual([
      { owner: STREAMS, values: { concurrency: 3 } },
      { owner: TASKS, values: { max_tasks: 5 } },
    ]);
  });

  it("keys the values the way their owner knows them", () => {
    const qualified = new Map([
      ["core/streams/log_level", { owner: STREAMS, key: "log_level" }],
      ["core/tasks/log_level", { owner: TASKS, key: "log_level" }],
    ]);

    expect(
      changedValuesByOwner(
        { "core/streams/log_level": "DEBUG", "core/tasks/log_level": "INFO" },
        { "core/streams/log_level": "GLOBAL", "core/tasks/log_level": "INFO" },
        qualified,
      ),
    ).toEqual([{ owner: STREAMS, values: { log_level: "DEBUG" } }]);
  });

  it("compares lists by their content", () => {
    expect(
      changedValuesByOwner({ codecs: ["flac", "mp3"] }, saved, fields),
    ).toEqual([]);
    expect(changedValuesByOwner({ codecs: ["flac"] }, saved, fields)).toEqual([
      { owner: STREAMS, values: { codecs: ["flac"] } },
    ]);
  });

  it("counts a reset to the default as a change", () => {
    expect(changedValuesByOwner({ max_tasks: null }, saved, fields)).toEqual([
      { owner: TASKS, values: { max_tasks: null } },
    ]);
  });

  it("ignores keys outside the form", () => {
    expect(changedValuesByOwner({ bind_port: 8097 }, saved, fields)).toEqual(
      [],
    );
  });

  it("finds nothing when nothing changed", () => {
    expect(changedValuesByOwner({ ...saved }, saved, fields)).toEqual([]);
  });
});
