import Link from "next/link";
import { requireUser, safeNext } from "@/lib/auth";
import { readError } from "@/lib/flash";
import { getPrisma } from "@/lib/db";
import PhotoPicker from "@/components/PhotoPicker";
import { savePhotoAction } from "@/app/photo/actions";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).photo.add };
}

// The one step between "I'm in" (or "Post") and the meetup, for anyone
// without a photo yet: people at a meetup need to know who to look for.
export default async function PhotoPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string; next?: string; error?: string; sig?: string }>;
}) {
  const { join, next: rawNext, error: rawError, sig } = await searchParams;
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const error = readError(rawError, sig);
  const next = safeNext(rawNext);

  const meetup = join
    ? await (await getPrisma()).runActivity.findUnique({ where: { id: join }, select: { id: true, title: true } })
    : null;
  // Back to the meetup, or to the map: going back to Post would only send
  // them straight here again.
  const back = meetup ? `/activities/${meetup.id}` : next === "/" ? "/profile" : "/";

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-center text-3xl font-bold text-white drop-shadow">
        {user.profilePhotoType ? t.me.changePhoto : t.photo.add}
      </h1>
      <p className="mt-3 text-center text-lg text-white">{t.photo.why}</p>
      <ul className="mx-auto mt-4 w-fit space-y-1 text-base text-white">
        <li>✓ {t.photo.face}</li>
        <li>✓ {t.photo.justYou}</li>
      </ul>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-base font-medium text-red-800">
          {error}
        </p>
      )}

      <form action={savePhotoAction} className="mt-6">
        {meetup && <input type="hidden" name="join" value={meetup.id} />}
        {!meetup && <input type="hidden" name="next" value={next} />}
        <PhotoPicker saveLabel={meetup ? `${t.photo.saveJoin} 🙌` : t.photo.save} />
      </form>

      <p className="mt-6 text-center">
        <Link href={back} className="inline-flex min-h-11 items-center text-base font-medium text-white underline underline-offset-2">
          {meetup ? t.photo.notNow : t.photo.back}
        </Link>
      </p>
    </div>
  );
}
