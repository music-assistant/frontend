import { getPlayerSetupLabel } from "@/helpers/player_config";
import { describe, expect, it } from "vitest";

describe("getPlayerSetupLabel", () => {
  it("uses the required setup state even without an optional setup flow", () => {
    expect(
      getPlayerSetupLabel({
        needs_setup: true,
      }),
    ).toBe("configure_player");
  });

  it("only offers optional reconfiguration when the player supports it", () => {
    expect(
      getPlayerSetupLabel({
        needs_setup: false,
        has_setup_flow: true,
      }),
    ).toBe("reconfigure_player");
    expect(
      getPlayerSetupLabel({
        needs_setup: false,
        has_setup_flow: false,
      }),
    ).toBeUndefined();
  });
});
