"use client";

import { useRef, useState } from "react";
import { shrink } from "@/components/PhotoInput";

/** One big button that opens the camera or the photo library, a round
 * preview of the result, and the save button, which stays off until
 * there's a photo to save. */
export default function PhotoPicker({ saveLabel }: { saveLabel: string }) {
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
          <img src={preview} alt="Your photo" className="h-40 w-40 rounded-full border-4 border-white object-cover shadow-lg" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-dashed border-white/70 text-6xl" aria-hidden="true">
            🙂
          </div>
        )}
      </div>
      <label className="pill-btn pill-white cursor-pointer">
        <span aria-hidden="true">📷</span>
        {working ? "One moment…" : preview ? "Pick a different photo" : "Take or choose a photo"}
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
