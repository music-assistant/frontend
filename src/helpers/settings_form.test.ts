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
        { source: { owner: STREAMS }, entries: [entry("log_level")] },
        { source: { owner: TASKS }, entries: [entry("log_level")] },
      ],
      translate,
    );

    expect(Object.fromEntries(form.fields)).toEqual({
      "core/streams/log_level": { owner: STREAMS, key: "log_level" },
      "core/tasks/log_level": { owner: TASKS, key: "log_level" },
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
