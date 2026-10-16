import Link from "next/link";
import Logo from "@/components/Logo";
import { getT } from "@/i18n/server";

// Next renders this for any unmatched path, and for every notFound() the
// app throws. So it stays light rather than accusing anyone of anything.
export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <div className="flex justify-center mb-5">
        <Logo size={72} variant="white" className="h-16 w-auto lost-pin" />
      </div>
      <h1 className="text-3xl font-bold text-white drop-shadow">{t.oops.nothingHere}</h1>
      <Link href="/" className="btn-primary mt-6 inline-flex">
        {t.info.backToMap}
      </Link>
    </div>
  );
}
