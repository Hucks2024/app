// For .github/workflows/ios.yml: everything the iPhone build needs from
// App Store Connect, done with the API key alone (xcodebuild's own sign
// in is refused for this account). Prints Apple's answers, never the key.
//
//   node asc.mjs check TEAM_FILE    the key works and the app exists;
//                                   writes the account's Team ID
//   node asc.mjs sign DIR           a distribution certificate (from
//                                   DIR/dist.csr) and an App Store profile
//                                   for this run, written to DIR
//   node asc.mjs upload IPA VERSION BUILD
//   node asc.mjs cleanup DIR        removes that certificate and profile
import { createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const { KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID } = process.env;
const BUNDLE_ID = "live.packmates.app";
const key = createPrivateKey(readFileSync(KEY_PATH));
const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function token() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${part({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" })}.${part({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" })}`;
  return `${unsigned}.${sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

class AppleError extends Error {}

async function api(method, path, data) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, ...(data && { "Content-Type": "application/json" }) },
    body: data && JSON.stringify({ data }),
  });
  if (res.status === 204) return {};
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = (body.errors ?? [{ title: res.statusText }]).map((e) => `${e.title?.replace(/\.$/, "")}. ${e.detail ?? ""}`).join(" ");
    throw new AppleError(`App Store Connect answered ${res.status} to ${method} ${path.split("?")[0]}: ${why}`);
  }
  return body;
}

const one = (type, id) => ({ data: { type, id } });

async function bundleId() {
  const { data } = await api("GET", `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&fields[bundleIds]=identifier,seedId`);
  const found = data.find((b) => b.attributes.identifier === BUNDLE_ID);
  if (!found) throw new AppleError(`There's no app ID ${BUNDLE_ID} on developer.apple.com (Identifiers).`);
  return found;
}

const commands = {
  async check(teamFile) {
    try {
      await api("GET", "/v1/apps?limit=1");
    } catch (e) {
      // A few characters of each ID (useless on their own) to check
      // against App Store Connect.
      if (e.message.includes(" 401 ")) throw new AppleError(`${e.message} So the key, its Key ID and the Issuer ID don't go together: check all three are from the same, still active key. The Key ID used ends in ${ASC_KEY_ID.slice(-3)} and the Issuer ID starts with ${ASC_ISSUER_ID.slice(0, 4)}.`);
      throw e;
    }
    const { data } = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
    if (!data.length) throw new AppleError(`The key works, but there's no app with the bundle ID ${BUNDLE_ID} in App Store Connect.`);
    writeFileSync(teamFile, (await bundleId()).attributes.seedId);
    console.log("The key works, and Packmates is in App Store Connect.");
  },

  async sign(dir) {
    const cert = await api("POST", "/v1/certificates", {
      type: "certificates",
      attributes: { certificateType: "DISTRIBUTION", csrContent: readFileSync(`${dir}/dist.csr`, "utf8") },
    });
    writeFileSync(`${dir}/cert.id`, cert.data.id);
    writeFileSync(`${dir}/dist.cer`, Buffer.from(cert.data.attributes.certificateContent, "base64"));
    const name = `Packmates build ${Date.now()}`;
    const profile = await api("POST", "/v1/profiles", {
      type: "profiles",
      attributes: { name, profileType: "IOS_APP_STORE" },
      relationships: { bundleId: one("bundleIds", (await bundleId()).id), certificates: { data: [{ type: "certificates", id: cert.data.id }] } },
    });
    writeFileSync(`${dir}/profile.id`, profile.data.id);
    writeFileSync(`${dir}/profile.name`, name);
    writeFileSync(`${dir}/profile.uuid`, profile.data.attributes.uuid);
    writeFileSync(`${dir}/profile.mobileprovision`, Buffer.from(profile.data.attributes.profileContent, "base64"));
    console.log("Made this run's distribution certificate and App Store profile.");
  },

  async upload(ipa, version, build) {
    const file = readFileSync(ipa);
    const { data: apps } = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
    const upload = await api("POST", "/v1/buildUploads", {
      type: "buildUploads",
      attributes: { cfBundleShortVersionString: version, cfBundleVersion: build, platform: "IOS" },
      relationships: { app: one("apps", apps[0].id) },
    });
    const reserved = await api("POST", "/v1/buildUploadFiles", {
      type: "buildUploadFiles",
      attributes: { assetType: "ASSET", fileName: "App.ipa", fileSize: file.length, uti: "com.apple.ipa" },
      relationships: { buildUpload: one("buildUploads", upload.data.id) },
    });
    for (const op of reserved.data.attributes.uploadOperations) {
      const res = await fetch(op.url, {
        method: op.method,
        headers: Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value])),
        body: file.subarray(op.offset, op.offset + op.length),
      });
      if (!res.ok) throw new AppleError(`Sending part ${op.partNumber ?? ""} of the app failed: ${res.status} ${res.statusText}`);
    }
    await api("PATCH", `/v1/buildUploadFiles/${reserved.data.id}`, {
      type: "buildUploadFiles",
      id: reserved.data.id,
      attributes: { uploaded: true },
    });
    console.log(`Sent build ${build} (${(file.length / 1e6).toFixed(1)} MB); Apple is checking it.`);

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 20_000));
      const { state } = (await api("GET", `/v1/buildUploads/${upload.data.id}`)).data.attributes;
      for (const w of state?.warnings ?? []) console.log(`::warning::${w.code}: ${w.description}`);
      if (state?.state === "COMPLETE") return console.log(`Apple accepted build ${build}. It shows in App Store Connect under TestFlight once processed.`);
      if (state?.state === "FAILED") {
        for (const e of state.errors ?? []) console.log(`::error::${e.code}: ${e.description}`);
        throw new AppleError(`Apple turned build ${build} down; the reasons are above.`);
      }
    }
    console.log("::warning::Apple is still checking the build; it shows in App Store Connect under TestFlight once done.");
  },

  async cleanup(dir) {
    // Apple re-signs App Store builds, so the uploaded build doesn't need
    // this certificate any more.
    for (const [file, path] of [["profile.id", "/v1/profiles/"], ["cert.id", "/v1/certificates/"]]) {
      if (existsSync(`${dir}/${file}`)) await api("DELETE", path + readFileSync(`${dir}/${file}`, "utf8")).catch((e) => console.log(`::warning::${e.message}`));
    }
  },
};

const [command, ...args] = process.argv.slice(2);
try {
  await commands[command](...args);
} catch (e) {
  if (!(e instanceof AppleError)) throw e;
  console.log(`::error::${e.message}`);
  process.exit(1);
}
