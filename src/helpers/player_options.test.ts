import { PlayerOption, PlayerOptionType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  formatPlayerOptionValue,
  getPlayerOptionControl,
  parsePlayerOptionInput,
  sortPlayerOptions,
} from "./player_options";

const makeOption = (overrides: Partial<PlayerOption>): PlayerOption => ({
  key: "option_1",
  name: "Option 1",
  type: PlayerOptionType.STRING,
  translation_key: "option_1",
  value: "",
  read_only: false,
  min_value: null,
  max_value: null,
  step: null,
  options: null,
  ...overrides,
});

const ENTRIES = [
  { key: "low", name: "Low", type: PlayerOptionType.INTEGER, value: 0 },
  { key: "high", name: "High", type: PlayerOptionType.INTEGER, value: 1 },
];

describe("getPlayerOptionControl", () => {
  it.each([
    {
      option: { options: ENTRIES, type: PlayerOptionType.INTEGER },
      control: "select",
    },
    {
      option: { type: PlayerOptionType.BOOLEAN, value: true },
      control: "switch",
    },
    // 0 is falsy, but a valid min_value
    {
      option: {
        type: PlayerOptionType.INTEGER,
        min_value: 0,
        max_value: 10,
        step: 1,
      },
      control: "slider",
    },
    {
      option: { type: PlayerOptionType.FLOAT, min_value: 0 },
      control: "number",
    },
    { option: { type: PlayerOptionType.STRING }, control: "text" },
  ])("gives $control", ({ option, control }) => {
    expect(getPlayerOptionControl(makeOption(option))).toBe(control);
  });
});

describe("sortPlayerOptions", () => {
  it("groups by control, then sorts by name", () => {
    const options = [
      makeOption({ key: "text_b", name: "B" }),
      makeOption({ key: "select", name: "A", options: ENTRIES }),
      makeOption({ key: "text_a", name: "A" }),
      makeOption({ key: "switch", name: "Z", type: PlayerOptionType.BOOLEAN }),
    ];

    expect(sortPlayerOptions(options).map((x) => x.key)).toEqual([
      "switch",
      "text_a",
      "text_b",
      "select",
    ]);
  });
});

describe("parsePlayerOptionInput", () => {
  const integer = makeOption({
    type: PlayerOptionType.INTEGER,
    value: 5,
    min_value: 0,
    max_value: 10,
  });

  it.each([
    { option: integer, input: "7", value: 7 },
    { option: integer, input: "6.6", value: 7 },
    { option: integer, input: "42", value: 10 },
    { option: integer, input: "-1", value: 0 },
    { option: integer, input: "5", value: undefined },
    { option: integer, input: "", value: undefined },
    { option: integer, input: "abc", value: undefined },
    {
      option: makeOption({ type: PlayerOptionType.FLOAT, value: 1 }),
      input: "1.5",
      value: 1.5,
    },
    {
      option: makeOption({ value: "name" }),
      input: "new name",
      value: "new name",
    },
    { option: makeOption({ value: "name" }), input: "name", value: undefined },
  ])("parses '$input' to $value", ({ option, input, value }) => {
    expect(parsePlayerOptionInput(option, input)).toBe(value);
  });
});

describe("formatPlayerOptionValue", () => {
  it.each([
    { option: makeOption({ options: ENTRIES, value: 1 }), text: "High" },
    { option: makeOption({ value: "idle" }), text: "idle" },
    {
      option: makeOption({ type: PlayerOptionType.FLOAT, value: 2.5 }),
      text: "2.5",
    },
  ])("shows $text", ({ option, text }) => {
    expect(formatPlayerOptionValue(option)).toBe(text);
  });
});
