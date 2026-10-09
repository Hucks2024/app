// Inside the App Store app the site runs in Capacitor's web view (see
// mobile/), which puts a bridge to the phone on window. These reach the
// phone's own location, share sheet and haptics through it. On the website
// there's no bridge, they return null, and the web versions are used.

type Bridge = {
  isNativePlatform?: () => boolean;
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<unknown>;
};

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: Bridge }).Capacitor;
  return cap?.isNativePlatform?.() && cap.nativePromise ? cap : null;
}

/** A phone feature, or null on the website. */
export function callNative<T>(plugin: string, method: string, options: object = {}): Promise<T> | null {
  const cap = bridge();
  return cap ? (cap.nativePromise!(plugin, method, options) as Promise<T>) : null;
}

/** Added to the app's user agent (mobile/capacitor.config.json), so the
 * server can tell it's drawing a page for the app. */
export const APP_USER_AGENT = "PackmatesApp";
