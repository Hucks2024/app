import { inApp } from "@/lib/in-app";
import { getT } from "@/i18n/server";

// The app in the App Store and Google Play. Each button shows once its
// link is set (GitHub secrets APP_STORE_URL, GOOGLE_PLAY_URL), and only if it
// really is a store link; with neither set, nothing shows. Except where
// "soon" is asked for: there the App Store one shows anyway, as a picture
// that goes nowhere, and turns into the link the moment APP_STORE_URL is
// set.

function storeLink(url: string | undefined, host: string): string | null {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "https:" && u.hostname === host ? u.href : null;
  } catch {
    return null;
  }
}

export function storeLinks() {
  return {
    apple: storeLink(process.env.APP_STORE_URL, "apps.apple.com"),
    google: storeLink(process.env.GOOGLE_PLAY_URL, "play.google.com"),
  };
}

export default async function StoreBadges({ className = "", soon = false }: { className?: string; soon?: boolean }) {
  const { apple, google } = storeLinks();
  // Not in the app itself, which is what they'd download.
  if ((!apple && !google && !soon) || (await inApp())) return null;
  const t = await getT();
  // eslint-disable-next-line @next/next/no-img-element
  const appleBadge = <img src="/badges/app-store.svg" alt={t.welcome.appStore} width={135} height={40} className="h-12 w-auto" />;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      {apple ? <a href={apple}>{appleBadge}</a> : soon && appleBadge}
      {google && (
        <a href={google}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/badges/google-play.svg" alt={t.welcome.googlePlay} width={135} height={40} className="h-12 w-auto" />
        </a>
      )}
    </div>
  );
}
