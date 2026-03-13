import {
  parseLrcLine,
  parseTimestamp,
  parseWordTimestamps,
} from "@/helpers/lrcParser";
import { describe, expect, it } from "vitest";

describe("parseTimestamp", () => {
  it("parses minutes and seconds", () => {
    expect(parseTimestamp("1", "30")).toBe(90);
  });

  it("parses with fractional seconds (dot separator)", () => {
    expect(parseTimestamp("0", "29", ".79")).toBe(29.79);
  });

  it("parses with fractional seconds (colon separator)", () => {
    expect(parseTimestamp("0", "29", ":79")).toBe(29.79);
  });

  it("parses zero timestamp", () => {
    expect(parseTimestamp("0", "0")).toBe(0);
  });

  it("handles large minute values", () => {
    expect(parseTimestamp("10", "5", ".50")).toBe(605.5);
  });
});

describe("parseWordTimestamps", () => {
  it("returns undefined for plain text", () => {
    expect(parseWordTimestamps("Hello world")).toBeUndefined();
  });

  it("parses Enhanced LRC word timestamps", () => {
    const text = "<00:00.04> Hello <00:00.50> world";
    const result = parseWordTimestamps(text);
    expect(result).toEqual([
      { time: 0.04, text: "Hello" },
      { time: 0.5, text: "world" },
    ]);
  });

  it("skips empty words", () => {
    const text = "<00:01.00>  <00:02.00> word";
    const result = parseWordTimestamps(text);
    expect(result).toEqual([{ time: 2, text: "word" }]);
  });
});

describe("parseLrcLine", () => {
  it("parses a standard LRC line", () => {
    const result = parseLrcLine("[00:29.79]Some lyric text");
    expect(result).toEqual({ time: 29.79, text: "Some lyric text" });
  });

  it("parses LRC line with leading space", () => {
    const result = parseLrcLine("[01:05.00] Hello there");
    expect(result).toEqual({ time: 65, text: "Hello there" });
  });

  it("returns space for empty timestamped line", () => {
    const result = parseLrcLine("[02:00.00]");
    expect(result).toEqual({ time: 120, text: " " });
  });

  it("parses line without timestamp", () => {
    const result = parseLrcLine("Plain text line");
    expect(result).toEqual({ time: 0, text: "Plain text line" });
  });

  it("returns space for empty non-timestamped line", () => {
    const result = parseLrcLine("   ");
    expect(result).toEqual({ time: 0, text: " " });
  });

  it("parses Enhanced LRC with word timestamps", () => {
    const result = parseLrcLine("[00:05.00]<00:05.00> Hello <00:05.50> world");
    expect(result.time).toBe(5);
    expect(result.text).toBe("Hello world");
    expect(result.words).toEqual([
      { time: 5, text: "Hello" },
      { time: 5.5, text: "world" },
    ]);
  });
});
