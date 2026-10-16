"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_NAMES, LOCALES } from "@/i18n/config";
import { setLanguageAction } from "@/i18n/actions";
import { useLocale, useT } from "@/i18n/client";

/** The app's language, picked by name in that language ("Español",
 * "中文"), so anyone can find their own whatever the page is in now. The
 * choice is a cookie; the page then redraws in it. */
export default function LanguagePicker({ onDark = false }: { onDark?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <label className={`flex items-center justify-center gap-2 text-base ${onDark ? "text-white" : "text-slate-800"}`}>
      <span aria-hidden="true">🌐</span>
      <span className="font-semibold">{t.common.language}</span>
      <select
        className="input !w-auto min-h-11 bg-white !py-1 !text-base text-slate-900"
        value={locale}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            await setLanguageAction(next);
            router.refresh();
          });
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LANGUAGE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
