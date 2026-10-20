import "server-only";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { fail, validation } from "@/lib/api/errors";

const maxUploadBytes = 4 * 1024 * 1024;
const maxScreenshots = 5;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const allowedFormats = new Set(["png", "jpeg", "webp", "gif"]);

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    fail(500, "server_error", "Blob storage is not configured.");
  }

  return token;
}

export async function uploadFeedbackScreenshots(userId: string, files: File[]) {
  if (files.length > maxScreenshots) {
    validation("You can attach up to 5 screenshots.");
  }

  const urls: string[] = [];
  for (const file of files) {
    urls.push(await putFeedbackScreenshot(userId, file));
  }

  return urls;
}

async function putFeedbackScreenshot(userId: string, file: File) {
  if (!(file instanceof File) || file.size === 0) {
    validation("Choose an image to upload.");
  }

  if (file.size > maxUploadBytes) {
    validation("Image must be 4 MB or smaller.");
  }

  if (file.type && !allowedTypes.has(file.type)) {
    validation("Upload a PNG, JPEG, WebP, or GIF image.");
  }

  const input = Buffer.from(await file.arrayBuffer());
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
