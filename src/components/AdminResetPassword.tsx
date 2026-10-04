"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "@/app/admin/actions";

/** "Reset password" on a member's row in /admin: makes a temporary one and
 * shows it here, once, to pass on. It isn't kept anywhere to look up
 * again; press it again for a new one. */
export default function AdminResetPassword({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction, {
    password: null,
    error: null,
  });

  if (state.password) {
    return (
      <div className="w-56 rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs text-brand-900">
        <p>Temporary password for {name}:</p>
        <p className="my-1 select-all font-mono text-base font-bold tracking-wide">{state.password}</p>
        <p>Give it to them. They sign in with it and change it on their profile.</p>
      </div>
    );
  }

  return (
    <details>
      <summary className="btn-secondary !py-1 !text-xs cursor-pointer list-none whitespace-nowrap">
        Reset password
      </summary>
      <form action={action} className="mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <input type="hidden" name="userId" value={userId} />
        <p className="text-xs text-slate-600 mb-2">
          Makes a temporary password for {name} and signs them out everywhere.
        </p>
        {state.error && <p className="text-xs text-red-700 mb-2">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full !py-1.5 !text-xs">
          {pending ? "Making one…" : `Yes, reset ${name}'s password`}
        </button>
      </form>
    </details>
  );
}
