import { $t } from "@/plugins/i18n";
import type { DSPIRMetadata } from "@/plugins/api/interfaces";

// Mirrors the server-side MAX_IR_BYTES. Checked against the raw file, before
// base64 encoding inflates it by ~4/3.
export const MAX_IR_BYTES = 50 * 1024 * 1024;

// Accepted by ffmpeg server-side; the picker hint stays broad on purpose.
export const IR_FILE_ACCEPT = "audio/*,.wav,.flac,.aiff,.aif";

// Reads a file as base64 without the `data:...;base64,` prefix that
// readAsDataURL produces.
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result"));
        return;
      }
      const separator = result.indexOf(",");
      resolve(separator === -1 ? result : result.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

// "48 kHz · Stereo · 0.53 s"
export function dspIRDetailText(ir: DSPIRMetadata): string {
  return [
    `${(ir.sample_rate / 1000).toFixed(ir.sample_rate % 1000 === 0 ? 0 : 1)} kHz`,
    channelText(ir.channels),
    `${ir.duration.toFixed(2)} s`,
  ].join(" · ");
}

function channelText(channels: number): string {
  if (channels === 1) return $t("settings.dsp.convolution.mono");
  if (channels === 2) return $t("settings.dsp.convolution.stereo");
  return $t("settings.dsp.convolution.channel_count", [channels]);
}
