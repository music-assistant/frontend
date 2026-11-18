import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/plugins/api";
import type { RotationStep } from "@/plugins/api/interfaces";

const steps: RotationStep[] = [
  { type: "source", media_type: "artist", from: "library" },
  {
    type: "filter",
    mode: "keep",
    match: "all",
    conditions: [{ field: "name", op: "contains", value: "Die drei ???" }],
  },
  { type: "sort", keys: [{ field: "name", descending: false }] },
  { type: "limit", count: 5, minutes: null },
  { type: "expand", to: "album", scope: "library" },
  { type: "flatten" },
];

describe("rotation API", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(api, "sendCommand").mockResolvedValue(undefined as never);
  });

  it("creates a rotation", async () => {
    await api.createRotation("Hörspiele", steps);
    expect(spy).toHaveBeenCalledWith("rotations/create", {
      name: "Hörspiele",
      steps,
    });
  });

  it("updates with all fields", async () => {
    await api.updateRotation("u", "Neu", steps);
    expect(spy).toHaveBeenCalledWith("rotations/update", {
      rotation_id: "u",
      name: "Neu",
      steps,
    });
  });

  it("updates without a name key when the name is undefined", async () => {
    await api.updateRotation("u", undefined, steps);
    const args = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(spy.mock.calls[0][0]).toBe("rotations/update");
    expect(args).toEqual({ rotation_id: "u", steps });
    expect("name" in args).toBe(false);
  });

  it("updates without a steps key when the steps are undefined", async () => {
    await api.updateRotation("u", "Neu");
    const args = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(args).toEqual({ rotation_id: "u", name: "Neu" });
    expect("steps" in args).toBe(false);
  });

  it("deletes, gets, lists and resets", async () => {
    await api.deleteRotation("u");
    await api.getRotation("u");
    await api.listRotations();
    await api.resetRotationRound("u");
    expect(spy.mock.calls).toEqual([
      ["rotations/delete", { rotation_id: "u" }],
      ["rotations/get", { rotation_id: "u" }],
      ["rotations/list"],
      ["rotations/reset_round", { rotation_id: "u" }],
    ]);
  });

  it("validates and explains", async () => {
    await api.validateRotation(steps);
    await api.explainRotation(steps);
    expect(spy.mock.calls).toEqual([
      ["rotations/validate", { steps }],
      ["rotations/explain", { steps }],
    ]);
  });

  it("previews with snake_case keys", async () => {
    await api.previewRotation(steps, 20, true, 7);
    expect(spy).toHaveBeenCalledWith("rotations/preview", {
      steps,
      limit: 20,
      include_removed: true,
      seed: 7,
    });
  });

  it("previews with defaults and no seed key", async () => {
    await api.previewRotation(steps, 20);
    const args = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(args).toEqual({ steps, limit: 20, include_removed: false });
    expect("seed" in args).toBe(false);
  });

  it("describes steps with and without a media type", async () => {
    await api.describeRotationSteps("album");
    await api.describeRotationSteps();
    expect(spy.mock.calls[0]).toEqual([
      "rotations/describe_steps",
      { media_type: "album" },
    ]);
    expect(spy.mock.calls[1]).toEqual(["rotations/describe_steps", {}]);
  });

  it("fetches the recipes", async () => {
    await api.getRotationRecipes();
    expect(spy).toHaveBeenCalledWith("rotations/recipes");
  });
});
