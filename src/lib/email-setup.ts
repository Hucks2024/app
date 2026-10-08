import { SITE } from "@/lib/site";

// Setting up email from inside the app, so it never needs anyone who knows
// what DNS is: /admin adds the domain to Resend, shows the records to copy
// and where the domain's DNS lives, ticks each one off as it appears, and
// asks Resend to check. Everything here uses the same RESEND_API_KEY the
// app already sends with, and only ever runs for an admin.

const RESEND_API = process.env.RESEND_API_BASE ?? "https://api.resend.com";
const DNS_API = process.env.DNS_API_BASE ?? "https://dns.google/resolve";

export type DnsRecord = {
  kind: string; // "SPF", "DKIM", "DMARC"…
  type: string; // "TXT", "MX"
  name: string; // as Resend gives it, e.g. "send" or "resend._domainkey"
  fqdn: string; // the full name, for looking it up
  value: string;
  priority?: number;
  status: string; // Resend's view: verified, pending, not_started, failed
  found: boolean | null; // our own lookup: is it out there yet? null = couldn't check
};

export type EmailSetup =
  | { state: "off" }
  | { state: "restricted"; dnsHost: DnsHost | null }
  | { state: "error"; message: string; dnsHost: DnsHost | null }
  | { state: "no-domain"; dnsHost: DnsHost | null }
  | { state: "domain"; id: string; status: string; records: DnsRecord[]; dnsHost: DnsHost | null };

export type DnsHost = { name: string; url?: string };

async function resend(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Some endpoints answer with nothing.
  }
  return { ok: res.ok, status: res.status, body };
}

function isRestricted(status: number, body: unknown): boolean {
  const name = (body as { name?: string } | null)?.name ?? "";
  return status === 401 && /restricted/i.test(name + JSON.stringify(body ?? ""));
}

function fqdnFor(name: string): string {
  const domain = SITE.domain;
  if (!name || name === "@") return domain;
  return name === domain || name.endsWith(`.${domain}`) ? name : `${name}.${domain}`;
}

type DnsAnswer = { data?: string };

async function lookup(name: string, type: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${DNS_API}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { Answer?: DnsAnswer[] };
    return (json.Answer ?? []).map((a) => (a.data ?? "").replace(/"\s*"/g, "").replace(/"/g, "").trim());
  } catch {
    return null;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\.$/, "").replace(/\s+/g, "");

async function isPublished(r: Omit<DnsRecord, "found">): Promise<boolean | null> {
  const answers = await lookup(r.fqdn, r.type);
  if (answers == null) return null;
  if (r.type === "MX") return answers.some((a) => norm(a).endsWith(norm(r.value)));
  return answers.some((a) => norm(a) === norm(r.value));
}

// Who runs the domain's DNS, from its nameservers, so the page can say
// where to go rather than "your DNS provider".
const HOSTS: [RegExp, DnsHost][] = [
  [/vercel-dns\.com/, { name: "Vercel", url: "https://vercel.com/dashboard/domains" }],
  [/cloudflare\.com/, { name: "Cloudflare", url: "https://dash.cloudflare.com" }],
  [/domaincontrol\.com/, { name: "GoDaddy", url: "https://dcc.godaddy.com/control/portfolio" }],
  [/registrar-servers\.com/, { name: "Namecheap", url: "https://ap.www.namecheap.com/domains/list" }],
  [/squarespacedns|googledomains/, { name: "Squarespace Domains", url: "https://account.squarespace.com/domains" }],
  [/awsdns/, { name: "Amazon Route 53", url: "https://console.aws.amazon.com/route53" }],
  [/porkbun\.com/, { name: "Porkbun", url: "https://porkbun.com/account/domainsSpeedy" }],
  [/ui-dns|ionos/, { name: "IONOS", url: "https://my.ionos.co.uk/domains" }],
  [/123-reg/, { name: "123 Reg", url: "https://www.123-reg.co.uk/secure/" }],
  [/hover\.com/, { name: "Hover", url: "https://www.hover.com/control_panel" }],
  [/wixdns/, { name: "Wix", url: "https://manage.wix.com/account/domains" }],
  [/dns-parking\.com|hostinger/, { name: "Hostinger", url: "https://hpanel.hostinger.com/domains" }],
  [/gandi\.net/, { name: "Gandi", url: "https://admin.gandi.net/domain" }],
  [/nsone\.net/, { name: "Netlify", url: "https://app.netlify.com/teams/domains" }],
];

async function dnsHost(): Promise<DnsHost | null> {
  const ns = await lookup(SITE.domain, "NS");
  if (!ns || ns.length === 0) return null;
  const all = ns.join(" ").toLowerCase();
  for (const [pattern, host] of HOSTS) if (pattern.test(all)) return host;
  return { name: ns[0].replace(/\.$/, "") };
}

type ResendRecord = { record?: string; type?: string; name?: string; value?: string; priority?: number; status?: string };
type ResendDomain = { id: string; name: string; status?: string; records?: ResendRecord[] };

/** Where email setup stands, for the /admin page. Never throws. */
export async function emailSetup(): Promise<EmailSetup> {
  if (!process.env.RESEND_API_KEY) return { state: "off" };
  const hostPromise = dnsHost();
  try {
    const list = await resend("/domains");
    if (isRestricted(list.status, list.body)) return { state: "restricted", dnsHost: await hostPromise };
    if (!list.ok) {
      return { state: "error", message: `Resend answered ${list.status}.`, dnsHost: await hostPromise };
    }
    const domains = ((list.body as { data?: ResendDomain[] })?.data ?? []) as ResendDomain[];
    const mine = domains.find((d) => d.name?.toLowerCase() === SITE.domain);
    if (!mine) return { state: "no-domain", dnsHost: await hostPromise };

    const full = await resend(`/domains/${mine.id}`);
    const domain = (full.ok ? full.body : mine) as ResendDomain;
    const base = (domain.records ?? []).map((r) => ({
      kind: r.record ?? "",
      type: (r.type ?? "TXT").toUpperCase(),
      name: r.name ?? "",
      fqdn: fqdnFor(r.name ?? ""),
      value: r.value ?? "",
      priority: r.priority,
      status: r.status ?? "not_started",
    }));
    const found = await Promise.all(base.map(isPublished));
    return {
      state: "domain",
      id: domain.id,
      status: domain.status ?? mine.status ?? "not_started",
      records: base.map((r, i) => ({ ...r, found: found[i] })),
      dnsHost: await hostPromise,
    };
  } catch (e) {
    return {
      state: "error",
      message: e instanceof Error ? e.message : String(e),
      dnsHost: await hostPromise.catch(() => null),
    };
  }
}

/** Adds this site's domain to the Resend account. */
export async function addDomainToResend(): Promise<{ ok: boolean; message?: string }> {
  const res = await resend("/domains", { method: "POST", body: JSON.stringify({ name: SITE.domain }) });
  if (res.ok) return { ok: true };
  if (isRestricted(res.status, res.body)) return { ok: false, message: "This Resend key can only send email, so it can't add the domain." };
  const msg = (res.body as { message?: string } | null)?.message;
  return { ok: false, message: msg ?? `Resend answered ${res.status}.` };
}

/** Asks Resend to look for the records now rather than on its own schedule. */
export async function askResendToVerify(id: string): Promise<void> {
  await resend(`/domains/${encodeURIComponent(id)}/verify`, { method: "POST" }).catch(() => undefined);
}
