import { parseLrcLine } from "@/helpers/lrcParser";
import { describe, expect, it } from "vitest";

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

  it("handles large minute values", () => {
    const result = parseLrcLine("[10:05.50] Late in the song");
    expect(result).toEqual({ time: 605.5, text: "Late in the song" });
  });

  it("handles colon separator in fractional seconds", () => {
    const result = parseLrcLine("[00:29:79] Colon fraction");
    expect(result).toEqual({ time: 29.79, text: "Colon fraction" });
  });
});
