import {
  ConfigEntryType,
  type ConfigEntry,
  type ConfigValueType,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  configFieldKind,
  configFieldOptions,
  findOptionByPrefix,
  isRequiredValueMissing,
  type ConfigFieldKind,
} from "./config_field";

function entry(overrides: Partial<ConfigEntry>): ConfigEntry {
  return {
    key: "output_codec",
    type: ConfigEntryType.STRING,
    category: "generic",
    default_value: null,
    label: "Codec",
    required: false,
    options: [],
    value: null,
    ...overrides,
  };
}

const OPTIONS = [
  { title: "FLAC", value: "flac" },
  { title: "MP3", value: "mp3" },
];

const KINDS: [string, Partial<ConfigEntry>, ConfigFieldKind][] = [
  [
    "a ranged number",
    { type: ConfigEntryType.INTEGER, range: [0, 10] },
    "slider",
  ],
  ["options", { options: OPTIONS }, "select"],
  [
    "expanded options",
    { options: OPTIONS, expanded_options: true },
    "expanded_options",
  ],
  [
    "expanded multi options",
    { options: OPTIONS, expanded_options: true, multi_value: true },
    "select",
  ],
  ["a list of strings", { multi_value: true }, "string_list"],
  ["a string waiting on its action", { action: "authenticate" }, "action"],
];

const REQUIRED_VALUES: [ConfigFieldKind, ConfigValueType, boolean][] = [
  ["text", "", true],
  ["text", null, true],
  ["number", 0, false],
  ["select", null, true],
  ["string_list", [], false],
  ["boolean", null, false],
];

describe("configFieldKind", () => {
  it.each(KINDS)("shows %s as %s", (_name, overrides, kind) => {
    expect(configFieldKind(entry(overrides))).toBe(kind);
  });

  it("gives only the Home Assistant provider its control picker", () => {
    const controls = entry({ key: "power_controls", options: OPTIONS });

    expect(configFieldKind(controls, "hass")).toBe("hass_controls");
    expect(configFieldKind(controls, "snapcast")).toBe("select");
  });
});

describe("isRequiredValueMissing", () => {
  it.each(REQUIRED_VALUES)(
    "checks a required %s holding %j",
    (kind, value, missing) => {
      expect(isRequiredValueMissing({ required: true, value }, kind)).toBe(
        missing,
      );
    },
  );

  it("never flags an optional entry", () => {
    expect(isRequiredValueMissing({ required: false, value: "" }, "text")).toBe(
      false,
    );
  });
});

describe("configFieldOptions", () => {
  it("marks the default and lists a value the options do not hold", () => {
    const options = configFieldOptions(
      entry({ options: OPTIONS, default_value: "flac", value: "opus" }),
      "default",
    );

    expect(options.map((option) => option.title)).toEqual([
      "FLAC [default]",
      "MP3",
      "opus",
    ]);
  });
});

describe("findOptionByPrefix", () => {
  it("picks the first enabled option starting with what was typed", () => {
    const options = [
      { title: "Mono", value: "mono", disabled: true },
      { title: "Multi", value: "multi" },
      { title: "Stereo", value: "stereo" },
    ];

    expect(findOptionByPrefix(options, "m")?.value).toBe("multi");
    expect(findOptionByPrefix(options, "ST")?.value).toBe("stereo");
    expect(findOptionByPrefix(options, "x")).toBeUndefined();
  });
});
