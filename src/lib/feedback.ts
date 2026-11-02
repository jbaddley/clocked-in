import type { FeedbackArea, FeedbackPriority, FeedbackStatus, FeedbackType } from "@/lib/api/json";

export const feedbackTypes: { value: FeedbackType; label: string; swatch?: string }[] = [
  { value: "Bug", label: "Bug", swatch: "bg-red-500" },
  { value: "Feature", label: "Feature request", swatch: "bg-emerald-500" },
];

export const feedbackPriorities: { value: FeedbackPriority; label: string; swatch?: string }[] = [
  { value: "Urgent", label: "Urgent", swatch: "bg-red-500" },
  { value: "High", label: "High", swatch: "bg-amber-500" },
  { value: "Medium", label: "Medium", swatch: "bg-sky-500" },
  { value: "Low", label: "Low", swatch: "bg-slate-400" },
];

export const feedbackAreas: { value: FeedbackArea; label: string; swatch?: string }[] = [
  { value: "Dashboard", label: "Dashboard", swatch: "bg-indigo-500" },
  { value: "LogTime", label: "Log time", swatch: "bg-violet-500" },
  { value: "Entries", label: "Entries", swatch: "bg-cyan-500" },
  { value: "Reports", label: "Reports", swatch: "bg-teal-500" },
  { value: "Settings", label: "Settings", swatch: "bg-amber-500" },
  { value: "Other", label: "Other", swatch: "bg-slate-400" },
];

export function feedbackAreaForPath(pathname: string): FeedbackArea {
  const path = pathname.split("?")[0] || "/";
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "Dashboard";
  if (path === "/log" || path.startsWith("/log/")) return "LogTime";
  if (path === "/entries" || path.startsWith("/entries/")) return "Entries";
  if (path === "/reports" || path.startsWith("/reports/")) return "Reports";
  if (path === "/settings" || path.startsWith("/settings/")) return "Settings";
  return "Other";
}

export const feedbackStatuses: { value: FeedbackStatus; label: string; swatch?: string }[] = [
  { value: "Pending", label: "Pending", swatch: "bg-amber-500" },
  { value: "Acknowledged", label: "Acknowledged", swatch: "bg-sky-500" },
  { value: "Planned", label: "Planned", swatch: "bg-indigo-500" },
  { value: "InProgress", label: "In progress", swatch: "bg-blue-500" },
  { value: "Resolved", label: "Resolved", swatch: "bg-emerald-500" },
  { value: "Cancelled", label: "Cancelled", swatch: "bg-slate-400" },
  { value: "CouldNotReproduce", label: "Could not reproduce", swatch: "bg-zinc-400" },
  { value: "Archived", label: "Archived", swatch: "bg-neutral-400" },
];

export function feedbackOption<T extends string>(options: { value: T; label: string; swatch?: string }[], value: T) {
  return options.find((option) => option.value === value);
}

export function feedbackLabel<T extends string>(options: { value: T; label: string }[], value: T) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export const maxFeedbackAttachments = 5;
export const maxFeedbackAttachmentBytes = 4 * 1024 * 1024;

export const feedbackImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const feedbackImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export const feedbackDocumentExtensionMime: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".log": "text/plain",
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".json": "application/json",
  ".rtf": "application/rtf",
};

export const feedbackDocumentMimeExtension: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/x-markdown": ".md",
  "text/csv": ".csv",
  "application/csv": ".csv",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/json": ".json",
  "application/rtf": ".rtf",
  "text/rtf": ".rtf",
};

export const feedbackAttachmentAccept = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  ...Object.keys(feedbackDocumentExtensionMime),
].join(",");

export type FeedbackAttachmentClassification =
  | { kind: "image" }
  | { kind: "document"; extension: string; contentType: string; safeName: string }
  | { error: string };

function fileExtension(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(dot).toLowerCase();
}

function sanitizeDocumentFileName(rawName: string, extension: string): string {
  const baseName = rawName.split(/[\\/]/).pop()?.trim() ?? "";
  const withoutExt =
    extension && baseName.toLowerCase().endsWith(extension)
      ? baseName.slice(0, baseName.length - extension.length)
      : baseName;
  const cleaned = withoutExt
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 60);
  return `${cleaned || "document"}${extension}`;
}

export function classifyFeedbackAttachment(file: {
  name: string;
  type: string;
  size: number;
}): FeedbackAttachmentClassification {
  if (file.size <= 0) {
    return { error: "Choose an image or document to upload." };
  }

  if (file.size > maxFeedbackAttachmentBytes) {
    return { error: "Each attachment must be 4 MB or smaller." };
  }

  const mime = file.type.trim().toLowerCase();
  const ext = fileExtension(file.name);

  if (feedbackImageTypes.has(mime) || ((!mime || mime === "application/octet-stream") && feedbackImageExtensions.has(ext))) {
    return { kind: "image" };
  }

  const docExt = feedbackDocumentExtensionMime[ext] ? ext : feedbackDocumentMimeExtension[mime] ?? "";
  const allowedDocMime = docExt ? feedbackDocumentExtensionMime[docExt] : undefined;
  if (
    docExt &&
    allowedDocMime &&
    (!mime ||
      mime === "application/octet-stream" ||
      Boolean(feedbackDocumentMimeExtension[mime]) ||
      mime.startsWith("text/"))
  ) {
    return {
      kind: "document",
      extension: docExt,
      contentType: allowedDocMime,
      safeName: sanitizeDocumentFileName(file.name, docExt),
    };
  }

  return {
    error: "Upload a PNG, JPEG, WebP, or GIF image, or a PDF, Word, Excel, CSV, TXT, Markdown, JSON, or RTF document.",
  };
}

export function isFeedbackImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url, "https://voluntime.local").pathname.toLowerCase();
    for (const ext of feedbackImageExtensions) {
      if (pathname.endsWith(ext)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function feedbackAttachmentName(url: string, index = 0): string {
  try {
    const pathname = new URL(url, "https://voluntime.local").pathname;
    const rawSegment = decodeURIComponent(pathname.split("/").pop() ?? "").trim();
    if (!rawSegment) {
      return `Attachment ${index + 1}`;
    }
    const withoutUuidPrefix = rawSegment.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      "",
    );
    return withoutUuidPrefix || rawSegment;
  } catch {
    return `Attachment ${index + 1}`;
  }
}

