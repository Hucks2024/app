import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-6 text-white drop-shadow">Log in</h1>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}
      <form action={loginAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="input" id="password" name="password" type="password" required />
        </div>
        <button type="submit" className="btn-primary w-full">
          Log in
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="text-brand-700 font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
