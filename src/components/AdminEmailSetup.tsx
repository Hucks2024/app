import { emailSetup, type DnsHost } from "@/lib/email-setup";
import { addEmailDomainAction, checkEmailDomainAction } from "@/app/admin/actions";
import { fromAddress } from "@/lib/email";
import { SITE } from "@/lib/site";
import CopyableField from "@/components/CopyableField";
import SubmitButton from "@/components/SubmitButton";
import AdminEmailCheck from "@/components/AdminEmailCheck";

// Email setup, step by step, for someone who has never touched DNS. Each
// step says what's done and gives the one thing to do next.

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-base font-bold ${
          done ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700"
        }`}
        aria-hidden="true"
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-base font-semibold ${done ? "text-green-800" : "text-slate-900"}`}>
          {title}
          <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        </p>
        {children && <div className="mt-2 space-y-2 text-base text-slate-700">{children}</div>}
      </div>
    </li>
  );
}

function WhereDns({ host }: { host: DnsHost | null }) {
  if (!host) {
    return <p>Add them where you bought {SITE.domain}, in its DNS settings.</p>;
  }
  return (
    <p>
      Your domain&apos;s DNS is at <strong>{host.name}</strong>.{" "}
      {host.url ? (
        <a href={host.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
          Open {host.name} →
        </a>
      ) : null}{" "}
      Find {SITE.domain}, then its DNS records, and add each one below.
    </p>
  );
}

export default async function AdminEmailSetup({ error, checked }: { error: string | null; checked: boolean }) {
  const setup = await emailSetup();
  const keyOk = setup.state !== "off";
  const domainAdded = setup.state === "domain";
  const allFound = setup.state === "domain" && setup.records.length > 0 && setup.records.every((r) => r.found);
  const verified = setup.state === "domain" && setup.status === "verified";

  return (
    <div className="card space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      )}
      <p className="text-base text-slate-700">
        Email is only used for one thing: password resets.{" "}
        {verified ? (
          <strong className="text-green-800">It&apos;s set up.</strong>
        ) : (
          <strong className="text-amber-800">It isn&apos;t working yet. Follow the steps.</strong>
        )}
      </p>
      <ol className="space-y-5">
        <Step n={1} done={keyOk} title="Resend key in Vercel">
          {!keyOk && (
            <p>
              In Vercel, open the project&apos;s Settings → Environment Variables, add{" "}
              <strong>RESEND_API_KEY</strong> with your key from resend.com → API Keys, then redeploy.
            </p>
          )}
          {setup.state === "restricted" && (
            <p className="text-amber-800">
              Your key can only send email, so this page can&apos;t set things up for you. On
              resend.com → API Keys, make a new key with <strong>Full access</strong>, put it in
              Vercel as RESEND_API_KEY, and redeploy. Or add {SITE.domain} on resend.com → Domains
              yourself.
            </p>
          )}
          {setup.state === "error" && (
            <p className="text-amber-800">Couldn&apos;t reach Resend just now ({setup.message}). Reload in a minute.</p>
          )}
        </Step>

        <Step n={2} done={domainAdded} title={`Add ${SITE.domain} to Resend`}>
          {setup.state === "no-domain" && (
            <form action={addEmailDomainAction}>
              <SubmitButton className="btn-primary min-h-12 text-base" pending="Adding…">
                Add {SITE.domain} to Resend
              </SubmitButton>
            </form>
          )}
        </Step>

        <Step n={3} done={allFound || verified} title="Add the DNS records">
          {setup.state === "domain" && !verified && (
            <>
              <WhereDns host={setup.dnsHost} />
              <ul className="space-y-4">
                {setup.records.map((r) => (
                  <li key={`${r.type}-${r.name}-${r.value.slice(0, 12)}`} className="rounded-xl border border-slate-200 p-3">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                      <span className="badge-slate">{r.type}</span>
                      {r.found ? (
                        <span className="text-green-700">✓ Found</span>
                      ) : r.found === false ? (
                        <span className="text-amber-700">Not found yet</span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">Name</p>
                    <CopyableField value={r.name || "@"} />
                    <p className="mt-2 text-sm font-semibold text-slate-600">Value</p>
                    <CopyableField value={r.value} />
                    {r.priority != null && (
                      <p className="mt-2 text-base">
                        Priority: <strong>{r.priority}</strong>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-600">
                If the Name box at {setup.dnsHost?.name ?? "your DNS host"} already ends in{" "}
                {SITE.domain}, paste only the first part. New records can take up to a few hours to
                show.
              </p>
            </>
          )}
        </Step>

        <Step n={4} done={verified} title="Resend checks them">
          {setup.state === "domain" && !verified && (
            <form action={checkEmailDomainAction} className="space-y-2">
              <input type="hidden" name="id" value={setup.id} />
              <SubmitButton className="btn-secondary min-h-12 text-base" pending="Checking…">
                Check again
              </SubmitButton>
              {checked && <p className="text-base">Asked Resend to check. Give it a minute, then reload.</p>}
            </form>
          )}
        </Step>

        <Step n={5} done={false} title="Send yourself a test">
          <p>
            Emails come from <strong className="break-all">{fromAddress()}</strong>.
          </p>
          <AdminEmailCheck />
        </Step>
      </ol>
    </div>
  );
}
