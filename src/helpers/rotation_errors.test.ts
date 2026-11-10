import type { RotationStepError } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { errorTextAt, errorsAt } from "./rotation_errors";

function error(field: string | null, message = "wrong"): RotationStepError {
  return { step: 2, field, message };
}

describe("errorsAt", () => {
  it("matches the path itself and the paths inside it", () => {
    const errors = [
      error("conditions[0].field"),
      error("conditions[0]"),
      error("keys[0][1]"),
    ];
    expect(errorsAt(errors, "conditions[0]")).toHaveLength(2);
    expect(errorsAt(errors, "keys[0]")).toHaveLength(1);
  });

  it("does not match a path that only starts with the same text", () => {
    const errors = [error("conditions[10].op"), error("modes")];
    expect(errorsAt(errors, "conditions[1]")).toEqual([]);
    expect(errorsAt(errors, "mode")).toEqual([]);
  });

  it("does not match an outer path or an error without a field", () => {
    const errors = [error("conditions"), error(null)];
    expect(errorsAt(errors, "conditions[0]")).toEqual([]);
  });
});

describe("errorTextAt", () => {
  it("joins the messages of the matching errors", () => {
    const errors = [
      error("conditions[0].op", "Pick another operator."),
      error("conditions[0].value", "Pick a genre."),
      error("mode", "Unknown mode."),
    ];
    expect(errorTextAt(errors, "conditions[0]")).toBe(
      "Pick another operator.\nPick a genre.",
    );
  });

  it("returns undefined when nothing matches", () => {
    expect(errorTextAt([error("mode")], "match")).toBeUndefined();
    expect(errorTextAt(undefined, "match")).toBeUndefined();
  });
});
