"use client";

import { useActionState } from "react";
import { testEmailAction, type TestEmailState } from "@/app/admin/actions";

export default function AdminEmailCheck() {
  const [result, action, pending] = useActionState<TestEmailState>(testEmailAction, null);
  return (
    <form action={action} className="space-y-3">
      <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary">
        {pending && <span className="spinner mr-2" aria-hidden="true" />}
        {pending ? "Sending…" : "Send me a test email"}
      </button>
      {result && (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            result.ok
              ? "border-brand-200 bg-brand-50 text-brand-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-medium">{result.ok ? "✅ " : "❌ "}{result.message}</p>
          {result.detail && (
            <p className="mt-1 break-words font-mono text-xs text-red-700/80">Resend said: {result.detail}</p>
          )}
        </div>
      )}
    </form>
  );
}
