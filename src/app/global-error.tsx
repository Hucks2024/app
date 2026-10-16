"use client";

import { isLocale } from "@/i18n/config";

// The last resort, for when even the page frame (the nav, the layout)
// couldn't be drawn. It replaces the whole document, so none of the app's
// styles are here: everything it needs is inline. Nor is the app's
// language, so its three lines carry their own, chosen the same way.
const WORDS = {
  en: ["That didn't load", "Try again", "Back to the map"],
  zh: ["加载失败", "再试一次", "回到地图"],
  hi: ["यह लोड नहीं हुआ", "फिर से कोशिश करें", "मैप पर वापस जाएँ"],
  es: ["No se ha cargado", "Reintentar", "Volver al mapa"],
  fr: ["Le chargement a échoué", "Réessayer", "Retour à la carte"],
};
type Lang = keyof typeof WORDS;

function language(): Lang {
  if (typeof document === "undefined") return "en";
  // Only the languages switched on (src/i18n/config.ts).
  const isLang = (code: string | undefined): code is Lang => !!code && code in WORDS && isLocale(code);
  const chosen = document.cookie.match(/(?:^|; )lang=(\w+)/)?.[1];
  if (isLang(chosen)) return chosen;
  const device = navigator.language?.slice(0, 2).toLowerCase();
  return isLang(device) ? device : "en";
}

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  console.error(error);
  const lang = language();
  const [heading, tryAgain, backToMap] = WORDS[lang];
  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
          background: "linear-gradient(180deg, #6d28d9 0%, #9333ea 45%, #c026d3 75%, #db2777 100%)",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <title>packmates</title>
        <div style={{ maxWidth: 340 }}>
          <h1 style={{ fontSize: 26, margin: "0 0 24px" }}>{heading}</h1>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              width: "100%",
              height: 56,
              border: 0,
              borderRadius: 999,
              background: "#000",
              color: "#fff",
              fontSize: 17,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tryAgain}
          </button>
          <p style={{ marginTop: 16 }}>
            <a href="/" style={{ color: "#fff" }}>
              {backToMap}
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
