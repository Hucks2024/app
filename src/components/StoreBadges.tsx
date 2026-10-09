// The app in the App Store and Google Play. Each button shows once its
// link is set in Vercel (APP_STORE_URL, GOOGLE_PLAY_URL), and only if it
// really is a store link; with neither set, nothing shows.

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

export default function StoreBadges({ className = "" }: { className?: string }) {
  const { apple, google } = storeLinks();
  if (!apple && !google) return null;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      {apple && (
        <a href={apple}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/badges/app-store.svg" alt="Download on the App Store" width={135} height={40} className="h-12 w-auto" />
        </a>
      )}
      {google && (
        <a href={google}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/badges/google-play.svg" alt="Get it on Google Play" width={135} height={40} className="h-12 w-auto" />
        </a>
      )}
    </div>
  );
}
