import { createInvitationFile } from "@/helpers/invitation_share";
import QRCode from "qrcode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: {
    toCanvas: vi.fn(),
  },
}));

const mockToCanvas = vi.mocked(QRCode.toCanvas);

describe("createInvitationFile", () => {
  const addColorStop = vi.fn();
  const context = {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop })),
    createRadialGradient: vi.fn(() => ({ addColorStop })),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    fillText: vi.fn(),
    font: "",
    lineTo: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    textAlign: "",
    textBaseline: "",
  };

  beforeEach(() => {
    mockToCanvas.mockReset().mockResolvedValue(undefined);
    Object.values(context).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) {
        value.mockClear();
      }
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() =>
        context) as unknown as typeof HTMLCanvasElement.prototype.getContext,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(new Blob(["png"], { type: "image/png" })),
    );
    vi.stubGlobal(
      "Image",
      class {
        naturalHeight = 499;
        naturalWidth = 3756;
        onerror: OnErrorEventHandler | null = null;
        onload: ((event: Event) => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.(new Event("load")));
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders a branded PNG containing the QR and invitation details", async () => {
    const file = await createInvitationFile({
      description: "Bring your requests",
      joinLink: "https://example.com/party?join=abc",
      logoUrl: "/assets/logo.png",
      title: "Join Friday party",
    });

    const qrCanvas = mockToCanvas.mock.calls[0][0];
    expect(mockToCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      "https://example.com/party?join=abc",
      {
        color: {
          dark: "#111827",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
        margin: 2,
        width: 610,
      },
    );
    expect(context.drawImage).toHaveBeenCalledWith(qrCanvas, 235, 518);
    expect(context.fillText).toHaveBeenCalledWith(
      "Join Friday party",
      540,
      210,
    );
    expect(context.fillText).toHaveBeenCalledWith(
      "Bring your requests",
      540,
      360,
    );
    expect(context.fillText).toHaveBeenCalledWith(
      "https://example.com/party?join=abc",
      540,
      1198,
    );
    expect(file.name).toBe("music-assistant-invitation.png");
    expect(file.type).toBe("image/png");
  });
});
