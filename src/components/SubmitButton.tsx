"use client";

import { useFormStatus } from "react-dom";

/** A submit button that knows its form is on its way.
 *
 * Disabled while pending, which is what stops a second tap on a slow
 * connection joining you twice or posting a meetup twice, and it says so,
 * so a tap never looks like it did nothing. */
export default function SubmitButton({
  children,
  pending: pendingLabel,
  className = "btn-primary",
  name,
  value,
  title,
}: {
  children: React.ReactNode;
  pending?: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      name={name}
      value={value}
      title={title}
      className={className}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
