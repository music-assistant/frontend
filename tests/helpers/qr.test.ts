import { renderQrCode } from "@/helpers/qr";
import QRCode from "qrcode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: {
    toCanvas: vi.fn(),
  },
}));

const originalDevicePixelRatioDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "devicePixelRatio",
);
const mockToCanvas = vi.mocked(QRCode.toCanvas);

describe("renderQrCode", () => {
  beforeEach(() => {
    mockToCanvas.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    restoreDevicePixelRatio();
  });

  it("renders a standard high-contrast QR at the device pixel ratio", async () => {
    const canvas = document.createElement("canvas");
    setDevicePixelRatio(2);

    await renderQrCode(canvas, "https://example.com/quiz");

    expect(mockToCanvas).toHaveBeenCalledWith(
      canvas,
      "https://example.com/quiz",
      {
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
        margin: 4,
        width: 440,
      },
    );
    expect(canvas.style.width).toBe("220px");
    expect(canvas.style.height).toBe("220px");
  });

  it("scales a requested logical size to physical pixels", async () => {
    const canvas = document.createElement("canvas");
    setDevicePixelRatio(1.5);

    await renderQrCode(canvas, "https://example.com/present", 260);

    expect(mockToCanvas).toHaveBeenCalledWith(
      canvas,
      "https://example.com/present",
      expect.objectContaining({ width: 390 }),
    );
    expect(canvas.style.width).toBe("260px");
    expect(canvas.style.height).toBe("260px");
  });

  it.each([0.5, 0, Number.NaN, Number.POSITIVE_INFINITY, -1, undefined])(
    "uses a minimum pixel ratio of one for %s",
    async (pixelRatio) => {
      const canvas = document.createElement("canvas");
      setDevicePixelRatio(pixelRatio);

      await renderQrCode(canvas, "https://example.com/quiz", 260);

      expect(mockToCanvas).toHaveBeenCalledWith(
        canvas,
        "https://example.com/quiz",
        expect.objectContaining({ width: 260 }),
      );
    },
  );
});

function setDevicePixelRatio(pixelRatio: number | undefined) {
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: pixelRatio,
  });
}

function restoreDevicePixelRatio() {
  if (originalDevicePixelRatioDescriptor) {
    Object.defineProperty(
      window,
      "devicePixelRatio",
      originalDevicePixelRatioDescriptor,
    );
    return;
  }
  Reflect.deleteProperty(window, "devicePixelRatio");
}
