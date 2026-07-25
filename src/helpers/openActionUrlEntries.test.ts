import { describe, it, expect, vi, afterEach } from "vitest";
import { openActionUrlEntries } from "./utils";
import { type ConfigEntry, ConfigEntryType } from "@/plugins/api/interfaces";

const urlEntry = (value: unknown, key = "wizard"): ConfigEntry =>
  ({
    key,
    type: ConfigEntryType.URL,
    label: key,
    value,
  }) as ConfigEntry;

const stringEntry = (key = "server_url"): ConfigEntry =>
  ({
    key,
    type: ConfigEntryType.STRING,
    label: key,
    value: "abc",
  }) as ConfigEntry;

describe("openActionUrlEntries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens http(s) url entries via an anchor click and drops them", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const entries = [urlEntry("https://example.com/connect"), stringEntry()];
    const result = openActionUrlEntries(entries);
    expect(click).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("server_url");
  });

  it("never opens non-web schemes but still drops the entries", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const entries = [
      // eslint-disable-next-line no-script-url
      urlEntry("javascript:alert(1)", "xss"),
      urlEntry("data:text/html,hi", "data"),
      urlEntry("not a url at all", "junk"),
      urlEntry(1234, "notstring"),
      stringEntry(),
    ];
    const result = openActionUrlEntries(entries);
    expect(click).not.toHaveBeenCalled();
    // every URL-type entry is removed from the rendered form, opened or not
    expect(result.map((e) => e.key)).toEqual(["server_url"]);
  });

  it("falls back to default_value when value is unset", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const entry = {
      key: "wizard",
      type: ConfigEntryType.URL,
      label: "wizard",
      default_value: "https://example.com/from-default",
    } as ConfigEntry;
    const result = openActionUrlEntries([entry, stringEntry()]);
    expect(click).toHaveBeenCalledTimes(1);
    expect(result.map((e) => e.key)).toEqual(["server_url"]);
  });

  it("leaves entry lists without url entries untouched", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const entries = [stringEntry("a"), stringEntry("b")];
    expect(openActionUrlEntries(entries)).toEqual(entries);
    expect(click).not.toHaveBeenCalled();
  });
});
