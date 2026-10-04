import { format } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import Avatar from "@/components/Avatar";
import AdminResetPassword from "@/components/AdminResetPassword";
import AdminEmailCheck from "@/components/AdminEmailCheck";
import { emailVerificationEnabled, fromAddress } from "@/lib/email";
import { formatMemberNumber } from "@/lib/invite";
import { isVerifiedMember, thumbsFor } from "@/lib/trust";
import { RED_FLAG_LIMIT, redFlagCount } from "@/lib/moderation";
import {
  approveVerificationAction,
  rejectVerificationAction,
  resolveReportAction,
  banUserAction,
  unbanUserAction,
  scanXrpPaymentsAction,
  setVerifiedAction,
  setAdminAction,
} from "@/app/admin/actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ xrpScan?: string }>;
}) {
  const me = await requireAdmin();
  const { xrpScan } = await searchParams;
  const prisma = await getPrisma();

  const [pending, openReports, users, xrpPayments] = await Promise.all([
    prisma.verificationRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.report.findMany({
      where: { status: "OPEN" },
      include: { reporter: true, reportedUser: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      // A hundred photos would be a lot of database to read for a table
      // that only needs to know which members have one.
      omit: { profilePhoto: true },
    }),
    prisma.xrpPayment.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const thumbs = await thumbsFor(
    prisma,
    users.map((u) => u.id)
  );
  // Counted red flags, for everyone who has had at least one raised.
  const flagged = await prisma.report.findMany({
    distinct: ["reportedUserId"],
    select: { reportedUserId: true },
  });
  const flags = new Map(
    await Promise.all(
      flagged.map(async (f) => [f.reportedUserId, await redFlagCount(prisma, f.reportedUserId)] as const)
    )
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-10">
      <h1 className="text-2xl font-bold text-white drop-shadow">Admin</h1>

      {/* First on the page because it's the thing most likely to need a
          look: without working email, members can't reset their own
          passwords. */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-white drop-shadow">Email</h2>
        <div className="card space-y-3">
          <p className="text-sm text-slate-700">
            {emailVerificationEnabled() ? (
              <>
                Switched on. Sending from <strong>{fromAddress()}</strong>.
                {!process.env.EMAIL_FROM && (
                  <span className="text-amber-700">
                    {" "}
                    That&apos;s Resend&apos;s test address, which only delivers to the Resend
                    account&apos;s own email. Set EMAIL_FROM in Vercel.
                  </span>
                )}
              </>
            ) : (
              <>Switched off. Add RESEND_API_KEY in Vercel and redeploy to turn it on.</>
            )}
          </p>
          <AdminEmailCheck />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white drop-shadow">
          Pending photo-ID verifications ({pending.length})
        </h2>
        {pending.length === 0 && <p className="text-sm text-white/80">Nothing to review.</p>}
        <div className="space-y-4">
          {pending.map((req) => (
            <div key={req.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium">{req.user.name}</p>
                  <p className="text-xs text-slate-500">{req.user.email}</p>
                </div>
                <p className="text-xs text-slate-400">
                  Submitted {format(req.submittedAt, "MMM d, h:mm a")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Selfie</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/verification/${req.id}/selfie`}
                    alt="Selfie submitted for verification"
                    className="rounded-lg border border-slate-200 max-h-64 object-contain w-full bg-slate-50"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Photo ID</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/verification/${req.id}/id`}
                    alt="Photo ID submitted for verification"
                    className="rounded-lg border border-slate-200 max-h-64 object-contain w-full bg-slate-50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <form action={approveVerificationAction}>
                  <input type="hidden" name="requestId" value={req.id} />
                  <button type="submit" className="btn-primary">
                    Approve
                  </button>
                </form>
                <form action={rejectVerificationAction} className="flex items-center gap-2 flex-1">
                  <input type="hidden" name="requestId" value={req.id} />
                  <input
                    className="input"
                    name="note"
                    placeholder="Optional note (photo unclear, doesn't match, etc.)"
                  />
                  <button type="submit" className="btn-danger shrink-0">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white drop-shadow">Open reports ({openReports.length})</h2>
        {openReports.length === 0 && <p className="text-sm text-white/80">No open reports.</p>}
        <div className="space-y-3">
          {openReports.map((r) => (
            <div key={r.id} className="card">
              <p className="text-sm">
                🚩 <span className="font-medium">{r.reporter.name}</span> red-flagged{" "}
                <span className="font-medium">{r.reportedUser.name}</span>{" "}
                <span className="text-slate-400 text-xs">
                  ({format(r.createdAt, "MMM d, h:mm a")})
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {flags.get(r.reportedUserId) ?? 0} of {RED_FLAG_LIMIT} counted flags (from different
                people who met them at a meetup)
              </p>
              <p className="text-sm text-slate-700 mt-1">&ldquo;{r.reason}&rdquo;</p>
              <div className="flex items-center gap-3 mt-3">
                <form action={resolveReportAction}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <button type="submit" className="btn-secondary !py-1 !text-xs">
                    Mark resolved
                  </button>
                </form>
                {r.reportedUser.accountStatus === "ACTIVE" ? (
                  <form action={banUserAction}>
                    <input type="hidden" name="userId" value={r.reportedUserId} />
                    <button type="submit" className="btn-danger !py-1 !text-xs">
                      Suspend {r.reportedUser.name}
                    </button>
                  </form>
                ) : (
                  <StatusBadge status={r.reportedUser.accountStatus} />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white drop-shadow">XRP payments</h2>
          <form action={scanXrpPaymentsAction}>
            <button type="submit" className="btn-secondary !py-1 !text-xs">
              Scan now
            </button>
          </form>
        </div>
        {xrpScan && (
          <p className="mb-3 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2">
            Scan result: {xrpScan}
          </p>
        )}
        {xrpPayments.length === 0 ? (
          <p className="text-sm text-white/80">
            No payments credited yet. Nothing checks the ledger on its own, use &ldquo;Scan
            now&rdquo; above whenever you want to check for new ones.
          </p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Member</th>
                  <th className="py-2 pr-4">XRP</th>
                  <th className="py-2 pr-4">≈ GBP</th>
                  <th className="py-2 pr-4">Months</th>
                  <th className="py-2 pr-4">When</th>
                </tr>
              </thead>
              <tbody>
                {xrpPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">{p.user.name}</td>
                    <td className="py-2 pr-4">{p.amountXrp.toFixed(2)}</td>
                    <td className="py-2 pr-4">£{p.amountGbp.toFixed(2)}</td>
                    <td className="py-2 pr-4">{p.monthsCredited}</td>
                    <td className="py-2 pr-4 text-slate-500">
                      {format(p.ledgerCloseAt, "MMM d, h:mm a")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white drop-shadow">
          Members ({users.length})
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">👍</th>
                <th className="py-2 pr-4">Can post</th>
                <th className="py-2 pr-4">Paid until</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 font-mono text-slate-500">
                    {u.memberNumber == null ? "—" : formatMemberNumber(u.memberNumber)}
                  </td>
                  <td className="py-2 pr-4 flex items-center gap-2">
                    <Avatar userId={u.id} hasPhoto={!!u.profilePhotoType} size={6} />
                    {u.name}
                    {u.role === "ADMIN" && <span className="badge-green">Admin</span>}
                  </td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{thumbs.get(u.id) ?? 0}</td>
                  <td className="py-2 pr-4">
                    {isVerifiedMember(u) ? (
                      <span>✓</span>
                    ) : (
                      // Only ever adds the tick: one taken away would come
                      // straight back from any meetup they've been to.
                      // Suspending is the way to stop somebody.
                      <form action={setVerifiedAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="userId" value={u.id} />
                        <span className="text-slate-400">new</span>
                        <button
                          type="submit"
                          className="text-brand-600 hover:underline text-xs"
                          title="Let them post without going to a meetup first"
                        >
                          verify
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {u.role === "ADMIN" ? (
                      "n/a"
                    ) : u.paidUntil && u.paidUntil > new Date() ? (
                      format(u.paidUntil, "MMM d, yyyy")
                    ) : (
                      <span className="text-slate-400">not paid</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={u.accountStatus} />
                    {(flags.get(u.id) ?? 0) > 0 && (
                      <span className="ml-1 text-xs text-red-700" title="Counted red flags">
                        🚩{flags.get(u.id)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-start gap-2">
                      {u.role !== "ADMIN" &&
                        (u.accountStatus !== "ACTIVE" ? (
                          <form action={unbanUserAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button type="submit" className="btn-secondary !py-1 !text-xs">
                              {u.accountStatus === "BANNED" ? "Lift ban" : "Unsuspend"}
                            </button>
                          </form>
                        ) : (
                          <form action={banUserAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button type="submit" className="btn-danger !py-1 !text-xs">
                              Suspend
                            </button>
                          </form>
                        ))}
                      {u.id !== me.id && u.accountStatus === "ACTIVE" && (
                        // Two taps on purpose: the first only opens the
                        // confirm, so a slip on a phone-width table can't
                        // hand somebody the keys. It opens in place rather
                        // than floating, because the table scrolls sideways
                        // and would clip a floating box. Keyed on the role
                        // so it closes once the change lands, instead of
                        // staying open offering to undo it.
                        <details key={u.role}>
                          <summary className="btn-secondary !py-1 !text-xs cursor-pointer list-none whitespace-nowrap">
                            {u.role === "ADMIN" ? "Remove admin" : "Make admin"}
                          </summary>
                          <form
                            action={setAdminAction}
                            className="mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="admin" value={u.role === "ADMIN" ? "0" : "1"} />
                            <p className="text-xs text-slate-600 mb-2">
                              {u.role === "ADMIN"
                                ? `${u.name} goes back to being a normal member.`
                                : `${u.name} gets everything you can do here, including this page.`}
                            </p>
                            <button type="submit" className="btn-primary w-full !py-1.5 !text-xs">
                              {u.role === "ADMIN" ? `Yes, remove ${u.name}` : `Yes, make ${u.name} an admin`}
                            </button>
                          </form>
                        </details>
                      )}
                      {u.id !== me.id && u.accountStatus === "ACTIVE" && (
                        <AdminResetPassword userId={u.id} name={u.name} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "BANNED") return <span className="badge-red">Banned for life</span>;
  if (status === "SUSPENDED") return <span className="badge-red">Suspended</span>;
  return <span className="badge-green">Active</span>;
}
