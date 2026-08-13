import { HA_KIOSK_MODE, saveDeviceSetting } from "@/helpers/device_settings";
import {
  haState,
  subscribeToHAProperties,
  unsubscribeFromHAProperties,
} from "@/plugins/homeassistant";
import type { Router } from "vue-router";
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

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

// Home Assistant posts to the frame it embeds us in, which is what puts itself
// on the event as the source.
function reportProperties(
  data: Record<string, unknown>,
  source: MessageEventSource | null = window.parent,
) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "home-assistant/properties", narrow: false, ...data },
      source,
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
    document.querySelector("[data-foreign-frame]")?.remove();
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

  it("leaves the top inset to the header Home Assistant shows when narrow", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    // That header is as tall as the top inset and sits above the frame, so
    // taking the inset as well would push the app down a second time.
    reportProperties({ narrow: true, safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["", "0px", "34px", "0px"]);
  });

  it("claims the top inset back from a narrow host in kiosk mode", () => {
    subscribeToHAProperties({ handleSafeArea: true, kioskMode: true });

    // Kiosk mode drops that header, so nothing else is covering the notch.
    reportProperties({ narrow: true, safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["59px", "0px", "34px", "0px"]);
  });

  it("drops the top inset again once Home Assistant shows its header", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    reportProperties({ safeAreaInsets: PHONE_INSETS });
    reportProperties({ narrow: true, safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["", "0px", "34px", "0px"]);
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
    reportProperties({});

    expect(readInsets()).toEqual(["59px", "0px", "34px", "0px"]);
  });

  it("gives the top inset up for a header that appears without new insets", () => {
    subscribeToHAProperties({ handleSafeArea: true });

    reportProperties({ safeAreaInsets: PHONE_INSETS });
    // Whether the update repeats the insets says nothing about who owns them:
    // the header Home Assistant just put up is taking the top one either way.
    reportProperties({ narrow: true });

    expect(readInsets()).toEqual(["", "0px", "34px", "0px"]);
  });

  it("ignores the reported insets when it did not ask to handle them", () => {
    // Home Assistant reports the insets either way but only drops its own
    // padding when asked, so acting on them here would reserve the space twice.
    subscribeToHAProperties();

    reportProperties({ safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["", "", "", ""]);
  });

  it("ignores properties from anything but the frame it is embedded in", () => {
    subscribeToHAProperties({ handleSafeArea: true });
    const foreignFrame = document.createElement("iframe");
    foreignFrame.dataset.foreignFrame = "";
    document.body.appendChild(foreignFrame);
    expect(foreignFrame.contentWindow).toBeTruthy();
    expect(foreignFrame.contentWindow).not.toBe(window.parent);

    reportProperties(
      { safeAreaInsets: PHONE_INSETS },
      foreignFrame.contentWindow,
    );

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

describe("Home Assistant kiosk mode", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
    postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    unsubscribeFromHAProperties();
    postMessage.mockRestore();
    vi.unstubAllGlobals();
  });

  it("asks Home Assistant to give up its own chrome", () => {
    subscribeToHAProperties({ handleSafeArea: true, kioskMode: true });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "home-assistant/subscribe-properties",
        kioskMode: true,
      }),
      "*",
    );
  });

  it("keeps handling the safe area when the preference turns kiosk mode off", () => {
    subscribeToHAProperties({ handleSafeArea: true, kioskMode: true });

    // Home Assistant only ever turns kiosk mode on from a subscription, so
    // leaving it takes an unsubscribe - which hands the safe area back too
    // unless the fresh subscription asks for it again.
    saveDeviceSetting(HA_KIOSK_MODE, "false");

    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "home-assistant/subscribe-properties",
        kioskMode: false,
        handleSafeArea: true,
      }),
      "*",
    );
  });

  it("keeps following Home Assistant's route across a kiosk mode change", () => {
    const router = { currentRoute: { value: { fullPath: "/" } } } as Router;
    subscribeToHAProperties({ kioskMode: true, router });

    saveDeviceSetting(HA_KIOSK_MODE, "false");

    expect(haState.routeSyncEnabled).toBe(true);
  });

  it("drops the top inset again once the header is back", () => {
    subscribeToHAProperties({ handleSafeArea: true, kioskMode: true });
    reportProperties({ narrow: true, safeAreaInsets: PHONE_INSETS });
    expect(readInsets()).toEqual(["59px", "0px", "34px", "0px"]);

    saveDeviceSetting(HA_KIOSK_MODE, "false");
    reportProperties({ narrow: true, safeAreaInsets: PHONE_INSETS });

    expect(readInsets()).toEqual(["", "0px", "34px", "0px"]);
  });

  it("leaves Home Assistant alone while the preference is unchanged", () => {
    subscribeToHAProperties({ handleSafeArea: true, kioskMode: true });
    postMessage.mockClear();

    saveDeviceSetting(HA_KIOSK_MODE, "true");

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("ignores the preference outside an ingress session", () => {
    saveDeviceSetting(HA_KIOSK_MODE, "false");

    expect(postMessage).not.toHaveBeenCalled();
  });
});
