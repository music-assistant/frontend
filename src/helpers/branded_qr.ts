import QRCode from "qrcode";

const MUSIC_ASSISTANT_BLUE = "#18BCF2";
const MUSIC_ASSISTANT_ICON_SRC = new URL("@/assets/icon.svg", import.meta.url)
  .href;
const QR_MARGIN_MODULES = 2;
const QR_MODULE_INSET_RATIO = 0.06;
const QR_MODULE_RADIUS_RATIO = 0.32;

let musicAssistantIconPromise: Promise<HTMLImageElement> | undefined;
type QRModules = ReturnType<typeof QRCode.create>["modules"];

export async function renderMusicAssistantQr(
  canvas: HTMLCanvasElement,
  value: string,
  width = 220,
) {
  const qrCode = QRCode.create(value, {
    errorCorrectionLevel: "H",
  });
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(width * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${width}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    console.warn("Branded QR: no 2d canvas context available, QR not drawn");
    return;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, width);
  drawRoundedModules(context, qrCode.modules, width);
  await drawCenteredLogo(context, width);
}

function drawRoundedModules(
  context: CanvasRenderingContext2D,
  modules: QRModules,
  width: number,
) {
  const totalModules = modules.size + QR_MARGIN_MODULES * 2;
  const moduleSize = width / totalModules;
  const inset = moduleSize * QR_MODULE_INSET_RATIO;
  const dotSize = moduleSize - inset * 2;
  const radius = dotSize * QR_MODULE_RADIUS_RATIO;

  context.fillStyle = MUSIC_ASSISTANT_BLUE;
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (!modules.get(row, column)) continue;
      const x = (column + QR_MARGIN_MODULES) * moduleSize + inset;
      const y = (row + QR_MARGIN_MODULES) * moduleSize + inset;
      roundedRect(context, x, y, dotSize, dotSize, radius);
      context.fill();
    }
  }
}

async function drawCenteredLogo(
  context: CanvasRenderingContext2D,
  width: number,
) {
  try {
    const logo = await loadMusicAssistantIcon();
    const iconSize = Math.round(width * 0.21);
    const iconMargin = Math.round(width * 0.018);
    const cutoutSize = iconSize + iconMargin * 2;
    const iconX = Math.round((width - iconSize) / 2);
    const iconY = iconX;
    const cutoutX = Math.round((width - cutoutSize) / 2);
    const cutoutY = cutoutX;

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.drawImage(logo, cutoutX, cutoutY, cutoutSize, cutoutSize);
    context.restore();

    context.save();
    context.drawImage(logo, iconX, iconY, iconSize, iconSize);
    context.restore();
  } catch (err) {
    console.debug("Branded QR: logo not drawn", err);
  }
}

function loadMusicAssistantIcon() {
  musicAssistantIconPromise ??= new Promise<HTMLImageElement>(
    (resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load QR logo"));
      image.src = MUSIC_ASSISTANT_ICON_SRC;
    },
  );
  return musicAssistantIconPromise;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  radius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
