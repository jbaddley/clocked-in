import Color from "colorjs.io";

export const sequentialPaletteSize = 10;

const hexColor = /^#[0-9A-Fa-f]{6}$/;
const lightCeiling = 0.97;
const darkFloor = 0.15;

function channel(value: number | null, fallback = 0) {
  return value != null && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function toHex(color: Color) {
  const mapped = color.to("srgb").toGamut({ space: "srgb" });
  const [red, green, blue] = mapped.srgb.map((value) => Math.round(clamp(channel(value), 0, 1) * 255));
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function sequentialPaletteFrom(seed: string, count = sequentialPaletteSize) {
  if (!hexColor.test(seed)) {
    throw new Error("Seed must be a #RRGGBB color.");
  }

  const source = new Color(seed).to("oklch");
  const lightness = clamp(channel(source.oklch.l, 0.5), 0, 1);
  const chroma = Math.max(channel(source.oklch.c), 0);
  const hue = channel(source.oklch.h);
  const slot = Math.round((1 - lightness) * (count - 1));
  const exact = seed.toUpperCase();

  return Array.from({ length: count }, (_, index) => {
    if (index === slot) {
      return exact;
    }

    const nextLightness =
      index < slot
        ? lerp(Math.max(lightCeiling, lightness), lightness, index / slot)
        : lerp(lightness, Math.min(darkFloor, lightness), (index - slot) / (count - 1 - slot));

    return toHex(new Color("oklch", [nextLightness, chroma, hue]));
  });
}
