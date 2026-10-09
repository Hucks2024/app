import { format } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import Avatar from "@/components/Avatar";
import AdminResetPassword from "@/components/AdminResetPassword";
import AdminEmailSetup from "@/components/AdminEmailSetup";
import { readError } from "@/lib/flash";
import { formatMemberNumber } from "@/lib/member";
import { isVerifiedMember, thumbsFor } from "@/lib/trust";
import { RED_FLAG_LIMIT, redFlagCount } from "@/lib/moderation";
import {
  resolveReportAction,
  banUserAction,
  unbanUserAction,
  setVerifiedAction,
  setAdminAction,
} from "@/app/admin/actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sig?: string; checked?: string }>;
}) {
  const me = await requireAdmin();
  const { error: rawError, sig, checked } = await searchParams;
  const prisma = await getPrisma();

  const [openReports, users] = await Promise.all([
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
      <section id="email" className="scroll-mt-20">
        <h2 className="text-lg font-semibold mb-3 text-white drop-shadow">Email</h2>
        <AdminEmailSetup error={readError(rawError, sig)} checked={checked === "1"} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white drop-shadow">Open reports ({openReports.length})</h2>
        {openReports.length === 0 && <p className="text-sm text-white">No open reports.</p>}
        <div className="space-y-3">
          {openReports.map((r) => (
            <div key={r.id} className="card">
              <p className="text-sm">
                🚩 <span className="font-medium">{r.reporter.name}</span> red-flagged{" "}
                <span className="font-medium">{r.reportedUser.name}</span>{" "}
                <span className="text-slate-500 text-xs">
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
        <h2 className="text-lg font-semibold mb-3 text-white drop-shadow">
          Members ({users.length})
        </h2>
        <div className="card relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">👍</th>
                <th className="py-2 pr-4">Can post</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 font-mono text-slate-500">
                    {u.memberNumber == null ? "" : formatMemberNumber(u.memberNumber)}
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
                        <span className="text-slate-500">new</span>
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
