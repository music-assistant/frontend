import { HighLowPassSlope } from "@/plugins/api/interfaces";

// Shared constants for the High/Low-pass DSP filter, mirroring the server-side
// validation: slope must be one of these values, cutoff must be 20..20000 Hz.
export const HIGH_LOW_PASS_SLOPES: readonly HighLowPassSlope[] = [12, 24, 48];

// Mode-appropriate cutoff defaults. A new high-pass opens low (~80 Hz); a
// low-pass makes more sense high up. Used both when creating a filter and when
// flipping mode on an otherwise-untouched one.
export const DEFAULT_HIGH_PASS_FREQUENCY = 80;
export const DEFAULT_LOW_PASS_FREQUENCY = 12000;
