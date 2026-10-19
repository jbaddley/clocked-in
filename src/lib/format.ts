const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const longDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function formatCurrency(value: number) {
  return currency.format(value);
}

export function formatNumber(value: number) {
  return number.format(value);
}

export function formatHours(hours: number) {
  return `${number.format(hours)} h`;
}

const compactUnits = [
  { divisor: 1_000_000_000, suffix: "b" },
  { divisor: 1_000_000, suffix: "m" },
  { divisor: 1_000, suffix: "k" },
] as const;

function compactBody(value: number) {
  const negative = value < 0;
  const abs = Math.abs(value);
  const unit = compactUnits.find((item) => abs >= item.divisor);
  if (!unit) return null;

  const scaled = Math.floor((abs / unit.divisor) * 10 + 1e-6) / 10;
  const digits = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
  return `${negative ? "-" : ""}${digits}${unit.suffix}`;
}

/** Large values become 3.5k or 3.4m. Smaller values keep their full precision. */
export function formatCompactNumber(value: number) {
  return compactBody(value) ?? formatNumber(value);
}

/** Large amounts become $3.4m or $120k. Smaller amounts keep cents. */
export function formatCompactCurrency(value: number) {
  const compact = compactBody(value);
  if (!compact) return formatCurrency(value);

  const negative = compact.startsWith("-");
  return `${negative ? "-" : ""}$${negative ? compact.slice(1) : compact}`;
}

const chartAbbreviations: Record<string, string> = {
  january: "Jan",
  february: "Feb",
  march: "Mar",
  april: "Apr",
  june: "Jun",
  july: "Jul",
  august: "Aug",
  september: "Sep",
  october: "Oct",
  november: "Nov",
  december: "Dec",
};

export function abbreviateChartLabel(label: string) {
  return label.replace(/[A-Za-z]+/g, (word) => chartAbbreviations[word.toLowerCase()] ?? word);
}

export function formatMinutes(minutes: number | null) {
  if (minutes === null) return "--:--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function fromDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateOnly(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today() {
  return toDateOnly(new Date());
}

export function formatDate(value: string) {
  return longDate.format(fromDateOnly(value));
}

export function dayLabel(value: string) {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (value === toDateOnly(now)) return "Today";
  if (value === toDateOnly(yesterday)) return "Yesterday";
  return formatDate(value);
}

export function formatTime(value: string | null) {
  return value ? time.format(new Date(value)) : "";
}

export function formatInstant(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}

export function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
