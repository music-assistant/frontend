import QRCode from "qrcode";

export interface PartyInvitationDetails {
  description: string;
  joinLink: string;
  logoUrl: string;
  title: string;
}

/** Create a branded PNG invitation for sharing. */
export async function createPartyInvitationFile(
  details: PartyInvitationDetails,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is unavailable");
  }

  const [logo, qrCanvas] = await Promise.all([
    loadImage(details.logoUrl),
    createQrCanvas(details.joinLink),
  ]);
  drawInvitation(context, logo, qrCanvas, details);

  const blob = await canvasToBlob(canvas);
  return new File([blob], "music-assistant-party.png", {
    type: "image/png",
  });
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const CARD_PADDING = 84;
const QR_PANEL_SIZE = 690;
const QR_PANEL_TOP = 478;
const QR_SIZE = 610;
const FONT_FAMILY = '"Roboto", "Arial", sans-serif';

async function createQrCanvas(joinLink: string) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, joinLink, {
    color: {
      dark: "#111827",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
    margin: 2,
    width: QR_SIZE,
  });
  return canvas;
}

function drawInvitation(
  context: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  qrCanvas: HTMLCanvasElement,
  details: PartyInvitationDetails,
) {
  drawBackground(context);

  const logoWidth = 720;
  const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
  context.drawImage(
    logo,
    (CARD_WIDTH - logoWidth) / 2,
    72,
    logoWidth,
    logoHeight,
  );

  context.fillStyle = "#F8FAFC";
  context.textAlign = "center";
  drawTextBlock(context, details.title, 210, 64, 72, 2);

  context.fillStyle = "#CBD5E1";
  drawTextBlock(context, details.description, 360, 36, 46, 2);

  const qrPanelLeft = (CARD_WIDTH - QR_PANEL_SIZE) / 2;
  drawRoundedRect(
    context,
    qrPanelLeft,
    QR_PANEL_TOP,
    QR_PANEL_SIZE,
    QR_PANEL_SIZE,
    32,
    "#FFFFFF",
  );
  context.drawImage(
    qrCanvas,
    (CARD_WIDTH - QR_SIZE) / 2,
    QR_PANEL_TOP + (QR_PANEL_SIZE - QR_SIZE) / 2,
  );

  context.fillStyle = "#CBD5E1";
  drawTextBlock(context, details.joinLink, 1198, 25, 32, 4);
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, "#123047");
  gradient.addColorStop(0.55, "#172033");
  gradient.addColorStop(1, "#111827");
  context.fillStyle = gradient;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const glow = context.createRadialGradient(900, 100, 0, 900, 100, 500);
  glow.addColorStop(0, "rgba(24, 188, 242, 0.28)");
  glow.addColorStop(1, "rgba(24, 188, 242, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

function drawTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  top: number,
  fontSize: number,
  lineHeight: number,
  maxLines: number,
) {
  context.font = `${fontSize >= 60 ? 700 : 400} ${fontSize}px ${FONT_FAMILY}`;
  context.textBaseline = "top";

  const maxWidth = CARD_WIDTH - CARD_PADDING * 2;
  const lines = wrapText(context, text.trim(), maxWidth);
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visibleLines[maxLines - 1] = addEllipsis(
      context,
      visibleLines[maxLines - 1],
      maxWidth,
    );
  }

  visibleLines.forEach((line, index) => {
    context.fillText(line, CARD_WIDTH / 2, top + index * lineHeight);
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let currentLine = "";

  for (const word of text.split(/\s+/)) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    const segments = splitLongWord(context, word, maxWidth);
    lines.push(...segments.slice(0, -1));
    currentLine = segments.at(-1) ?? "";
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function splitLongWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
) {
  const segments: string[] = [];
  let segment = "";

  for (const character of word) {
    if (
      segment &&
      context.measureText(`${segment}${character}`).width > maxWidth
    ) {
      segments.push(segment);
      segment = character;
    } else {
      segment += character;
    }
  }

  if (segment) segments.push(segment);
  return segments;
}

function addEllipsis(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  let shortened = text;
  while (shortened && context.measureText(`${shortened}...`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}...`;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
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
  context.fillStyle = fillStyle;
  context.fill();
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Could not load the Music Assistant logo"));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not create the party invitation image"));
      }
    }, "image/png");
  });
}
