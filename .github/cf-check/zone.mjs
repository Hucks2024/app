// One-off: packmates.live's email records as they are now, written as a
// zone file to upload to Cloudflare, so moving the domain there keeps the
// inbox (Zoho) and the app's emails (Resend) working. Public DNS only.
const ask = async (name, type) => {
  const r = await fetch(`https://dns.google/resolve?name=${name}&type=${type}`);
  return ((await r.json()).Answer ?? []).filter((a) => a.type === { MX: 15, TXT: 16 }[type]).map((a) => a.data);
};
// A TXT value as zone-file strings: quoted, in pieces of at most 255.
const txt = (data) => {
  const joined = data.startsWith('"') ? data.replace(/^"|"$/g, "").split('" "').join("") : data;
  return (joined.match(/.{1,255}/g) ?? []).map((s) => `"${s.replace(/"/g, '\\"')}"`).join(" ");
};
const lines = ["$ORIGIN packmates.live.", "$TTL 3600"];
for (const name of ["@", "send"]) {
  for (const mx of await ask(name === "@" ? "packmates.live" : `${name}.packmates.live`, "MX")) lines.push(`${name}\tIN\tMX\t${mx.endsWith(".") ? mx : mx + "."}`);
}
for (const name of ["@", "send", "_dmarc", "resend._domainkey", "zmail._domainkey"]) {
  for (const t of await ask(name === "@" ? "packmates.live" : `${name}.packmates.live`, "TXT")) lines.push(`${name}\tIN\tTXT\t${txt(t)}`);
}
console.log("----- zone file -----");
console.log(lines.join("\n"));
console.log("----- end -----");
