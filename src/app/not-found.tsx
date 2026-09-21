import Link from "next/link";
import Logo from "@/components/Logo";

// Next renders this for any unmatched path, and for every notFound() the
// app throws — including a member reaching for a meetup in the other club,
// where the page genuinely isn't theirs to see. So it stays light rather
// than accusing anyone of anything.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <div className="flex justify-center mb-5">
        <Logo size={72} variant="white" className="h-16 w-auto lost-pin" />
      </div>
      <h1 className="text-3xl font-bold text-white drop-shadow">Nothing here</h1>
      <p className="text-sm text-white/85 mt-3">
        Wrong turn. Even the pin looks confused. 🧭
      </p>
      <Link href="/" className="btn-primary mt-6 inline-flex">
        Back to the map
      </Link>
    </div>
  );
}
