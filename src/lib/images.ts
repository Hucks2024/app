import { onCloudflare } from "@/lib/runtime";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// Under the 4MB request limit in next.config.js, with room for the rest of
// the form, so a too-big photo gets this message rather than a crash.
const MAX_BYTES = 3.5 * 1024 * 1024;

export class ImageValidationError extends Error {}

/**
 * Reads a File from a form upload into a plain Uint8Array (not a Node
 * Buffer), enforcing type/size limits. A plain Uint8Array is what Prisma's
 * Bytes fields expect.
 */
export async function readImageFile(file: File | null): Promise<{
  bytes: Uint8Array<ArrayBuffer>;
  type: string;
} | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_TYPES.has(file.type)) {
    // Names of lines in t.errors, shown in the member's language.
    throw new ImageValidationError("photoType");
  }
  if (file.size > MAX_BYTES) {
    throw new ImageValidationError("photoTooBig");
  }

  const arrayBuffer = await file.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), type: file.type };
}

const PHOTO_SIDE = 256;
const PHOTO_QUALITY = 75;

/** The photo at most 256px across, as a WebP of a few KB: about a third of
 * a JPEG's size, and still sharp in the biggest circle it's shown in (64px,
 * on a 3x screen). Most browsers send one already; iPhones send a JPEG,
 * made into a WebP here (by Cloudflare Images on Cloudflare, sharp on a
 * Node server). Left as it is if that fails: still small, as the browser
 * shrank it first. */
export async function shrinkPhoto(photo: { bytes: Uint8Array<ArrayBuffer>; type: string }) {
  if (photo.type === "image/webp" && photo.bytes.length <= 30 * 1024) return photo;
  try {
    const out = onCloudflare ? await withCloudflareImages(photo.bytes) : await withSharp(photo.bytes);
    return { bytes: out, type: "image/webp" };
  } catch {
    return photo;
  }
}

async function withSharp(bytes: Uint8Array<ArrayBuffer>) {
  // sharp comes with Next, for its own images.
  const sharp = (await import("sharp")).default;
  const out = await sharp(bytes)
    .rotate()
    .resize(PHOTO_SIDE, PHOTO_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: PHOTO_QUALITY })
    .toBuffer();
  return new Uint8Array(out);
}

// Just the part of Cloudflare's Images binding (IMAGES in wrangler.jsonc)
// used here. Free for 5,000 photos a month; past that it fails rather
// than bills, and the photo is kept as the browser sent it.
type ImagesBinding = {
  input(stream: ReadableStream<Uint8Array>): {
    transform(t: { width: number; height: number; fit: "scale-down" }): {
      output(o: { format: "image/webp"; quality: number }): Promise<{ response(): Response }>;
    };
  };
};

async function withCloudflareImages(bytes: Uint8Array<ArrayBuffer>) {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const images = (getCloudflareContext().env as { IMAGES?: ImagesBinding }).IMAGES;
  if (!images) throw new Error("No IMAGES binding");
  const result = await images
    .input(new Blob([bytes]).stream())
    .transform({ width: PHOTO_SIDE, height: PHOTO_SIDE, fit: "scale-down" })
    .output({ format: "image/webp", quality: PHOTO_QUALITY });
  return new Uint8Array(await result.response().arrayBuffer());
}
