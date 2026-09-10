import { format } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import Avatar from "@/components/Avatar";
import {
  approveVerificationAction,
  rejectVerificationAction,
  resolveReportAction,
  banUserAction,
  unbanUserAction,
  scanXrpPaymentsAction,
} from "@/app/admin/actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ xrpScan?: string }>;
}) {
  await requireAdmin();
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
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.xrpPayment.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-10">
      <h1 className="text-2xl font-bold">Admin</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          Pending photo-ID verifications ({pending.length})
        </h2>
        {pending.length === 0 && <p className="text-sm text-slate-500">Nothing to review.</p>}
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
        <h2 className="text-lg font-semibold mb-3">Open reports ({openReports.length})</h2>
        {openReports.length === 0 && <p className="text-sm text-slate-500">No open reports.</p>}
        <div className="space-y-3">
          {openReports.map((r) => (
            <div key={r.id} className="card">
              <p className="text-sm">
                <span className="font-medium">{r.reporter.name}</span> reported{" "}
                <span className="font-medium">{r.reportedUser.name}</span>{" "}
                <span className="text-slate-400 text-xs">
                  ({format(r.createdAt, "MMM d, h:mm a")})
                </span>
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
                  <span className="badge-red">Suspended</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">XRP payments</h2>
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
          <p className="text-sm text-slate-500">
            No payments credited yet. A scheduled check runs every 15 minutes, or use &ldquo;Scan
            now&rdquo; above.
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
        <h2 className="text-lg font-semibold mb-3">Members ({users.length})</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Verification</th>
                <th className="py-2 pr-4">Paid until</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 flex items-center gap-2">
                    <Avatar userId={u.id} hasPhoto={!!u.profilePhoto} size={6} />
                    {u.name}
                  </td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.verificationStatus}</td>
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
                    {u.accountStatus === "SUSPENDED" ? (
                      <span className="badge-red">Suspended</span>
                    ) : (
                      <span className="badge-green">Active</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {u.role !== "ADMIN" &&
                      (u.accountStatus === "SUSPENDED" ? (
                        <form action={unbanUserAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button type="submit" className="btn-secondary !py-1 !text-xs">
                            Unsuspend
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
