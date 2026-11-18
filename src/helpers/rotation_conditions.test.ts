import type {
  RotationDescribe,
  RotationFieldInfo,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  conditionFields,
  defaultConditionValue,
  newCondition,
  sortFields,
  withOperator,
} from "./rotation_conditions";

const DESCRIBE = {
  step_types: [],
  providers: [],
  media_types: {
    track: {
      fields: [
        {
          name: "title",
          type: "text",
          label: "Title",
          operators: ["contains", "is"],
          sortable: true,
        },
        {
          name: "play_count",
          type: "number",
          label: "Play count",
          operators: [],
          sortable: true,
        },
      ],
      sort_keys: ["random", "title", "play_count"],
    },
  },
} as unknown as RotationDescribe;

describe("rotation_conditions", () => {
  it("offers sort-only fields in orders but not in conditions", () => {
    expect(conditionFields("track", DESCRIBE).map((f) => f.name)).toEqual([
      "title",
    ]);
    expect(sortFields("track", DESCRIBE).map((f) => f.name)).toEqual([
      "random",
      "title",
      "play_count",
    ]);
  });

  it("builds empty values by type and operator", () => {
    expect(defaultConditionValue("text", "contains")).toBe("");
    expect(defaultConditionValue("number", "between")).toEqual([0, 0]);
    expect(defaultConditionValue("date", "in_last_days")).toBe(30);
    expect(defaultConditionValue("ref", "is")).toBeNull();
    expect(defaultConditionValue("ref", "one_of")).toBeNull();
    expect(defaultConditionValue("bool", "is")).toBe(true);
  });

  it("starts a condition with the first operator", () => {
    const field = conditionFields("track", DESCRIBE)[0]!;
    expect(newCondition(field)).toEqual({
      field: "title",
      op: "contains",
      value: "",
    });
  });

  it("keeps the value on a compatible operator and resets it otherwise", () => {
    const field = conditionFields("track", DESCRIBE)[0]!;
    const base = { field: "title", op: "contains", value: "Teil" };
    expect(withOperator(base, field, "is").value).toBe("Teil");
    expect(withOperator(base, field, "between").value).toEqual([0, 0]);
  });

  it("types a text for a reference field with a text operator", () => {
    for (const op of ["contains", "not_contains", "starts_with", "ends_with"]) {
      expect(defaultConditionValue("ref", op)).toBe("");
    }
    expect(defaultConditionValue("ref", "is_not")).toBeNull();
  });

  it("resets a reference value when switching between picker and text", () => {
    const artist = {
      name: "artist",
      type: "ref",
      label: "Artist",
      operators: ["is", "is_not", "one_of", "contains", "starts_with"],
      sortable: true,
    } as unknown as RotationFieldInfo;
    const picked = { field: "artist", op: "is", value: "library://artist/1" };
    expect(withOperator(picked, artist, "contains")).toEqual({
      field: "artist",
      op: "contains",
      value: "",
    });
    const typed = { field: "artist", op: "contains", value: "Fuchsbande" };
    expect(withOperator(typed, artist, "starts_with").value).toBe("Fuchsbande");
    expect(withOperator(typed, artist, "is").value).toBeNull();
    expect(withOperator(picked, artist, "is_not").value).toBe(
      "library://artist/1",
    );
  });
});
