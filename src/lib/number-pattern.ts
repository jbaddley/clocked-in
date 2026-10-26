import numeral from "numeral";

export const formatPresets = ["number", "hours", "currency"] as const;
export type FormatPreset = (typeof formatPresets)[number];

export const formatPatterns: Record<FormatPreset, string> = {
  number: "0,0.[00]",
  hours: "0,0.[00]",
  currency: "$0,0.00",
};

export const countPattern = "0,0";
export const moneyPattern = "$0,0.00";

const presetLabels: Record<FormatPreset, string> = {
  number: "Number",
  hours: "Hours",
  currency: "Currency",
};

export function formatPresetLabel(preset: FormatPreset) {
  return presetLabels[preset];
}

export function patternFor(format: string) {
  return format === "currency" ? formatPatterns.currency : formatPatterns.number;
}

export function formatWithPattern(value: number, pattern: string) {
  if (!Number.isFinite(value)) return "—";
  const formatted = numeral(value).format(pattern);
  return formatted || "—";
}
