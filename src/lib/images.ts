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
    throw new ImageValidationError("Use a JPEG or PNG photo.");
  }
  if (file.size > MAX_BYTES) {
    throw new ImageValidationError("Photo too big. Try a smaller one.");
  }

  const arrayBuffer = await file.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), type: file.type };
}

const PHOTO_SIDE = 256;

/** The photo at most 256px across, as a WebP of a few KB: about a third of
 * a JPEG's size, and still sharp in the biggest circle it's shown in (64px,
 * on a 3x screen). Always redone here, whatever the browser sent, so every
 * photo is this small. Left as it is if it can't be read (sharp comes with
 * Next, for its own images). */
export async function shrinkPhoto(photo: { bytes: Uint8Array<ArrayBuffer>; type: string }) {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(photo.bytes)
      .rotate()
      .resize(PHOTO_SIDE, PHOTO_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    return { bytes: new Uint8Array(out), type: "image/webp" };
  } catch {
    return photo;
  }
}
