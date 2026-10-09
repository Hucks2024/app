"use client";

import { useRef, useState } from "react";

// The profile photo picker, which shrinks the photo before it's sent.
//
// A photo straight off a phone camera is 2-5MB, and the server only takes
// a few: sent as it is, it failed with an error page. Drawn down to 800px
// on a canvas it's a JPEG of a hundred or two KB, which uploads in a blink
// even on a bad signal and is still far sharper than the little circles
// it's shown in. If the browser can't read the file (an odd format, a very
// old phone), it goes as it is and the server's own checks decide.

const MAX_SIDE = 800;

export async function shrink(file: File): Promise<File> {
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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

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
      // Couldn't read it here; send the original and let the server judge.
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-14 w-14 flex-none rounded-full object-cover" />
      )}
      <input
        ref={inputRef}
        className="input"
        id="profilePhoto"
        name="profilePhoto"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={onChange}
        disabled={working}
      />
    </div>
  );
}
