import { requireUser } from "@/lib/auth";
import { updateProfileAction } from "@/app/profile/actions";
import VerificationBadge from "@/components/VerificationBadge";
import Avatar from "@/components/Avatar";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="flex items-center gap-4 mb-6">
        <Avatar userId={user.id} hasPhoto={!!user.profilePhoto} size={16} />
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <VerificationBadge status={user.verificationStatus} />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2">
          Profile saved.
        </p>
      )}

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
