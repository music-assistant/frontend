import QRCode from "qrcode";

export async function renderQrCode(
  canvas: HTMLCanvasElement,
  value: string,
  width = 220,
) {
  const pixelRatio = getDevicePixelRatio();

  await QRCode.toCanvas(canvas, value, {
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
    margin: 4,
    width: Math.round(width * pixelRatio),
  });

  canvas.style.width = `${width}px`;
  canvas.style.height = `${width}px`;
}

function getDevicePixelRatio() {
  const pixelRatio = window.devicePixelRatio;
  return Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
}
