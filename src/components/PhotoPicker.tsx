"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/client";

// Shrinks the photo before it's sent.
//
// A photo straight off a phone camera is 2-5MB, and the server only takes
// a few: sent as it is, it failed with an error page. Drawn down to 256px
// on a canvas it's a WebP of a few KB (or a JPEG the server makes one),
// which uploads in a blink even on a bad signal and is still sharp in the
// biggest circle it's shown in (64px, on a 3x screen). Small
// matters: every face on every meetup page is one of these, and the free
// plans are mostly spent storing and sending them. If the browser can't
// read the file (an odd format, a very old phone), it goes as it is and
// the server shrinks it (src/lib/images.ts).

const MAX_SIDE = 256;

async function shrink(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const as = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    // A WebP where the browser can make one (an iPhone gives back a PNG
    // instead); otherwise a good JPEG, which the server makes a WebP.
    const webp = await as("image/webp", 0.75);
    if (webp?.type === "image/webp") return new File([webp], "photo.webp", { type: "image/webp" });
    const jpeg = await as("image/jpeg", 0.9);
    if (!jpeg) return file;
    return new File([jpeg], "photo.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** One big button that opens the camera or the photo library, a round
 * preview of the result, and the save button, which stays off until
 * there's a photo to save. */
export default function PhotoPicker({ saveLabel }: { saveLabel: string }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    try {
      const small = await shrink(file);
      const list = new DataTransfer();
      list.items.add(small);
      if (inputRef.current) inputRef.current.files = list.files;
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(small);
      });
    } catch {
      // Couldn't read it here: send the original and let the server judge.
      setPreview((old) => old ?? "");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={t.photo.yours} className="h-40 w-40 rounded-full border-4 border-white object-cover shadow-lg" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-dashed border-white/70 text-6xl" aria-hidden="true">
            🙂
          </div>
        )}
      </div>
      <label className="pill-btn pill-white cursor-pointer">
        <span aria-hidden="true">📷</span>
        {working ? t.photo.oneMoment : preview ? t.photo.different : t.photo.take}
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={onChange}
          className="sr-only"
        />
      </label>
      <button
        type="submit"
        disabled={!preview || working || saving}
        onClick={() => {
          // Let the form submit, then show it's on its way.
          setTimeout(() => setSaving(true), 0);
        }}
        className="pill-btn pill-black disabled:opacity-40"
      >
        {saving && <span className="spinner" aria-hidden="true" />}
        {saveLabel}
      </button>
    </div>
  );
}
