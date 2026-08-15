import type { TooltipOptions } from "chart.js";

/**
 * Gemeinsame Chart.js Konfigurationen für Music Assistant Stil
 */

// Music Assistant inspirierte Farbpalette
export const LASTFM_COLORS = [
  "#03a9f4", // MA Primary Blue
  "#4caf50", // Green
  "#9c27b0", // Purple
  "#ff9800", // Orange
  "#00bcd4", // Cyan
  "#e91e63", // Pink
  "#3f51b5", // Indigo
  "#8bc34a", // Light Green
  "#ffc107", // Amber
  "#009688", // Teal
];

// Gemeinsame Tooltip-Konfiguration
export const createTooltipConfig = <T extends string = string>(
  customCallbacks?: Partial<TooltipOptions<T>["callbacks"]>,
): Partial<TooltipOptions<T>> => ({
  backgroundColor: "rgba(0, 0, 0, 0.9)",
  titleColor: "#fff",
  bodyColor: "#fff",
  borderWidth: 0,
  padding: 16,
  displayColors: false,
  callbacks: customCallbacks,
});

// Gemeinsame Achsen-Konfiguration
export const createAxisConfig = (axis: "x" | "y") => ({
  ticks: {
    color: "rgb(var(--v-theme-on-surface))",
    font: {
      size: 11,
      family: "system-ui, -apple-system, sans-serif",
    },
  },
  grid: {
    color: "rgba(var(--v-theme-on-surface), 0.05)",
    display: axis === "x",
  },
});

// Gemeinsame Legend-Konfiguration
export const createLegendConfig = (
  position: "top" | "right" | "bottom" | "left" = "right",
) => ({
  position,
  labels: {
    color: "rgb(var(--v-theme-on-surface))",
    font: {
      size: 12,
      family: "system-ui, -apple-system, sans-serif",
    },
    padding: 16,
    boxWidth: 16,
    boxHeight: 16,
    usePointStyle: true,
    pointStyle: "circle",
  },
});
