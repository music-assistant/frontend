import {
  subscribeToHAProperties,
  unsubscribeFromHAProperties,
} from "@/plugins/homeassistant";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INSET_PROPERTIES = ["top", "right", "bottom", "left"].map(
  (edge) => `--device-inset-${edge}`,
);

const PHONE_INSETS = {
  top: "59px",
  right: "0px",
  bottom: "34px",
  left: "0px",
};

// The inline values are the whole point of the exchange: they are what outranks
// the zeroed tokens an embedded layout gets, so read them off the element rather
// than through getComputedStyle.
function readInsets() {
  return INSET_PROPERTIES.map((property) =>
    document.documentElement.style.getPropertyValue(property),
  );
}

function reportProperties(data: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "home-assistant/properties", narrow: false, ...data },
    }),
  );
}

describe("Home Assistant safe area", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    // Also resets the module singleton and the tokens for the next test.
    unsubscribeFromHAProperties();
    postMessage.mockRestore();
  });

  it("asks Home Assistant to hand its safe area padding over", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "home-assistant/subscribe-properties",
        handleSafeArea: true,
        kioskMode: false,
      }),
      "*",
    );
  });

  it("applies the insets Home Assistant reports", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    reportProperties({ safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["59px", "0px", "34px", "0px"]);
  });

  it("writes nothing when Home Assistant reports no safe area", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    // Home Assistant older than the safe-area handover sends the same message
    // without the field, and is still padding the iframe itself.
    reportProperties({ narrow: true });

    expect(readInsets()).toEqual(["", "", "", ""]);
  });

  it("keeps the reported insets when a later update leaves them out", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    reportProperties({ safeAreaInsets: PHONE_INSETS });
    reportProperties({ narrow: true });

    expect(readInsets()).toEqual(["59px", "0px", "34px", "0px"]);
  });

  it("ignores the reported insets when it did not ask to handle them", () => {
    // Home Assistant reports the insets either way but only drops its own
    // padding when asked, so acting on them here would reserve the space twice.
    subscribeToHAProperties();

    reportProperties({ safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["", "", "", ""]);
  });

  it("hands an edge back to the stylesheet when Home Assistant reports none", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    reportProperties({
      safeAreaInsets: { top: "59px", right: "", bottom: "34px", left: "" },
    });

    expect(readInsets()).toEqual(["59px", "", "34px", ""]);
  });

  it("hands the safe area back on unsubscribe", () => {
    subscribeToHAProperties({ handleSafeArea: true });
    reportProperties({ safeAreaInsets: PHONE_INSETS });

    unsubscribeFromHAProperties();

    expect(readInsets()).toEqual(["", "", "", ""]);
  });

  it("stops following Home Assistant after unsubscribing", () => {
    subscribeToHAProperties({ handleSafeArea: true });
    unsubscribeFromHAProperties();

    reportProperties({ safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["", "", "", ""]);
  });
});
