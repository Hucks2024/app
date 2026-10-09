import { headers } from "next/headers";
import { APP_USER_AGENT } from "@/lib/native";

/** Whether this request is from the App Store app rather than a browser.
 * The app leaves out what only makes sense on the website: "add to home
 * screen" tips, and buttons to download the app it already is. */
export async function inApp(): Promise<boolean> {
  return ((await headers()).get("user-agent") ?? "").includes(APP_USER_AGENT);
}
