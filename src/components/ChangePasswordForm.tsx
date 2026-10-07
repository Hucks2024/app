"use client";

import { startTransition, useActionState } from "react";
import { changePasswordAction, type PasswordState } from "@/app/profile/actions";

export default function ChangePasswordForm({ needsCurrent }: { needsCurrent: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {
    error: null,
    done: false,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        startTransition(() => action(data));
        // Passwords don't hang about in the boxes once they've been sent.
        form.reset();
      }}
      className="space-y-3"
    >
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {state.error}
        </p>
      )}
      {state.done && !pending && (
        <p role="status" className="rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2">
          ✓ Password changed.
        </p>
      )}
      {needsCurrent && (
        <div>
          <label className="label" htmlFor="current-password">
            Current password
          </label>
          <input
            className="input"
            id="current-password"
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      )}
      <div>
        <label className="label" htmlFor="new-password">
          New password
        </label>
        <input
          className="input"
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">
          New password again
        </label>
        <input
          className="input"
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary w-full">
        {pending && <span className="spinner mr-2" aria-hidden="true" />}
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
