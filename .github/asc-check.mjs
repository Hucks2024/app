// For .github/workflows/ios.yml: asks App Store Connect whether the API
// key works, and prints Apple's answer (never the key), before the slow
// build. Also writes the account's Team ID (the app ID's prefix) to
// TEAM_FILE, to check APPLE_TEAM_ID against.
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const { KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID, TEAM_FILE } = process.env;
const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${part({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" })}.${part({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" })}`;
const signature = sign("sha256", Buffer.from(unsigned), { key: createPrivateKey(readFileSync(KEY_PATH)), dsaEncoding: "ieee-p1363" });

const headers = { Authorization: `Bearer ${unsigned}.${signature.toString("base64url")}` };
const res = await fetch("https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=live.packmates.app", { headers });
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  for (const e of body.errors ?? [{ title: res.statusText }]) console.log(`::error::App Store Connect answered ${res.status}: ${e.title.replace(/\.$/, "")}. ${e.detail ?? ""}`);
  // A few characters of each ID (useless on their own) to check against
  // App Store Connect.
  if (res.status === 401) console.log(`::error::So the key, its Key ID and the Issuer ID don't go together: check all three are from the same, still active key. The Key ID used ends in ${ASC_KEY_ID.slice(-3)} and the Issuer ID starts with ${ASC_ISSUER_ID.slice(0, 4)}.`);
  process.exit(1);
}
console.log(body.data?.length ? "The key works, and Packmates is in App Store Connect." : "::error::The key works, but there's no app with the bundle ID live.packmates.app in App Store Connect.");
if (!body.data?.length) process.exit(1);

const ids = await fetch("https://api.appstoreconnect.apple.com/v1/bundleIds?filter[identifier]=live.packmates.app&fields[bundleIds]=identifier,seedId", { headers });
const seedId = (await ids.json().catch(() => ({}))).data?.find((b) => b.attributes?.identifier === "live.packmates.app")?.attributes?.seedId;
if (seedId) writeFileSync(TEAM_FILE, seedId);
else console.log(`::warning::Couldn't read the account's Team ID (${ids.status}), so APPLE_TEAM_ID is used as it is.`);
