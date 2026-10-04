const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// Under the 4MB request limit in next.config.js, with room for the rest of
// the form, so a too-big photo gets this message rather than a crash.
const MAX_BYTES = 3.5 * 1024 * 1024;

export class ImageValidationError extends Error {}

/**
 * Reads a File from a form upload into a plain Uint8Array (not a Node
 * Buffer), enforcing type/size limits. A plain Uint8Array is what Prisma's
 * Bytes fields expect and what the Cloudflare Workers runtime supports.
 * Buffer-specific methods aren't needed anywhere we use these bytes.
 */
export async function readImageFile(file: File | null): Promise<{
  bytes: Uint8Array<ArrayBuffer>;
  type: string;
} | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ImageValidationError("That photo's format isn't supported. Try a JPEG or PNG.");
  }
  if (file.size > MAX_BYTES) {
    throw new ImageValidationError("That photo is too big to upload. Try a smaller one, or a screenshot of it.");
  }

  const arrayBuffer = await file.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), type: file.type };
}
