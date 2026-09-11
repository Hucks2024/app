import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { ensureInviteCode } from "@/lib/invite";
import { SITE } from "@/lib/site";
import { updateProfileAction } from "@/app/profile/actions";
import Avatar from "@/components/Avatar";
import CopyableField from "@/components/CopyableField";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const user = await requireUser();

  const prisma = await getPrisma();
  const inviteCode = await ensureInviteCode(prisma, user.id);
  const invitedCount = await prisma.user.count({ where: { invitedById: user.id } });
  const unlimited = user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="flex items-center gap-4 mb-6">
        <Avatar userId={user.id} hasPhoto={!!user.profilePhoto} size={16} />
        <h1 className="text-2xl font-bold text-white drop-shadow">{user.name}</h1>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300">
          Profile saved.
        </p>
      )}

      <div className="card mb-4">
        <p className="font-semibold mb-1">Invite a runner 🎟️</p>
        <p className="text-sm text-slate-600 mb-4">
          Pacemates is invite only. Share this with people you&apos;d actually turn up and run
          with, whoever joins stays linked to you.
        </p>
        <div className="space-y-3">
          <div>
            <p className="label">Your code</p>
            <CopyableField value={inviteCode} />
          </div>
          <div>
            <p className="label">Or send this link</p>
            <CopyableField value={`${SITE.url}/signup?code=${inviteCode}`} />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {unlimited
            ? "Your code never runs out."
            : `${user.invitesLeft} ${user.invitesLeft === 1 ? "invite" : "invites"} left.`}
          {invitedCount > 0 &&
            ` ${invitedCount} ${invitedCount === 1 ? "person has" : "people have"} joined through you.`}
        </p>
      </div>

      <form action={updateProfileAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input className="input" id="name" name="name" defaultValue={user.name} required />
        </div>
        <div>
          <label className="label" htmlFor="city">
            City / area
          </label>
          <input className="input" id="city" name="city" defaultValue={user.city ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="pace">
            Typical pace
          </label>
          <input
            className="input"
            id="pace"
            name="pace"
            placeholder="e.g. 5:30 / km, easy conversational"
            defaultValue={user.pace ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="bio">
            Bio
          </label>
          <textarea
            className="input"
            id="bio"
            name="bio"
            rows={3}
            defaultValue={user.bio ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="profilePhoto">
            Profile photo
          </label>
          <input
            className="input"
            id="profilePhoto"
            name="profilePhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Save
        </button>
      </form>
    </div>
  );
}
