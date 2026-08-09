import { describe, it, expect, vi, afterEach } from "vitest";
import { isWebUrl, openActionResultUrl, openActionUrlEntries } from "./utils";
import {
  type ConfigEntry,
  ConfigEntryType,
  type ConfigValueType,
} from "@/plugins/api/interfaces";

const urlEntry = (value: ConfigValueType, key = "wizard"): ConfigEntry => ({
  key,
  type: ConfigEntryType.URL,
  label: key,
  category: "generic",
  default_value: null,
  options: [],
  required: false,
  value,
});

const stringEntry = (key = "server_url"): ConfigEntry => ({
  key,
  type: ConfigEntryType.STRING,
  label: key,
  category: "generic",
  default_value: null,
  options: [],
  required: false,
  value: "abc",
});

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
    const entry: ConfigEntry = {
      ...urlEntry(null),
      default_value: "https://example.com/from-default",
    };
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

describe("isWebUrl", () => {
  it.each([
    ["https://example.com", true],
    ["http://192.168.1.10:8095", true],
    ["javascript:alert(1)", false],
    ["data:text/html,hi", false],
    ["not a url", false],
    [undefined, false],
  ])("validates %s as %s", (url, expected) => {
    expect(isWebUrl(url)).toBe(expected);
  });
});

describe("openActionResultUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a web url via an anchor click", () => {
    const anchors: HTMLAnchorElement[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        anchors.push(this);
      });
    openActionResultUrl("https://example.com/mcp");
    expect(click).toHaveBeenCalledTimes(1);
    expect(anchors[0].getAttribute("href")).toBe("https://example.com/mcp");
    expect(anchors[0].getAttribute("target")).toBe("_blank");
    expect(anchors[0].getAttribute("rel")).toBe("noopener");
    // the anchor is detached again once clicked
    expect(anchors[0].isConnected).toBe(false);
  });

  it("opens a plain http url", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    openActionResultUrl("http://192.168.1.10:8095/mcp");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("never opens non-web schemes or unparseable urls", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    openActionResultUrl("javascript:alert(1)");
    openActionResultUrl("file:///etc/passwd");
    openActionResultUrl("data:text/html,hi");
    openActionResultUrl("not a url at all");
    expect(click).not.toHaveBeenCalled();
  });

  it("is a no-op without a url", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    openActionResultUrl(null);
    openActionResultUrl(undefined);
    openActionResultUrl("");
    expect(click).not.toHaveBeenCalled();
  });
});
