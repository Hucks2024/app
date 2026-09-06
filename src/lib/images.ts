const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6MB per photo

export class ImageValidationError extends Error {}

/** Reads a File from a form upload into a Buffer, enforcing type/size limits. */
export async function readImageFile(file: File | null): Promise<{
  bytes: Buffer;
  type: string;
} | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ImageValidationError("Please upload a JPEG, PNG, or WEBP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new ImageValidationError("Image is too large (6MB max).");
  }

  const arrayBuffer = await file.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), type: file.type };
}
