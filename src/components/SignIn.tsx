"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import {
  emailAuthAction,
  finishResetAction,
  lookupEmailAction,
  startResetAction,
  type AuthState,
} from "@/app/(auth)/actions";

// The buttons under "welcome to packmates": one big tap to get in.
//
// Apple and Google appear once their keys are set (see src/lib/oauth.ts).
// Email always works, and opens up in place rather than on another page:
// the address first, then whatever that address needs, a password if we
// know you, a name and a new password if we don't.

type Step = "start" | "email" | "password" | "create" | "reset" | "no-reset";

function AppleMark() {
  return (
    <svg viewBox="0 0 17 20" width="17" height="20" aria-hidden="true" fill="currentColor">
      <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.9 3.2-.5 8 1.3 10.6.9 1.3 2 2.7 3.3 2.7 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.4ZM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** Submits a form through useActionState by hand rather than through the
 * form's action prop. Same request, but React doesn't clear the form
 * afterwards, so a "password too short" doesn't also throw away the name
 * you'd just typed. */
function submitWith(dispatch: (data: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
}

export default function SignIn({
  providers,
  canEmail,
  startWithEmail = false,
  error: outsideError,
}: {
  providers: { apple: boolean; google: boolean };
  // Whether this site can send email, which is what decides how a
  // forgotten password gets reset.
  canEmail: boolean;
  // Straight to the email box, for the /login page when email is the
  // only way in anyway: one fewer tap to get to the thing you came for.
  startWithEmail?: boolean;
  error?: string | null;
}) {
  const anyProvider = providers.apple || providers.google;
  const [step, setStep] = useState<Step>(startWithEmail && !anyProvider ? "email" : "start");
  const [email, setEmail] = useState("");
  const [joinedWith, setJoinedWith] = useState<"apple" | "google" | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const [leaving, setLeaving] = useState<"apple" | "google" | null>(null);
  const [state, formAction, submitting] = useActionState<AuthState, FormData>(emailAuthAction, {
    error: null,
  });
  const [resetState, resetAction, resetting] = useActionState<AuthState, FormData>(
    finishResetAction,
    { error: null }
  );
  const [resetError, setResetError] = useState<string | null>(null);
  const [sendingReset, startSendingReset] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  // The error from a provider bounce (?error=…) belongs to the first
  // screen; once you've moved on it's old news.
  const shownError =
    step === "start"
      ? outsideError
      : step === "email"
        ? lookupError
        : step === "reset"
          ? resetState.error
          : step === "no-reset"
            ? null
            : resetError ?? state.error;

  function forgot() {
    setResetError(null);
    if (!canEmail) {
      setStep("no-reset");
      return;
    }
    startSendingReset(async () => {
      const result = await startResetAction(email);
      if (result.ok) setStep("reset");
      else setResetError(result.error);
    });
  }

  function lookUp(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    startLookup(async () => {
      const result = await lookupEmailAction(email);
      if (result.kind === "invalid") {
        setLookupError(result.error);
        emailRef.current?.focus();
      } else if (result.kind === "new") {
        setStep("create");
      } else {
        setJoinedWith(result.provider);
        setStep("password");
      }
    });
  }

  const errorBox = shownError ? (
    <p role="alert" className="rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-medium text-red-700 shadow">
      {shownError}
    </p>
  ) : null;

  if (step === "start") {
    return (
      <div className="space-y-3">
        {errorBox}
        {providers.apple && (
          <a
            href="/auth/apple"
            onClick={() => setLeaving("apple")}
            className="pill-btn pill-black"
          >
            {leaving === "apple" ? <Spinner /> : <AppleMark />}
            Continue with Apple
          </a>
        )}
        {providers.google && (
          <a
            href="/auth/google"
            onClick={() => setLeaving("google")}
            className="pill-btn pill-white"
          >
            {leaving === "google" ? <Spinner /> : <GoogleMark />}
            Continue with Google
          </a>
        )}
        <button
          type="button"
          onClick={() => setStep("email")}
          // With no providers set up, email is the one big button, in the
          // black the Apple button would have had.
          className={`pill-btn ${anyProvider ? "pill-ghost" : "pill-black"}`}
        >
          <span aria-hidden="true">✉️</span>
          Continue with email
        </button>
      </div>
    );
  }

  const back = (
    <button
      type="button"
      onClick={() => {
        setStep(step === "email" ? "start" : step === "reset" || step === "no-reset" ? "password" : "email");
        setLookupError(null);
        setResetError(null);
      }}
      className="text-sm font-medium text-white/85 underline underline-offset-2"
    >
      {step === "email"
        ? "← Other ways in"
        : step === "reset" || step === "no-reset"
          ? "← Back to signing in"
          : "← Use a different email"}
    </button>
  );

  if (step === "no-reset") {
    return (
      <div className="space-y-3 text-center text-white">
        <p className="text-lg font-bold">Forgotten it? 🔑</p>
        <p className="rounded-2xl bg-white/15 px-4 py-3 text-sm">
          Ask a packmates admin to reset it. They&apos;ll give you a temporary password to sign in
          with, and you can change it on your profile straight after.
        </p>
        <div className="pt-1">{back}</div>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form onSubmit={submitWith(resetAction)} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <p className="text-center text-white">
          <span className="block text-lg font-bold">Check your email 📬</span>
          <span className="text-sm text-white/85">
            We sent a code to <strong className="text-white">{email}</strong>
          </span>
        </p>
        {errorBox}
        <label htmlFor="reset-code" className="sr-only">
          The six-digit code
        </label>
        <input
          id="reset-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          placeholder="Six-digit code"
          className="pill-input text-center tracking-[0.3em]"
        />
        <label htmlFor="reset-password" className="sr-only">
          New password
        </label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="New password (8+ characters)"
          className="pill-input"
        />
        <button type="submit" disabled={resetting} className="pill-btn pill-black">
          {resetting && <Spinner />}
          Save and sign in
        </button>
        <div className="text-center pt-1">{back}</div>
      </form>
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={lookUp} className="space-y-3">
        {errorBox}
        <label htmlFor="signin-email" className="sr-only">
          Your email
        </label>
        <input
          ref={emailRef}
          id="signin-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="pill-input"
        />
        <button type="submit" disabled={looking} className="pill-btn pill-black">
          {looking && <Spinner />}
          Continue
        </button>
        {(anyProvider || !startWithEmail) && <div className="text-center pt-1">{back}</div>}
      </form>
    );
  }

  const creating = step === "create";
  return (
    <form onSubmit={submitWith(formAction)} className="space-y-3">
      <input type="hidden" name="mode" value={creating ? "signup" : "login"} />
      <input type="hidden" name="email" value={email} />
      {/* Lets the browser's password manager file the new password under
          the right address. */}
      <input type="email" value={email} autoComplete="username" readOnly hidden />

      <p className="text-center text-white">
        {creating ? (
          <>
            <span className="block text-lg font-bold">Nice to meet you 👋</span>
            <span className="text-sm text-white/85">
              Making a new account for <strong className="text-white">{email}</strong>
            </span>
          </>
        ) : (
          <>
            <span className="block text-lg font-bold">Welcome back 🙌</span>
            <span className="text-sm text-white/85">
              Signing in as <strong className="text-white">{email}</strong>
            </span>
          </>
        )}
      </p>

      {errorBox}

      {!creating && joinedWith && (
        <p className="rounded-2xl bg-white/15 px-4 py-2.5 text-sm text-white">
          You joined with {joinedWith === "apple" ? "Apple" : "Google"}, so there&apos;s no password
          on this account.{" "}
          <a href={`/auth/${joinedWith}`} className="font-semibold underline">
            Continue with {joinedWith === "apple" ? "Apple" : "Google"}
          </a>
        </p>
      )}

      {creating && (
        <>
          {/* For bots only: off screen, out of the tab order, ignored by
              password managers. A person never fills it in. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-px w-px opacity-0"
          />
          <label htmlFor="signin-name" className="sr-only">
            Your first name
          </label>
          <input
            id="signin-name"
            name="name"
            autoComplete="given-name"
            required
            minLength={2}
            maxLength={80}
            autoFocus
            placeholder="Your first name"
            className="pill-input"
          />
        </>
      )}
      <label htmlFor="signin-password" className="sr-only">
        {creating ? "Choose a password" : "Your password"}
      </label>
      <input
        id="signin-password"
        name="password"
        type="password"
        autoComplete={creating ? "new-password" : "current-password"}
        required
        minLength={creating ? 8 : 1}
        autoFocus={!creating}
        placeholder={creating ? "Choose a password (8+ characters)" : "Your password"}
        className="pill-input"
      />
      <button type="submit" disabled={submitting} className="pill-btn pill-black">
        {submitting && <Spinner />}
        {creating ? "Create my account" : "Sign in"}
      </button>
      <div className="flex items-center justify-center gap-4 pt-1">
        {back}
        {!creating && (
          <button
            type="button"
            onClick={forgot}
            disabled={sendingReset}
            className="text-sm font-medium text-white/85 underline underline-offset-2"
          >
            {sendingReset ? "Sending…" : "Forgot your password?"}
          </button>
        )}
      </div>
    </form>
  );
}
