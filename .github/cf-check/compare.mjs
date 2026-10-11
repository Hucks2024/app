// One-off: before packmates.live's name servers move to Cloudflare, asks
// Cloudflare's own name servers what they'd answer, record by record, and
// compares that with what the world sees now. Public DNS only.
import { Resolver } from "node:dns/promises";

const NS = "guss.ns.cloudflare.com";
const cf = new Resolver();
cf.setServers(await new Resolver().resolve4(NS));
const now = new Resolver();
now.setServers(["8.8.8.8"]);

const read = async (r, name, type) => {
  try {
    const v = type === "MX" ? (await r.resolveMx(name)).map((m) => `${m.priority} ${m.exchange}`)
      : type === "TXT" ? (await r.resolveTxt(name)).map((t) => t.join(""))
      : type === "A" ? await r.resolve4(name)
      : await r.resolveCname(name);
    return v.sort();
  } catch (e) {
    return [`(${e.code})`];
  }
};

let missing = 0;
console.log(`Asking ${NS}`);
for (const [name, type] of [
  ["packmates.live", "MX"], ["packmates.live", "TXT"], ["zmail._domainkey.packmates.live", "TXT"],
  ["resend._domainkey.packmates.live", "TXT"], ["send.packmates.live", "MX"], ["send.packmates.live", "TXT"],
  ["_dmarc.packmates.live", "TXT"],
]) {
  const [a, b] = [await read(now, name, type), await read(cf, name, type)];
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) missing++;
  console.log(`${same ? "SAME" : "DIFF"}  ${type} ${name}`);
  if (!same) console.log(`      now: ${a.map((v) => v.slice(0, 60)).join(" | ")}\n      cf:  ${b.map((v) => v.slice(0, 60)).join(" | ")}`);
}
// The website: on Cloudflare these become the Worker; for now, whatever's there.
for (const [name, type] of [["packmates.live", "A"], ["www.packmates.live", "CNAME"], ["www.packmates.live", "A"]]) {
  console.log(`WEB   ${type} ${name}  now: ${(await read(now, name, type)).join(", ")}  cf: ${(await read(cf, name, type)).join(", ")}`);
}
console.log(missing ? `${missing} EMAIL RECORDS DIFFER` : "ALL EMAIL RECORDS MATCH");
