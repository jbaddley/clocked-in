import "server-only";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { fail, validation } from "@/lib/api/errors";
import { classifyFeedbackAttachment, maxFeedbackAttachments } from "@/lib/feedback";

const allowedFormats = new Set(["png", "jpeg", "webp", "gif"]);

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    fail(500, "server_error", "Blob storage is not configured.");
  }

  return token;
}

export async function uploadFeedbackScreenshots(userId: string, files: File[]) {
  if (files.length > maxFeedbackAttachments) {
    validation("You can attach up to 5 files.");
  }

  const urls: string[] = [];
  for (const file of files) {
    urls.push(await putFeedbackAttachment(userId, file));
  }

  return urls;
}

async function putFeedbackAttachment(userId: string, file: File) {
  if (!(file instanceof File) || file.size === 0) {
    validation("Choose an image or document to upload.");
  }

  const classified = classifyFeedbackAttachment(file);
  if ("error" in classified) {
    validation(classified.error);
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (classified.kind === "document") {
    const stored = await put(`feedback/${userId}/${randomUUID()}-${classified.safeName}`, input, {
      access: "public",
      addRandomSuffix: false,
      contentType: classified.contentType,
      token: blobToken(),
    });
    return stored.url;
  }

  let image: ReturnType<typeof sharp>;
  try {
    image = sharp(input, { failOn: "none", pages: 1 }).rotate();
  } catch {
    validation("Upload a PNG, JPEG, WebP, or GIF image.");
  }

  const metadata = await image.metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    validation("Upload a PNG, JPEG, WebP, or GIF image.");
  }

  const buffer = await image
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer();
  const stored = await put(`feedback/${userId}/${randomUUID()}.webp`, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/webp",
    token: blobToken(),
  });
  return stored.url;
}
